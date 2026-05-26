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
from agents.tools import GoToolsClient, Intent
from src.proto.v1.tool.tool_pb2 import ToolVectorSearch, ToolSearchIntent, ToolVectorSearchResults, ToolGraphSearch, ToolGraphSearchResults, ToolGraphSearchResultsResult, ToolSearchResultsResponse, ToolScheduleSearch, ToolScheduleSearchResults, ToolGetUserProfile, ToolMatchTutors, ToolMatchedTutors, ToolUserProfile, ToolQuerySuggestions

load_dotenv()

MODEL = 'gemma4:26b'

class DiscoveryState(TypedDict):
  token: Optional[str]
  pid: Optional[str]
  id: Optional[str]
  prompts: str
  messages: Annotated[list, add_messages]
  user_profile: Optional[ToolUserProfile]
  matched_tutors: Optional[ToolMatchedTutors]
  suggestions: Annotated[list, operator.add]
  errors: Optional[List[str]]
  inference_graph: Optional[dict]
  agent_outputs: Optional[List[dict]]
  tools_used: Annotated[List[str], operator.add]

@tool
async def get_user_profile(id: uuid.UUID, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Retrieve a user's profile by ID

  Args:
    id (UUID): the id of the user in UUID format.
    pid (str): PID of user
    token: authentication token
  """
  gotools = GoToolsClient(id)
  results = await gotools.retrieve_profile()
  print('==================== GoTools ====================')
  print(f'results from tool: {results}')
  print('=================================================')
  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

async def _get_user_profile(id: uuid.UUID, token: Optional[str], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Retrieve a user's profile by ID

  Args:
    id (str): the id of the user in UUID format.
    token: authentication token
  """
  print(f'TOKEN PASSED: {token}')
  print(f'TOOL CALLED: get_user_profile with ID={id}')
  llm = ChatOllama(
    name='get_user_profile',
    model=MODEL,
    reasoning=False,
    temperature=0,
  )
  now_utc = datetime.now(timezone.utc)
  response = await llm.ainvoke([
    SystemMessage(f"""
    You are an expert Agent with a very simple task. You must generate 1 sample user profile based on the following schema:
    {{
      'id': valid UUID from input,
      'name': name of user,
      'country': valid country code,
      'currency': currency code,
      'category': string,
      'subject': string,
      'characteristic': list of strings. this is a list of characteristics of the Tutor that the user prefers. Example ["beginner-friendly", "native English speaker", "can teach kids"],
      'interests': list of strings. Contains topics or subjects that the user specifically wants to learn or search for. Example: "Building LLMs with LangGraph", "Programming AI with Python", "Learn Japanese", "Astronomy"
      'availability': example 'weekdays from 5pm',
      'timezone': standard timezone
    }}
    - Ouput must be a valid JSON string NOT a json array.
    - Return the output as JSON that can be parsed by Python code.
    - Do not show the tags and whitespaces.

    USER ID: {id}
    the current date and time is {now_utc}
    """)
  ])
  print('============================================================')
  print('OUTPUT OF TOOL get_user_profile:', response)
  print('============================================================')
  output = json.loads(str(response.content))
  print('============================================================')
  print('JSON OUTPUT OF TOOL get_user_profile:', json.dumps(output, sort_keys=True, indent=2))
  print('============================================================')

  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def match_tutors(id: uuid.UUID, user_profile: Dict[str, Any], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Match the best tutors for the user based on user preferences and history

  Args:
    id: (UUID): ID of the user making the request
    user_profile (dict): user's profile using the output of `get_user_profile`.
  """
  gotools = GoToolsClient(id)
  prof = ToolUserProfile(
    id=str(id),
    first_name=user_profile['first_name'],
    last_name=user_profile['last_name'],
    country=user_profile['country'],
    language=user_profile['language'],
    currency=user_profile['currency'],
    budget=user_profile['budget'],
  )
  results = await gotools.match_tutors(prof)
  print('==================== GoTools ====================')
  print(f'results from tool: {results}')
  print('=================================================')
  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

async def _match_tutors(user_profile: dict, tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Match the best tutors for the user based on user preferences and history

  Args:
    user_profile (dict): user's profile using the output of `get_user_profile`.
  """
  print(f'TOOL CALLED: match_tutors with user_profile={user_profile}')
  llm = ChatOllama(
    name='match_tutors',
    model=MODEL,
    reasoning=False,
    temperature=0,
  )
  now_utc = datetime.now(timezone.utc)
  response = await llm.ainvoke([
    SystemMessage(f"""
    You are an expert Agent with a very simple task. You must generate a list of tutors for an online Tutor Booking platform with the following schema:
    {{
      'name': name of user,
      'country': valid country code,
      'currency': currency code,
      'category': string,
      'subject': string,
      'characteristics': array of strings. example ["beginner-friendly", "native English speaker", "teaches kids"],
      'availability': example 'weekdays from 9am to 5pm',
      'timezone': standard timezone,
      'title': professional title,
      'bio': short introduction,
      'session_duration': duration in minutes. valid values: 30 or 60
      'session_price': price per session in decimals (example: 30)
    }}
    RULES:
    - List must have exactly 5 items
    - Tutor details must be correlated to the provided USER PROFILE and be as relevant as possible.
    - Ouput must be a valid JSON string.
    - Return the output as JSON that can be parsed by Python code.
    - Do not show the tags and whitespaces.
    - Use the USER PROFILE as basis of inference graph relationships

    USER PROFILE: {user_profile}
    the current date and time is {now_utc}
    """)
  ])
  print('============================================================')
  print('OUTPUT OF TOOL match_tutors:', response)
  print('============================================================')
  output = json.loads(str(response.content))
  print('============================================================')
  print('JSON OUTPUT OF TOOL match_tutors:', json.dumps(output, sort_keys=True, indent=2))
  print('============================================================')

  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def generate_embeddings(documents: List[str], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Generate a list of vector embeddings based on the input documents.

  Args:
    pid (str): the pid of the user in UUID format.
  """
  return {
    'messages': [
      ToolMessage(
        name='generate_embeddings',
        content='test content',
        tool_call_id=tool_call_id,
      ),
    ],
  }

async def _generate_embeddings(documents: List[str], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Generate a list of vector embeddings based on the input documents.

  Args:
    pid (str): the pid of the user in UUID format.
  """
  print(f'TOOL CALLED: generate_embeddings with inputs={documents}')
  now_utc = datetime.now(timezone.utc)
  return {
    'messages': [
      ToolMessage(
        name='generate_embeddings',
        content='test content',
        tool_call_id=tool_call_id,
      ),
    ],
  }

async def _generate_queries(user_profile: Optional[dict], inference_graph: List[dict], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Generate a list of queries based on the suggestions that the user can choose from

  Args:
    user_profile (dict): the user profile the suggestions will be based from.
    inference_graph (List of dicts): list of tutors inferred from graph
  """
  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def generate_queries(user_profile: Optional[dict], inference_graph: List[dict], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Generate a list of queries based on the suggestions that the user can choose from

  Args:
    user_profile (dict): the user profile the suggestions will be based from.
    inference_graph (List of dicts): list of tutors inferred from graph
  """
  print(f'TOOL CALLED: generate_queries with user_profile={user_profile}')
  now_utc = datetime.now(timezone.utc)

  llm = ChatOllama(
    name='generate_queries',
    model=MODEL,
    reasoning=False,
    temperature=0,
  )
  response = await llm.ainvoke([
    SystemMessage(f"""
    You are an expert AI agent that generates predefined search queries from a user profile for the user to choose from. Your task is to generate a list of 5 search queries for an Online Tutor Booking platform. The queries must be easy to understand by the user and must be in plain text.
    USER PROFILE: {user_profile}
    INFERENCE GRAPH: {inference_graph}
    RULES:
    - Each query must contain details about the booking like date, time, category, subject, language, preferred Tutor characteristics, etc. Use either or both inputs
    - Each query must not be more than 20 words.
    - OUTPUT must be a valid JSON string following this schema:
    {{
      "suggestions": <list of suggestions>
    }}
    - Return the output as JSON string that can be parsed into a valid JSON object using json.loads or JSON.parse.
    - Do not show the tags and whitespaces.
    - there is an error return a JSON in this schema:
    {{
      "errors": <error message explaining the issue>
    }}
    the current date and time is {now_utc}
    """),
  ])
  print('============================================================')
  print('OUTPUT OF TOOL generate_queries:', response)
  print('============================================================')
  output = json.loads(str(response.content))
  print('============================================================')
  print('JSON OUTPUT OF TOOL generate_queries:', json.dumps(output, sort_keys=True, indent=2))
  print('============================================================')
  
  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

@tool
async def save_suggestions(pid: uuid.UUID, suggestions: List[str], tool_call_id: Annotated[str, InjectedToolCallId]):
  """
  Tool used to store the generated suggestions.

  Args:
    pid (UUID): PID of user
    suggestions (list): list of query suggestions
  """
  gotools = GoToolsClient(pid)
  await gotools.save_suggestions(suggestions=suggestions)
  return Command(
    update={
      'messages': [ToolMessage('Success', tool_call_id=tool_call_id)],
    },
  )

tools = [get_user_profile, match_tutors, generate_queries, save_suggestions]

llm = ChatOllama(
  name='discovery',
  model=MODEL,
  reasoning=False,
  temperature=0,
)
llm_with_tools = llm.bind_tools(tools)

async def discovery(state: DiscoveryState):
  now_utc = datetime.now(timezone.utc)
  print(f'the current date and time is {now_utc}')
  response = await llm_with_tools.ainvoke([
    SystemMessage(f"""
    You are an expert Agent for an online Tutor Booking platform that specializes in generating suggestions based user's preferences, tutor history and past appointments. Your task is the following:
    1. RETRIEVE user info using the Tools provided
    2. PERFORM a graph search based on the provided information and analyze which Tutors best matches the user's preference based on relevance, rating, popularity, past appointments and historical data. Use the output of `get_user_profile` as the value of user_profile
    3. CREATE a list of top 5 query suggestions based on outputs of previous steps using the Tools provided. Use the outputs of other Tools as the input for this Tool
    4. SAVE the list using the Tool provided
    5. Return a valid JSON containing the output of the task.
                  
    TOOLS AVAILABLE:
    - get_user_profile(id: UUID)
    - match_tutors(user_profile: dict = <the output of get_user_profile>)
    - generate_queries(user_profile: dict = <the output of get_user_profile>, inference_graph: List of dict = <output of match_tutors>)
    - save_suggestions(pid: UUID, suggestions: List[str])

    TOOLS USED:
    {state['tools_used']}
                  
    RULES:
    - always check if Tool is already used and listed in `tools_used` array.
    - output of `get_user_profile` is stored in `user_profile`
    - output of `match_tutors` is stored in `inference_graph`
    - output of `generate_queries` is stored in `suggestions`
    - Use `get_user_profile` to retrieve a user's profile.
    - Use `match_tutors` to find Tutors that best match the user's preferences
    - Use `generate_queries` Tool to generate suggestions based on user preferences and inference graph.
    - Use `save_suggestions` Tool to save suggestions in cache
    - Use the Tools provided to complete this task.
    - Each Tool must be called only ONCE. Do not spam calls if it does not work.
    - OUTPUT must be a valid JSON
    - If there is an error append into `errors` array.
    - Do not show the whitespaces
    - No introductions.
    - No explanations.
    - If the output of the Tool is not a valid JSON then abort the task immediately with an error message.
    - You must pass the authentication token from `token` to the Tool everytime it is called.
    - OUTPUT must be a valid JSON string that can be parsed by Python code
    - If the Tool takes too long than 5 seconds then abort or cancel the task with an error message.
    
    the current date and time is {now_utc}
    user_profile: {state['user_profile']}
    user PID: {state['pid']}
    user ID: {state['id']}
    """),
  ] + state['messages'])
  print('OUTPUT OF DISCOVERY AGENT:', response)

  print(f'there are {len(state['messages'])} messages')
  print('MESSAGES:', state['messages'])
  return Command(
    update={
      'messages':  [response],
    },
  )

async def discovery_router(state: DiscoveryState) -> str:
  messages = state['messages']
  if isinstance(messages[-1], AIMessage) and messages[-1].tool_calls:
    return 'tools'
  return END

builder = StateGraph(DiscoveryState)

builder.add_node(discovery)
builder.add_node('tools', ToolNode(tools))

#builder.set_entry_point('discovery')

builder.add_edge(START, 'discovery')
builder.add_edge('tools', 'discovery')
builder.add_conditional_edges(
  'discovery',
  discovery_router,
  {
    'tools': 'tools',
    END: END,
  }
)
builder.add_edge('discovery', END)

graph = builder.compile(name='discovery', checkpointer=MemorySaver())