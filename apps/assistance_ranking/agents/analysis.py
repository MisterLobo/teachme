from langgraph.graph import StateGraph, END
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
import grpc, asyncio, nats, ssl
from concurrent import futures

load_dotenv()

MODEL = 'gemma4:26b'

class AnalysisState(BaseModel):
  messages: Annotated[List[AnyMessage], add_messages] = []
  suggestions: Annotated[list, operator.add] = []

@tool
async def generate_transcripts():
  """
  Use this Tool to generate transcripts from a session recording
  """
  pass

tools = []

llm = ChatOllama(
  name='analysis',
  model=MODEL,
  reasoning=False,
)
llm_with_tools = llm.bind_tools(tools)

async def analysis(state: AnalysisState):
  response = await llm_with_tools.ainvoke([])
  return {
    'messages': [response]
  }

async def analysis_router(state: AnalysisState) -> str:
  tc = state.messages[-1]
  if not isinstance(tc, AIMessage):
    return 'tools'
  if tc.tool_calls:
    return 'tools'
  return END

builder = StateGraph(AnalysisState)

builder.add_node(analysis)
builder.add_node('tools', ToolNode(tools))

builder.set_entry_point('analysis')

builder.add_edge('tools', 'analysis')
builder.add_conditional_edges(
  'analysis',
  analysis_router,
  {
    'tools': 'tools',
    END: END,
  }
)

graph = builder.compile(checkpointer=True)