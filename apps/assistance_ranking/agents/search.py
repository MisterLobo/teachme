from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from qdrant_client import AsyncQdrantClient
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolCallId
from typing_extensions import Annotated, TypedDict
from langgraph.checkpoint.memory import MemorySaver
from langgraph.runtime import Runtime
from langgraph.types import Command, Send, RetryPolicy, CachePolicy
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.tools import tool
from langchain_core.messages import SystemMessage, ToolMessage, HumanMessage, AIMessage, AnyMessage
from typing import Optional, Any, Awaitable, Callable, TypedDict, List, Dict, cast, Literal
from langchain.agents import create_agent
from langchain.tools import ToolRuntime
from langgraph.prebuilt import ToolNode
from ollama import Tool
from langchain_ollama import ChatOllama
from pydantic import BaseModel
from fastembed import TextEmbedding
from ollama import chat
from datetime import datetime, timezone
from dotenv import load_dotenv
import onnxruntime as ort
import json, pytz, requests, os, operator
import grpc, asyncio, nats, ssl, uuid
from concurrent import futures
from src.proto.v1.tutor import tutor_pb2, tutor_pb2_grpc
from src.proto.v1.embedding import embedding_pb2, embedding_pb2_grpc
from src.proto.v1.tool import tool_pb2, tool_pb2_grpc
from src.proto.v1.tool.tool_pb2_grpc import ToolService, ToolServiceServicer, ToolServiceStub
from src.proto.v1.tool.tool_pb2 import ToolVectorSearch, ToolSearchIntent, ToolVectorSearchResults, ToolGraphSearch, ToolGraphSearchResults, ToolGraphSearchResultsResult, ToolSearchResultsResponse, ToolScheduleSearch, ToolScheduleSearchResults
import _credentials
from dateparser import parse as parse_date
from fastapi import FastAPI, Query
from agents.tools import GoToolsClient, Intent

load_dotenv()

MODEL = 'gemma4:26b'

class QueryParams(TypedDict):
  prompt: str
  tz: str
  pid: Optional[str]

class Intent2(BaseModel):
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

class SafetyScores(TypedDict):
  query_is_inappropriate: bool
  query_is_exploitative: bool
  query_relevance_score: float
  confidence: float

class IntentsOutput(TypedDict):
  safety_intent_output: SafetyScores
  parse_intent_output: Intent

class ToolResults(TypedDict):
  intents: Optional[IntentsOutput]
  safety_intent: Optional[SafetyScores]
  parse_intent: Optional[Intent]
  vector: List[str]
  graph: Annotated[list, add_messages]
  schedule: Annotated[list, add_messages]

class PlanIntent(BaseModel):
  use_vector: bool
  use_graph: bool
  max_results: int

class VectorSearchResult(TypedDict):
  tutor_id: str

class SearchState(TypedDict):
  token: Optional[str]

  timezone: Optional[str]
  pid: Optional[str]
  raw_query: Optional[str]

  safety_score: Optional[SafetyScores]
  
  query: Annotated[QueryParams, Query()] | None

  intent: Annotated[Intent, add_messages] | None

  messages: Annotated[list, add_messages]
  message: Optional[str]
  #last_message: Optional[AIMessage]

  tool_results: ToolResults

  vector_results: List[str]
  graph_results: Annotated[list, add_messages]
  schedule_results: Annotated[list, add_messages]

  aggregated: List[Dict]
  ranked: List[Dict]
  reasoning_log: List[str]

  error: Optional[str]

def get_grpc_channel():
  creds = grpc.ssl_channel_credentials(
    root_certificates=_credentials.ROOT_CERTIFICATE,
    private_key=_credentials.SERVER_CERTIFICATE_KEY,
    certificate_chain=_credentials.SERVER_CERTIFICATE,
  )

  return grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), credentials=creds)

class AuthInterceptor(grpc.UnaryUnaryClientInterceptor):
  def __init__(self, token):
    self.token = token

  def intercept_unary_unary(self, continuation, client_call_details, request):
    metadata = list(client_call_details.metadata or [])
    metadata.append(('authorization', f'Bearer {self.token}'))
    #call_details = grpc.ClientCallDetails()
    #call_details = client_call_details
    #call_details.method=call_details.method,
    #call_details.timeout=call_details.timeout,
    #call_details.metadata=metadata,
    #call_details.credentials=call_details.credentials,
    #call_details.wait_for_ready=call_details.wait_for_ready,
    #call_details.compression=call_details.compression,
    return continuation(client_call_details, request)

class JWTAuthCredentials(grpc.AuthMetadataPlugin):
  def __init__(self, token):
    self.token = token

  def __call__(self, context: grpc.AuthMetadataContext, callback: grpc.AuthMetadataPluginCallback):
    metadata = (('authorization', f'Bearer {self.token}'),)
    callback(metadata, None)

auth_users: Dict[str, str] = {}

class GoToolsClient2:
  def __init__(self, id: uuid.UUID):
    token = auth_users.get(str(id))
    print(f'GoTools id={id} token={token}')
    self.token = token
    self.creds = grpc.ssl_channel_credentials(
      _credentials.ROOT_CERTIFICATE,
      _credentials.SERVER_CERTIFICATE_KEY,
      _credentials.SERVER_CERTIFICATE,
    )

  async def vector_search(self, request: Intent):
    # create embeddings from raw text
    documents: list[str] = [
      str(request.prompt),
    ]
    print('data to be embedded: ', documents)
    embedding_model = TextEmbedding()
    #embeddings_generator = embedding_model.embed(documents)
    embeddings_list = list(embedding_model.embed(documents))
    embeddings = embeddings_list[0]
    print('embeddings:', len(embeddings))

    #intercept_channel = grpc.intercept_channel(self.channel, AuthInterceptor(str(self.token)))
    call_creds = grpc.metadata_call_credentials(JWTAuthCredentials(self.token))
    composite_creds = grpc.composite_channel_credentials(self.creds, call_creds)

    with grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), composite_creds) as channel:
      stub = tool_pb2_grpc.ToolServiceStub(channel)
      input = ToolVectorSearch(intent=ToolSearchIntent(
        category=request.categories,
        confidence=request.confidence,
        currency=request.currency,
        embeddings=embeddings,
        session_duration=request.session_duration,
        session_price=request.session_price,
        start_time=request.start_time,
        subject=request.subject,
        #timezone=request.timezone,
      ), embeddings=embeddings)
      results = stub.VectorSearch(request=input)
      print('VECTOR SEARCH RESULTS:', results)
    return {
      "vector_results": list(),
      "source": "vector",
    }
  
  async def graph_search(self, request: List[str]):
    call_creds = grpc.metadata_call_credentials(JWTAuthCredentials(self.token))
    composite_creds = grpc.composite_channel_credentials(self.creds, call_creds)
    with grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), composite_creds) as channel:
      stub = tool_pb2_grpc.ToolServiceStub(channel)
      input = ToolGraphSearch(ids=list())
      results = stub.GraphSearch(request=input)
      print('GRAPH SEARCH RESULTS:', results)
    return {
      "graph_results": list(),
      "source": "graph",
    }

  async def schedule_search(self, request: List[str]):
    call_creds = grpc.metadata_call_credentials(JWTAuthCredentials(self.token))
    composite_creds = grpc.composite_channel_credentials(self.creds, call_creds)
    with grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), composite_creds) as channel:
      stub = tool_pb2_grpc.ToolServiceStub(channel)
      input = ToolScheduleSearch(ids=list())
      results = stub.ScheduleSearch(request=input)
      print('SCHEDULE SEARCH RESULTS:', results)
    return {
      "schedule_results": list(),
      "source": "graph",
    }

@tool
async def safety_intent_tool(raw_query: str, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Tool that analyzes and determines if the input text is inappropriate or exploitative

  Args:
    raw_query (str): the raw query string
  """
  #raw_query = state.get('raw_query')
  print(f'safety_intent_tool: >>>>>>>>>>>>>>>>>>>>>>>>>> {raw_query} <<<<<<<<<<<<<<<<<<<<<<<<<<')
  #return

  system_prompt = f"""
  You are an expert agent that comprehends and determines if the input text is inappropriate or exploitative based on a set Topic
  RULES:
  - No introductions
  - Do not show reasoning. Output only the final answer.
  - Do not show the whitespaces
  - No explanations
  Return ONLY valid JSON following this schema:
  {{
    "query_is_inappropriate": boolean,
    "query_is_exploitative": boolean,
    "query_relevance_score": float,
    "confidence": 0 to 1
  }}
  Topic: Booking and scheduling for 1-on-1 online Tutor session
  """
  """ response = chat(
    model=MODEL,
    think=False,
    tools=[],
    messages=[
      {'role': 'system', 'content': system_prompt},
      {'role': 'user', 'content': raw_query},
    ]
  ) """
  llm = ChatOllama(
    name='safety_intent_tool',
    model=MODEL,
    reasoning=False,
    temperature=0,
  )
  response = await llm.ainvoke([
    SystemMessage(content=system_prompt),
    HumanMessage(content=raw_query),
    #{'role': 'system', 'content': system_prompt},
    #{'role': 'user', 'content': raw_query},
  ])
  print('[safety_intent_tool] response:', response.content)
  raw_json = json.loads(str(response.content or '{}'))
  print('safety scores:', raw_json)
  safety_scores = SafetyScores(raw_json)
  print('============================================================')
  print('OUTPUT OF TOOL safety_intent_tool:', response)
  print('============================================================')
  output = json.loads(str(response.content))
  print('============================================================')
  print('JSON OUTPUT OF TOOL safety_intent_tool:', json.dumps(output, sort_keys=True, indent=2))
  print('============================================================')

  print('[safety_intent_tool] scores:', safety_scores)

  return Command(
    update={
      'messages': [ToolMessage('safety checks passed', tool_call_id=tool_call_id)],
    },
  )

@tool
async def parse_intent_tool(prompt_query: str, tz: str, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Tool that accepts plaintext input then parses into a structured intent based on a predefined schema

  Args:
    prompt_query (str): the raw query string
    tz (str): user's timezone
  """
  now_utc = datetime.now(timezone.utc)
  print(now_utc.isoformat())

  local_tz = pytz.timezone(tz)
  now_local = datetime.now(local_tz)
  print(now_local.isoformat())

  dt = parse_date('next wednesday', settings={"TIMEZONE": tz, "RETURN_AS_TIMEZONE_AWARE": True})
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
  }}
  Rules:
  - always check the current date
  - No explanations
  - Default session_duration to 30
  - currency defaults to USD
  - time input is 24-hour format
  - start_time is the formatted string and must be in the future like 4pm tomorrow, next friday at 6am, in 6 hours.
  - reject if input is not valid
  - if date and time not specified, set default to the next 24 hours
  - session_price defaults to 20
  """

  print(f'TOOL: >>>>>>>>>>>>>>>>>>>>>>>>> {prompt_query} <<<<<<<<<<<<<<<<<<<<<<<<<<<<')
  
  llm = ChatOllama(
    name='safety_intent_tool',
    model=MODEL,
    reasoning=False,
    temperature=0,
  )
  response = await llm.ainvoke([
    SystemMessage(content=system_prompt),
    HumanMessage(content=prompt_query),
  ])
  print(response)
  raw_json = json.loads(str(response.content or '{"subject":null,"start_time":null,"session_duration":null}'))
  print(raw_json)

  intent = Intent.model_validate_json(
    str(response.content or '{"subject":null,"start_time":null,"session_duration":null}'),
  )

  if intent.confidence < 0.6:
    raise Exception('confidence not high enough')

  dt = parse_date(intent.start_time, settings={"TIMEZONE": tz, "RETURN_AS_TIMEZONE_AWARE": True})
  print(dt)
  if dt:
    intent.start_time = dt.isoformat()

  intent.prompt = prompt_query

  print('[parse_intent_tool] intent:', intent)

  print('============================================================')
  print('OUTPUT OF TOOL parse_intent_tool:', response)
  print('============================================================')
  output = json.loads(str(response.content))
  print('============================================================')
  print('JSON OUTPUT OF TOOL parse_intent_tool:', json.dumps(output, sort_keys=True, indent=2))
  print('============================================================')
  #state.update(intent=intent)

  return Command(
    update={
      'messages': [ToolMessage('intent generated', tool_call_id=tool_call_id)],
    },
  )

@tool
async def vector_tool(intent: Intent, id: uuid.UUID, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Perform a vector search using the parsed intent from the state

  Args:
    intent (Intent): the parsed intent object from text prompt
    id (UUID): the ID of the user
  """
  #intent = state['intent']
  if intent is None:
    raise Exception('intent missing')
  
  print(f'VECTOR TOOL: user ID={id}')
  gotools = GoToolsClient(id)
  results = await gotools.vector_search(intent)

  print('[vector_tool] response from AI:', results)

  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def graph_tool(vector_results: List[Any], id: uuid.UUID, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Perform graph search using the vector results as input

  Args:
    vector_results: the list containing the results from vector search
    id (UUID): the ID of the user
  """
  #vector_results = state.get('tool_results').get('vector')
  if vector_results is None:
    raise Exception('no results from vector')
  
  gotools = GoToolsClient(id)
  results = await gotools.graph_search(vector_results)
  ai_message = AIMessage(name='schedule_searcher', content=[results])

  print('[graph_tool] response from AI:', ai_message)

  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def schedule_tool(vector_results: List[Any], id: uuid.UUID, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Perform a schedule search using the vector results as input

  Args:
    vector_results: the list containing the results from vector search
    id (UUID): the ID of the user
  """
  #vector_results = state.get('tool_results').get('vector')
  if vector_results is None:
    raise Exception('no results from vector')
  
  gotools = GoToolsClient(id)
  results = await gotools.schedule_search(vector_results)
  ai_message = AIMessage(name='schedule_searcher', content=[results])

  print('[schedule_tool] response from AI:', ai_message)

  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def ranking_tool(aggregated: list, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Perform a ranking using the aggregated list as input

  Args:
    aggregated: the list containing the results from aggregation node
  """
  pass

class LLM:
  async def chat(self, system_prompt: str, user_prompt: str, tools: list):
    co = ChatOllama(
      name='Agent',
      model=MODEL,
      temperature=0,
      num_thread=2,
      #reasoning='low',
      reasoning=False,
    )
    llm_with_tools = co.bind_tools(tools)
    return llm_with_tools

llm = LLM()

def llm_node_factory(name: str, tool_key: str, results_key: str, instructions: List, tools: list):
  llm = LLM()
  async def node(state: SearchState):
    prompt = f"""
    You are a expert agent for an online Tutor Booking platform.  Your task is to perform search query based on the user's input prompt. Use the tools provided to complete this task
    
    TOOLS:
    - safety_intent_tool: Tool to use for analyzing prompts and checking whether it contains inappropriate or exploitative contents based on a scoring criteria.
    - parse_intent_tool: Tool used to parse the text prompt into a structured JSON based on a schema.
    - vector_tool: Used for searching tutors semantically related to the search prompt
    - graph_tool: Used for searching tutors that a related to the search prompt based on past history, popularity, preferences, and user interactions.
    - schedule_tool: Used for searching Tutors that are available on the selected time slot
    - aggregate_tool: Used for aggregating the results of the tools used on previous steps.
    - ranking_tool: Used for ranking the results based on a criteria and selecting the final top 10 Tutors
    
    Do not show reasoning. Output only the final answer.
    Do not show the whitespaces.

    Node Role: {name}
    Instructions:
    1. Perform your specific reasoning.
    2. Call the provided tools if needed.
    3. No explanations
    """

    try:
      """ co = ChatOllama(
        name='Agent',
        model=MODEL,
        temperature=0,
        num_thread=2,
        reasoning='low',
      ) """
      lwt = await llm.chat(prompt, str(state['raw_query']), tools)
      if lwt is None:
        raise Exception('No results')
      
      result = await lwt.ainvoke(instructions)
      print('NODE OUTPUT:', result)
      updated_state = state
      updated_state['reasoning_log'].append(f"{name} completed")

      return result
    except Exception as e:
      print(f'error at node {name}: {e}')
      updated_state = state
      updated_state['reasoning_log'].append(f"{name} failed: {str(e)}")

    #ai_message = AIMessage(name=name, content=[])

    #return [ai_message]

  return node

async def safety_intent_llm_node(state: SearchState):
  raw_query = state['raw_query']
  tz = str(state['timezone'])
  print('[safety_intent_llm_node] input:', raw_query)
  local_tz = pytz.timezone(tz)
  now_local = datetime.now(local_tz)
  prompts = [
    SystemMessage(f"""
    You are an expert AI agent for an online Tutor Booking platform that scans user input and determine its relevance based on a safety score. Your task is do the following in sequence using the current state for context:
    1. Analyze raw input text and check if it contains inappropriate or exploitative contents based on this schema:
    {{
      "query_is_inappropriate": boolean,
      "query_is_exploitative": boolean,
      "query_relevance_score": float,
      "confidence": 0 to 1
    }}
    """),
    SystemMessage(f"""
    2. Parse the input text into a structed intent based on the following schema:
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
    }}
    Rules:
    - always check the current date
    - No explanations
    - Default session_duration to 30
    - currency defaults to USD
    - time input is 24-hour format
    - start_time is the formatted string and must be in the future like 4pm tomorrow, next friday at 6am, in 6 hours.
    - reject if input is not valid
    - if date and time not specified, set default to the next 24 hours
    - session_price defaults to 20
    """),
    SystemMessage(f"""
    3. Merge the outputs and return a JSON containing the output values of the Tools following this schema:
    {{
      safety_intent_output: <output of safety_intent_tool>,
      parse_intent_output: <output of parse_intent_tool>
    }}   
    RULES:
    - No introductions
    - Do not show reasoning. Output only the final answer.
    - Do not show the whitespaces
    - No explanations
    - Follow the instructions and DO NOT SKIP ANY STEP
    - output must be a valid JSON string ready to be parsed
    """),
    HumanMessage(raw_query)
  ]
  node = llm_node_factory(
    "Safety & Intent Check / Parse Query",
    "safety_intent_tool",
    "safety",
    [
      SystemMessage(f"""
      You are an expert AI agent. Your task is do the following in sequence using the current state for context:
      1. Analyze raw input text and check if it contains inappropriate or exploitative contents using the Tool provided
      """),
      SystemMessage(f"""
      2. Parse the input text into a structed intent using the Tool provided
      """),
      SystemMessage(f"""
      3. Merge the outputs and return a JSON containing the output values of the Tools following this schema:
      {{
        safety_intent_output: <output of STEP 1>,
        parse_intent_output: <output of STEP 2>
      }}   
      RULES:
      - No introductions
      - Do not show reasoning. Output only the final answer.
      - Do not show the whitespaces
      - No explanations
      - Follow the instructions and DO NOT SKIP ANY STEP
      - output must be a valid JSON string ready to be parsed
      """),
      HumanMessage(raw_query),
    ],
    #tools=[],
    tools=[safety_intent_tool],
  )
  result = await node(state)
  if result is None:
    print('empty result')
    return state
  print('result from [safety_intent_llm_node]:', result)
  if not isinstance(result.content, str):
    print('invalid JSON string')
    return state
  print('result content:', result.content)
  try:
    rj = json.loads(str(result.content))
    print('result:', rj)
    return Command(
      update={
        'messages':  [result],
      },
    )
    return Command(
      update={
        "messages": [result],
        "safety_score": rj['safety_intent_output'],
        "intent": rj['parse_intent_output'],
      }
    )
  except Exception as e:
    print(f'error deserializing JSON from string: {e}')
  return state

async def parse_intent_llm_node(state: SearchState):
  raw_query = state['raw_query']
  tz = state['timezone']
  node = llm_node_factory(
    "Safety & Intent Check / Parse Query",
    "parse_intent_tool",
    "parse_intent",
    [
      SystemMessage(f"""
      You are an expert AI agent. Your task is do parse the input text into a structed intent using the Tool provided
      RULES:
      - No introductions
      - Do not show reasoning. Output only the final answer.
      - Do not show the whitespaces
      - No explanations
      - Follow the instructions and DO NOT SKIP ANY STEP
      - output must be a valid JSON string ready to be parsed
      """),
      HumanMessage(raw_query),
    ],
    #tools=[],
    tools=[parse_intent_tool],
  )
  result = await node(state)

async def vector_llm_node(state: SearchState):
  intent = state['intent']
  print('[vector_llm_node] input:', intent)
  node = llm_node_factory(
    "Vector Search",
    "vector_tool",
    "vector",
    [
      SystemMessage(f"""
      You are an expert AI agent. Your task is to perform vector search on the input intent. Use the provided tools as necessary.
                    
      RULES:
      - No introductions
      - Do not show reasoning. Output only the final answer.
      - Do not show the whitespaces
      - No explanations
      """),
      HumanMessage(f"""
      input intent: {intent}
      """)
    ],
    tools=[vector_tool],
  )
  result = await node(state)
  print('result from [vector_llm_node]:', result)
  tool_results = state.get('tool_results')
  print('AIMessage:', result)
  if not isinstance(result, AIMessage):
    print('Message not from AI:', result)
    return state
  if result.content is None:
    return state
  if not isinstance(result.content, str):
    return state

  message_content: str = str(result.content)
  result_json = json.loads(message_content)
  tool_results.update(vector=result_json)
  state.update(tool_results=tool_results)

  return state

async def graph_llm_node(state: SearchState):
  tool_results = state.get('tool_results')
  input = tool_results.get('vector')
  print('[graph_llm_node] input:', input)
  node = llm_node_factory(
    "Graph Search / User Preferences",
    "graph_tool",
    "graph",
    [
      SystemMessage(f"""
      You are an expert AI agent. Your task is to perform graph relationship search on the input list. Use the provided tools as necessary. You must process the input in parallel efficiently. If you receive errors from the Tool you must handle it gracefully.
      If the list is empty then return an empty list immediately.
      Do not show reasoning. Output only the final answer.
      Do not show the whitespaces
      """),
      SystemMessage(f"""
      RULES:
      - No introductions
      - Do not show reasoning. Output only the final answer.
      - Do not show the whitespaces
      - No explanations
      """),
      HumanMessage(f"""
      input list: {input}
      """),
    ],
    tools=[graph_tool],
  )
  result = await node(state)
  print('result from [graph_llm_node]:', result)
  tool_results = state.get('tool_results')
  print('AIMessage:', result)
  if not isinstance(result, AIMessage):
    print('Message not from AI:', result)
    return state
  if result.content is None:
    return state
  if not isinstance(result.content, str):
    return state
  message_content: str = result.content
  result_json = json.loads(message_content)
  tool_results.update(graph=result_json)
  state.update(tool_results=tool_results)

  return state

async def schedule_llm_node(state: SearchState):
  results = state.get('tool_results').get('vector')
  print('[schedule_llm_node] input:', results)
  node = llm_node_factory(
    "Schedule Search / Availability",
    "schedule_tool",
    "schedule",
    [
      SystemMessage(f"""
      You are an expert AI agent. Your task is to search for the available time slots on the input list. Use the provided tools as necessary. You must process the input in parallel efficiently. If you receive errors from the Tool you must handle it gracefully.
      If the list is empty then return an empty list immediately.
      Do not show reasoning. Output only the final answer.
      Do not show the whitespaces
      """),
      SystemMessage(f"""
      RULES:
      - No introductions
      - Do not show reasoning. Output only the final answer.
      - Do not show the whitespaces
      - No explanations
      """),
      HumanMessage(f"""
      input list: {results}
      """),
    ],
    tools=[schedule_tool],
  )
  result = await node(state)
  print('result from [schedule_llm_node]:', result)
  tool_results = state['tool_results']
  print('AIMessage:', result)
  if not isinstance(result, AIMessage):
    print('Message not from AI:', result)
    return state
  if result.content is None:
    return state
  if not isinstance(result.content, str):
    return state
  message_content: str = result.content
  result_json = json.loads(message_content)
  tool_results.update(schedule=result_json)
  state.update(tool_results=tool_results)

  return state

async def rank_llm_node(state: SearchState):
  input = state['raw_query']
  input_list = state['aggregated']
  node = llm_node_factory(
    "Ranking Tutors",
    "ranking_tool",
    "ranking",
    [
      SystemMessage(f"""
      You are an expert AI agent. Your task is to rank the input list and pick the top 10 items most relevant to the input text.
      If the list is empty then return an empty list immediately.
      Do not show reasoning. Output only the final answer.
      Do not show the whitespaces
                    
      input text: {input}
      input list: {input_list}
      """),
      SystemMessage(f"""
      RULES:
      - No introductions
      - Do not show reasoning. Output only the final answer.
      - Do not show the whitespaces
      - No explanations
      """),
    ],
    tools=[],
  )
  result = await node(state)
  print('result from [rank_llm_node]:', result)
  if not isinstance(result, AIMessage):
    print('Message not from AI:', result)
    return state
  if result.content is None:
    return state
  if not isinstance(result.content, str):
    return state
  result_json = json.loads(result.content)

  state.update(ranked=result_json)
  return {
    **state,
  }

async def aggregate_node(state: SearchState) -> SearchState:
  aggregated = []
  vector_ids = []

  for tutor_id in vector_ids:
    entry = {'tutor_id': tutor_id}
    graph_results = state.get('tool_results', {})['graph']
    graph_data = next((g for g in graph_results if g['tutor_id'] == tutor_id), {})
    entry.update(graph_data)
    schedule_results = state.get('tool_results', {})['schedule']
    schedule_data = next((s for s in schedule_results if s['tutor_id'] == tutor_id), {})
    entry.update(schedule_data)
    aggregated.append(entry)

  state['aggregated'] = aggregated
  state['reasoning_log'].append("Aggregated vector, graph, and scheduled results.")
  return state

tools = [safety_intent_tool, parse_intent_tool, vector_tool, graph_tool, schedule_tool, ranking_tool]

llm = ChatOllama(
  name='Search',
  model=MODEL,
  reasoning=False,
  temperature=0,
)
llm_with_tools = llm.bind_tools(tools)

async def search(state: SearchState):
  #state['raw_query'] = state['query']['prompt']
  pid = state['pid']
  token = state['token']
  print(f'SEARCH AGENT: pid={pid} token={token}')
  auth_users.setdefault(str(pid), str(token))
  response = await llm_with_tools.ainvoke([
    SystemMessage(f"""
    You are an expert AI Agent that analyzes text promps and performs search query based on that prompt. Your task is the following:
    1. ANALYZE the input prompt and determin whether it contains inappropriate or exploitative contents. Output must be a valid JSON string based on this schema:
    {{
      "query_is_inappropriate": boolean,
      "query_is_exploitative": boolean,
      "query_relevance_score": float,
      "confidence": 0 to 1
    }}
    2. PARSE the input prompt into a structured intent in JSON format following this schema:
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
    }}
    3. PERFORM a vector search based on the parsed intent using the tools provided.
    4. PERFORM a graph search based on the results of the vector search using the tools provided.  This step can be performed alongside the schedule search.
    5. FIND the tutors that are available in the selected time slot using the tools provided. This step can be performed alongside the graph search.
    6. AGGREGATE the results of graph search and schedule search based on matching keys and IDs of tutors.
    7. RANK the results and pick the top 10 that best matches the search query.
                  
    RULES:
    - EACH step in this task must be executed in a careful an efficient manner.
    - SPLIT the results of vector search into small chunks so they can be processed efficiently.
    - You must wait for each step to finish before proceeding to the next one.
    - You must use the tools provided to accurately and properly complete each step of the task.
    - You must use EACH tool only ONCE.
    - DO NOT SPAM tool calls that might cause the resources of the system to run out.
    - You must track the progress of each step and log your progress in `logs`.
    - The output MUST be a valid JSON string that can be processed by Python code.
    - DO NOT show introductions.
    - DO NOT SHOW explanations.
    - DO NOT show whitespaces.
    - Return only the FINAL output.
    """),
    SystemMessage(f"""
    USER ID: {pid}
    """),
    HumanMessage(content=state['raw_query'])
  ] + state['messages'])
  print('OUTPUT OF SEARCH AGENT:', response)
  return Command(
    update={
      'messages': [response]
    },
  )

async def search_router(state: SearchState) -> str:
  messages = state['messages']
  if isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
    return 'tools'
  return END

builder = StateGraph(SearchState)

builder.add_node(search)
builder.add_node('tools', ToolNode(tools))
#builder.add_node(safety_intent_llm_node)
#builder.add_node(vector_llm_node)
#builder.add_node(graph_llm_node)
#builder.add_node(schedule_llm_node)
#builder.add_node(aggregate_node)
#builder.add_node(rank_llm_node)

#builder.set_entry_point('search')

builder.add_edge(START, 'search')
builder.add_edge('tools', 'search')
#builder.add_edge('search', 'safety_intent_llm_node')
#builder.add_edge('safety_intent_llm_node', 'vector_llm_node')
#builder.add_edge('vector_llm_node', 'graph_llm_node')
#builder.add_edge('vector_llm_node', 'schedule_llm_node')
#builder.add_edge(['graph_llm_node', 'schedule_llm_node'], 'aggregate_node')
#builder.add_edge('aggregate_node', 'rank_llm_node')
#builder.add_edge([
#  'aggregate_node',
#], END)

builder.add_conditional_edges(
  'search',
  search_router,
  {
    'tools': 'tools',
    END: END,
  }
)

graph = builder.compile(name='search', checkpointer=MemorySaver())