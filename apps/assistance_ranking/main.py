from collections.abc import Callable

from dateparser import parse as parse_date
from typing import Annotated, Callable
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastembed import TextEmbedding
from ollama import chat
from datetime import datetime, timezone
from dotenv import load_dotenv
import json, pytz, requests, os
import grpc, asyncio, nats, ssl
from concurrent import futures
from src.proto.v1.tutor import tutor_pb2, tutor_pb2_grpc
from src.proto.v1.embedding import embedding_pb2, embedding_pb2_grpc
import _credentials
from neo4j import GraphDatabase
from nats.aio.client import Client as NATS
from grpc import ServicerContext, HandlerCallDetails, RpcMethodHandler
from typing import Optional, Awaitable, Callable, TypedDict, Literal, List, Any, Sequence, Dict, cast
import jwt, contextvars, base64, redis, operator
from redis.connection import SSLConnection
from langgraph.graph import END, StateGraph
from qdrant_client import AsyncQdrantClient
from typing_extensions import Annotated, TypedDict
from langchain_core.messages import AIMessage, SystemMessage, ToolMessage, HumanMessage
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import MemorySaver
from langgraph.runtime import Runtime
from langgraph.types import Command, Send, RetryPolicy, CachePolicy
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool, InjectedToolCallId
from langgraph.graph.message import add_messages
from agents.discovery import graph as discovery_agent, DiscoveryState
from agents.search import graph as search_agent, SearchState, ToolResults
from agents.analysis import graph as analysis_agent, AnalysisState
from nats.js import api as natsapi
from nats.aio.msg import Msg
from hvac import Client
from utils import get_redis_client
import onnxruntime as ort

load_dotenv()

MODEL = 'gemma4:26b'

class QueryParams(TypedDict):
  prompt: str
  tz: str
  pid: Optional[str]

class Intent(BaseModel):
  categories: str| None
  subject: str
  start_time: str
  session_duration: int = 30
  session_price: float
  currency: str
  characteristics: str | None
  topic: str | None
  prompt: str | None
  confidence: float
  #timezone: str | None

class SupervisorState(TypedDict):
  token: Optional[str]
  pid: Optional[str]
  id: Optional[str]

  messages: Annotated[list, add_messages]
  suggestions: Annotated[List[str], operator.add]
  task_description: str | None
  request_type: Literal['discovery', 'search', 'analysis'] | None
  agent_outputs: Optional[List[dict]]
  user_profile: Optional[dict]
  query: Optional[Annotated[QueryParams, Query()]]

@tool
async def handoff_to_subagent(
  agent_name: Literal['discovery', 'search', 'analysis'],
  task_description: str,
  tool_call_id: Annotated[str, InjectedToolCallId],
):
  """
  Handoff to subgent
  """
  update = {
    'task_description': task_description,
    'messages': [
      ToolMessage(
        name=f'handoff_to_{agent_name}',
        content=f'Successfully handed off task to {agent_name}',
        tool_call_id=tool_call_id,
      ),
    ],
  }
  return Command(
    goto=f'call_{agent_name}_agent',
    update=update,
  )

async def call_discovery_agent(state: SupervisorState, config: RunnableConfig):
  pid = state['pid']
  id = state['id']
  response = await discovery_agent.ainvoke(
    input=DiscoveryState(
      token=state['token'],
      pid=pid,
      id=id,

      prompts='Generate query suggestions for user',
      messages=[HumanMessage(content=f'Generate query suggestions for user ID={id} PID={pid}')] + state['messages'],
      #messages=[],
      user_profile=None,
      matched_tutors=None,
      suggestions=[],
      errors=[],
      inference_graph=None,
      agent_outputs=None,
      tools_used=[],
    ),
    config=config,
  )
  print('message from node call_discovery_agent:', response)

  message = AIMessage(name='discovery', content=response['messages'][-1].content)
  print('message from node call_discovery_agent:', message)

  return Command(
    update={
      'suggestions': response['suggestions'],
      'messages': [message],
    },
  )

async def call_search_agent(state: SupervisorState, config: RunnableConfig):
  query = state['query']
  if query is None:
    return state
  
  raw_query = query['prompt']
  tz = query['tz']
  response = await search_agent.ainvoke(
    input=SearchState(
      token=state['token'],

      raw_query=raw_query,
      timezone=tz,
      pid=state['pid'],

      safety_score=None,

      query=None,
      intent=None,

      tool_results=ToolResults(
        intents=None,
        safety_intent=None,
        parse_intent=None,

        vector=[],
        graph=[],
        schedule=[],
      ),

      vector_results=[],
      graph_results=[],
      schedule_results=[],

      message=None,
      messages=state['messages'],

      aggregated=[],
      ranked=[],
      reasoning_log=[],

      error=None,
    ),
    config=config,
  )
  message = AIMessage(name='search', content=response['messages'][-1].content)
  print('message from node call_search_agent:', message)

  return {
    'messages': [message],
  }

async def call_analysis_agent(state: SupervisorState, config: RunnableConfig):
  response = await analysis_agent.ainvoke(
    input=AnalysisState(
      messages=[],
      suggestions=[],
    ),
    config=config,
  )
  message = AIMessage(name='analysis', content=response['messages'][-1].content)
  print('message from node call_analysis_agent:', message)

  return {
    'messages': [message],
  }

async def after_agent(state: SupervisorState, config: RunnableConfig):
  messages = state['messages']
  print('AFTER AGENT messages:', messages)

  return state

tools = [handoff_to_subagent]
llm = ChatOllama(
  name='supervisor',
  model=MODEL,
  reasoning=False,
  temperature=0,
  #cache=True,
)
llm_with_tools = llm.bind_tools(tools)

async def supervisor(state: SupervisorState):
  request_type = state['request_type']
  response = await llm_with_tools.ainvoke([
    SystemMessage(f"""
    You are the Supervisor Agent, and the user has triggered a session request (e.g., login, search, booking, etc.). Your job is to route this request to the appropriate agent based on the situation:

    1. Use the appropriate tool based on the request type.
    2. Ensure you track the state of each agent's progress and manage efficiently.
    3. You must handle the incoming requests efficiently.
    3. Check the value of **request_type** to determine which action you should take. If value is empty or not set exit immediately.
    4. Your response must be a valid JSON and contain the JSON response from the Agents.

    RULES:
    - Always delegate the tasks to the Agents.
    - use the Tool provided in handing off tasks to agents.
    - Each Tool must be called only ONCE. Do not spam calls if it does not work.
    - append the agent's output into `messages`
    - If it takes more than 5 seconds then abort the task.
    - Output only the FINAL answer.
    - DO NOT replace the outputs of the Agents.
    - If an Agent is unavailable return a message explaining the situation. Concatenate the names of the agents at the end.
    - You must ensure that agents are not blocked or delayed unnecessarily and that all tasks are performed in the right sequence.
    - Remove whitespaces and the JSON must be ready to be processed by Python code.
    - No explanations.
    - No introductions.
    - Output only the final JSON.
    - OUTPUT must be a valid JSON string that can be parsed by Python code
                  
    request type: {request_type}
    """),
  ])
  print('RESPONSE FROM Supervisor:', response)
  return {
    'messages': [response],
  }

async def supervisor_router(state: SupervisorState) -> str:
  messages = state['messages']
  if len(messages) > 0 and messages[-1] is not None and isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
    return "tools"
  return END

builder = StateGraph(SupervisorState)
builder.add_node('supervisor', supervisor)
builder.add_node('tools', ToolNode(tools))
builder.add_node(call_discovery_agent)
builder.add_node(call_search_agent)
builder.add_node(call_analysis_agent)
#builder.add_node(after_agent)

builder.set_entry_point('supervisor')

builder.add_conditional_edges(
  'supervisor',
  supervisor_router,
  {
    'tools': 'tools',
    END: END,
  },
)

builder.add_edge('call_discovery_agent', END)
builder.add_edge('call_search_agent', END)
builder.add_edge('call_analysis_agent', END)
#builder.add_edge('tools', END)
#builder.add_edge('call_discovery_agent', END)
#builder.add_edge('call_discovery_agent', 'after_agent')
#builder.add_edge('after_agent', END)

graph = builder.compile(checkpointer=MemorySaver())

#==================

app = FastAPI()

class TutorService(tutor_pb2_grpc.TutorServiceServicer):
  async def GetById(self, request, context):
    return super().GetById(request, context)

  async def List(self, request, context):
    return super().List(request, context)
  
  async def GetAvailableSlots(self, request, context):
    return super().GetAvailableSlots(request, context)
  
  async def SmartSearch(self, request: tutor_pb2.TutorSmartSearch, context: grpc.aio.ServicerContext):
    return tutor_pb2.TutorResponse(
      status="OK",
      outer=tutor_pb2.TutorAvailableSlotsResponse(
        slots=[],
      ),
    )
  
  async def Search(self, request: tutor_pb2.TutorSearch, context: grpc.aio.ServicerContext) -> tutor_pb2.TutorResponse:
    metadata = context.invocation_metadata()
    if metadata is not None:
      md = dict(metadata)
      token = md.get('authorization', None)
      if token is None:
        await context.abort(grpc.StatusCode.UNAUTHENTICATED, 'missing auth token')

      print(f'TOKEN RECEIVED: {token}')

      token = token[len("Bearer "):]
      print(f'TOKEN RECEIVED: {token}')

      rc = get_redis_client()
      user: Dict[str, Any] = cast(Dict[str, Any], rc.json().get(f'agents:{request.pid}:token') or [])
      #user = users.pop(0)
      print(f'[AGENT] user from redis: {type(user)} {user}')

      supervisor_state = SupervisorState(
        token=str(token),
        pid=request.pid,
        id=request.user_id,
        query=QueryParams(prompt=request.query, tz=request.tz, pid=None),
        messages=[
          HumanMessage(content=request.query),
        ],
        suggestions=[],
        request_type='search',
        task_description='',
        agent_outputs=[],
        user_profile=None,
      )
      #print(request.query, request.tz)
      #response = await graph.ainvoke(supervisor_state, {"configurable": {"thread_id": "thread-1"}})
      #print('response:', response)

    results = await read_prompt(QueryParams(prompt=request.query, tz=request.tz, pid=None))
    print('intent:', results)

    providers = ort.get_available_providers()
    print(f"Systems Available: {providers}")
    if "CUDAExecutionProvider" not in providers:
      raise RuntimeError("System paths are still failing to link the GPU properly.")

    print('GENERATING EMBEDDINGS...')
    documents: list[str] = [
      request.query,
    ]
    """ embedding_model = TextEmbedding(
      model_name="BAAI/bge-small-en-v1.5",
      providers=[
        (
          "CUDAExecutionProvider",
          {
            "device_id": 0,
            "arena_extend_strategy": "kSameAsRequested", # Throttles hardware pool locks
            "cudnn_conv_algo_search": "DEFAULT",        # Prevents infinite algorithmic tuning loops
          }
        ),
        "CPUExecutionProvider",
      ],
      device_ids=[0],
    ) """
    embedding_model = TextEmbedding()
    embeddings_list = list(embedding_model.embed(documents, parallel=0))
    embedding = embeddings_list[0]
    print('GENERATED EMBEDDINGS')

    return tutor_pb2.TutorResponse(
      status="OK",
      inner=tutor_pb2.TutorSearchResponse(
        category=results.categories,
        confidence=results.confidence,
        currency=results.currency,
        subject=results.subject,
        start_time=results.start_time,
        session_duration=results.session_duration,
        session_price=results.session_price,
        timezone=request.tz,
        embedding=embedding,
      )
    )
  
class EmbeddingService(embedding_pb2_grpc.EmbeddingServiceServicer):
  async def Create(self, request: embedding_pb2.EmbeddingCreate, context: grpc.aio.ServicerContext):
    print('received request to embed: processing')
    documents: list[str] = [
      request.documents,
    ]
    print('data to be embedded: ', documents)
    embedding_model = TextEmbedding()
    embeddings_list = list(embedding_model.embed(documents))
    embedding = embeddings_list[0]
    print('embedded successfully:', embedding is not None)
    return embedding_pb2.EmbeddingCreateResponse(embedding=embedding)

async def connect_nats():
  ssl_ctx = ssl.create_default_context(purpose=ssl.Purpose.SERVER_AUTH)
  ssl_ctx.check_hostname = False
  ssl_ctx.verify_mode = ssl.CERT_NONE
  ssl_ctx.load_verify_locations(os.getenv('ROOT_CA_FILE'))
  print('loaded CA')
  ssl_ctx.load_cert_chain(certfile=str(os.getenv('CERT_FILE')), keyfile=str(os.getenv('CERT_KEY_FILE')))
  print('loaded certs')

  nc = NATS()

  async def discovered_server_cb():
    print('Got discovered!')

  async def disconnected_cb():
    print('Got disconnected!')

  #async def reconnected_cb():
  #  print(f'Got reconnected to {nc.connected_url.netloc}')

  async def error_cb(e):
    print(f'There was an error: {e}')

  async def closed_cb():
    print('Connection is closed')

  await nc.connect(
    servers=['nats://localhost:4222'],
    tls=ssl_ctx,
    allow_reconnect=True,
    tls_hostname='localhost',
    verbose=True,
    token=os.getenv('NATS_AUTH_TOKEN'),
    tls_handshake_first=True,
    max_reconnect_attempts=-1,
    error_cb=error_cb,
    disconnected_cb=disconnected_cb,
    closed_cb=closed_cb,
  )
  print('loaded NATS')

  js = nc.jetstream()
  
  async def discovery_cb(msg: Msg):
    try:
      data = json.loads(msg.data)
      print(f'[NATS.js] data received: {data}')
      await msg.ack()
      print('[NATS.js] message ack')

      user_id = data['id']

      client = redis.Redis(connection_pool=pool)
      client.set(f'agents:{user_id}:token', 'token', None)

      print(f'performing discovery for user with ID: {data['id']}')
      supervisor_state = SupervisorState(
        token=None,
        pid=data['pid'],
        id=data['id'],
        query=None,
        messages=[
          HumanMessage(content='Generate query suggestions for user'),
        ],
        suggestions=[],
        request_type='discovery',
        task_description='',
        agent_outputs=[],
        user_profile=None,
      )
      response = await graph.ainvoke(supervisor_state, {"configurable": {"thread_id": "thread-1"}})
      print('response:', response)
    except Exception as e:
      print(f'[NATS.js] data cannot be deserialized: {e}')
      await msg.nak(5)

  await js.publish_async(stream='agents', subject='agents.discovery', payload=b'{"foo": "bar"}')

  await nc.subscribe(
    #stream='agents',
    subject='agents.discovery',
    #durable='agents:discovery',
    #idle_heartbeat=5,
    cb=discovery_cb,
    #manual_ack=True,
  )
  print('[NATS] listening for events')

  #ack = pub.result()
  #print(f'[NATS] message published to stream: {ack.stream} (seq: {ack.seq})')
  
  async def sub_cb(msg):
    print(msg)

  await js.subscribe(
    stream='testabcd',
    subject='testabcd.foo',
    durable='testabcd',
    idle_heartbeat=5,
    cb=sub_cb,
  )

  print('[NATS] listening for events')
  #await nc.close()

pool = redis.ConnectionPool(
  host='localhost',
  port=6399,
  password=os.getenv('REDIS_PASSWORD'),
  connection_class=SSLConnection,
  ssl_ca_certs=str(os.getenv('ROOT_CA_FILE')),
  ssl_certfile=str(os.getenv('CERT_FILE')),
  ssl_keyfile=str(os.getenv('CERT_KEY_FILE')),
  ssl_cert_reqs='none',
)
async def connect_redis():
  try:
    print('connecting to redis')
    client = redis.Redis(connection_pool=pool)
    print('connected to redis')
    client.json().set('pyjsonkey', '$', { 'origin': 'python' })
    #client.close()
  except redis.ConnectionError as err:
    print('[REDIS] error connecting to server:', err)

async def connect_vector_db():
  try:
    context = ssl.create_default_context()
    context.load_verify_locations(str(os.getenv('ROOT_CA_FILE')))
    context.load_cert_chain(
      certfile=str(os.getenv('CERT_FILE')),
      keyfile=str(os.getenv('CERT_KEY_FILE')),
    )

    qdrant = AsyncQdrantClient(
      host='localhost',
      port=6333,
      grpc_port=6334,
      api_key=os.getenv('QDRANT_API_KEY'),
      https=True,
      check_compatibility=False,
      verify=os.path.join(os.path.dirname(__file__), 'certificates/rootCA.pem'),
      cert=(
        os.path.join(os.path.dirname(__file__), 'certificates/localhost.pem'),
        os.path.join(os.path.dirname(__file__), 'certificates/localhost-key.pem'),
      ),
      #prefer_grpc=True,
    )
    coll = await qdrant.get_collection('tutors')
    print('[QDRANT] connected to server')
    await qdrant.close()
  except Exception as e:
    print('[QDRANT] could not connect to server:', e)

async def connect_graph_db():
  driver = GraphDatabase.driver(
    uri=str(os.getenv('NEO4J_URI')), # 'bolt+ssc://localhost:7687',
    auth=(str(os.getenv('NEO4J_USER')), str(os.getenv('NEO4J_PASSWORD'))),
    #client_certificate=cert_provider,
  )
  with driver.session() as ss:
    print('[NEO4J] session created')
    result = ss.run('MATCH (n) RETURN n LIMIT 5')
    for record in result:
      print(record)

async def grpc_serve():
  ssl_ctx = ssl.create_default_context(purpose=ssl.Purpose.CLIENT_AUTH)
  ssl_ctx.load_verify_locations(str(os.getenv('ROOT_CA_FILE')))
  ssl_ctx.load_cert_chain(
    certfile=str(os.getenv('CERT_FILE')),
    keyfile=str(os.getenv('CERT_KEY_FILE')),
  )

  server = grpc.aio.server(
    futures.ThreadPoolExecutor(max_workers=10),
    interceptors=(JwtAuthInterceptor(),),
  )
  tutor_pb2_grpc.add_TutorServiceServicer_to_server(TutorService(), server)
  embedding_pb2_grpc.add_EmbeddingServiceServicer_to_server(EmbeddingService(), server)
  creds = grpc.ssl_server_credentials(
    [
      (
        _credentials.SERVER_CERTIFICATE_KEY,
        _credentials.SERVER_CERTIFICATE
      ),
    ],
    root_certificates=_credentials.ROOT_CERTIFICATE,
    require_client_auth=True,
  )
  server.add_secure_port('[::]:8800', server_credentials=creds)
  await server.start()
  print('Server started, listening on :8800')
  await server.wait_for_termination()

def extract_jwt_from_metadata(context: grpc.ServicerContext) -> str | None:
  md = dict(context.invocation_metadata() or [])
  auth_header = md.get("authorization")

  token: Optional[str] = None
  if isinstance(auth_header, str) and auth_header.startswith("Bearer "):
    token = auth_header[len("Bearer "):]
    return token
  return None


rpc_id_var = contextvars.ContextVar("rpc_id", default="default")
class JwtAuthInterceptor(grpc.aio.ServerInterceptor):
  def __init__(self) -> None:
    self.public_key = "public_key"
    self.algorithm = "RS512"
    def abort(ignored_request, context: ServicerContext):
      context.abort(grpc.StatusCode.UNAUTHENTICATED, "I dont know you")
    self._abort_handler = grpc.unary_unary_rpc_method_handler(abort)

  async def intercept_service(
    self,
    continuation: Callable[[HandlerCallDetails], Awaitable[RpcMethodHandler]],
    handler_call_details: HandlerCallDetails
  ):
    _metadata = dict(handler_call_details.invocation_metadata)
    print(_metadata)
    auth_header = _metadata.get("authorization")
    print(auth_header)
    if not isinstance(auth_header, str):
      return self._abort_handler
    
    token = auth_header[len("Bearer "):]

    try:
      #payload = jwt.decode(token, self.public_key, algorithms=["RS512"])
      secret = base64.b64decode(os.getenv('JWT_SECRET') or '')
      payload = jwt.decode(token, secret, algorithms=['HS512'])
    except jwt.PyJWTError as e:
      return self._abort_handler
    
    return await continuation(handler_call_details)

async def main():
  await connect_redis()
  #await connect_vector_db()
  #await connect_graph_db()
  await connect_nats()
  await grpc_serve()

loop = asyncio.get_running_loop()
loop.create_task(main())
#asyncio.run()

origins = [
  "https://localhost",
  "https://localhost:3004",
  "https://localhost:7890",
]
app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

async def read_prompt(prompt_query: Annotated[QueryParams, Query()]):

  now_utc = datetime.now(timezone.utc)
  print(now_utc.isoformat())

  local_tz = pytz.timezone(prompt_query.get('tz') or 'Asia/Manila')
  now_local = datetime.now(local_tz)
  print(now_local.isoformat())

  dt = parse_date('next wednesday', settings={"TIMEZONE": prompt_query.get('tz') or 'Asia/Manila', "RETURN_AS_TIMEZONE_AWARE": True})
  print(dt)

  system_prompt = f"""
  You are an API that extracts structured information from a user query.
  Do not show reasoning. Output only the final answer.
  Do not show the whitespaces
  The current date/time is: {now_local.isoformat()}
  Return ONLY valid JSON following this schema:
  {{
    "categories": string,
    "subject": string,
    "topic": string,
    "start_time": ISO 8601 string,
    "session_duration": integer,
    "currency": currency code
    "session_price": money in decimal without currency,
    "characteristics": string,
    "prompt": the original prompt in string
    "confidence": 0 to 1
    "error": error message
  }}
  Rules:
  - always check the current date
  - No explanations
  - Default session_duration to 30
  - currency defaults to USD
  - time input is 24-hour format
  - start_time is the formatted string and must be in the future like 4pm tomorrow, next friday at 6am, in 6 hours.
  - reject if input is not valid
  - set the error property with the error message or reason for rejecting the input
  - if date and time not specified, set default to the next 12 hours
  - session_price defaults to 20
  """
  
  response = chat(
    model=MODEL,
    think=False,
    messages=[
      {'role': 'system', 'content': system_prompt},
      {'role': 'user', 'content': prompt_query.get('prompt')},
    ],
  )
  print(response)
  raw_json = json.loads(str(response.message.content or '{"subject":null,"start_time":null,"session_duration":null}'))
  print(raw_json)

  intent = Intent.model_validate_json(
    str(response.message.content or '{"subject":null,"start_time":null,"session_duration":null}'),
  )

  if intent.confidence < 0.6:
    raise Exception('confidence not high enough')

  dt = parse_date(intent.start_time, settings={"TIMEZONE": prompt_query.get('tz') or 'Asia/Manila', "RETURN_AS_TIMEZONE_AWARE": True})
  print(dt)
  if dt:
    intent.start_time = dt.isoformat()

  intent.prompt = prompt_query.get('prompt')
  print(intent)

  return intent
