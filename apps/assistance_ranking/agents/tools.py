from fastembed import TextEmbedding
import grpc, uuid, os
import _credentials
from src.proto.v1.tutor import tutor_pb2, tutor_pb2_grpc
from src.proto.v1.embedding import embedding_pb2, embedding_pb2_grpc
from src.proto.v1.tool import tool_pb2, tool_pb2_grpc
from src.proto.v1.tool.tool_pb2_grpc import ToolService, ToolServiceServicer, ToolServiceStub
from src.proto.v1.tool.tool_pb2 import ToolVectorSearch, ToolSearchIntent, ToolVectorSearchResults, ToolGraphSearch, ToolGraphSearchResults, ToolGraphSearchResultsResult, ToolSearchResultsResponse, ToolScheduleSearch, ToolScheduleSearchResults, ToolGetUserProfile, ToolMatchTutors, ToolMatchedTutors, ToolUserProfile, ToolQuerySuggestions
from pydantic import BaseModel
from typing import Optional, Any, Awaitable, Callable, TypedDict, List, Dict, cast, Literal
from utils import get_redis_client

auth_users: Dict[str, str] = {}

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

class JWTAuthCredentials(grpc.AuthMetadataPlugin):
  def __init__(self, token):
    self.token = token

  def __call__(self, context: grpc.AuthMetadataContext, callback: grpc.AuthMetadataPluginCallback):
    metadata = (('authorization', f'Bearer {self.token}'),)
    callback(metadata, None)

class GoToolsClient:
  def __init__(self, id: uuid.UUID):
    self.id = id
    rc = get_redis_client()
    user: Dict[str, Any] = cast(Dict[str, Any], rc.json().get(f'agents:{id}:token') or [])
    print(f'GoTools user: {user}')
    token = user['token']
    auth_users.setdefault(str(id), token)
    print(f'GoTools id={id} token={token}')
    self.token = token
    self.creds = grpc.ssl_channel_credentials(
      _credentials.ROOT_CERTIFICATE,
      _credentials.SERVER_CERTIFICATE_KEY,
      _credentials.SERVER_CERTIFICATE,
    )

  async def retrieve_profile(self) -> Optional[ToolUserProfile]:
    call_creds = grpc.metadata_call_credentials(JWTAuthCredentials(self.token))
    composite_creds = grpc.composite_channel_credentials(self.creds, call_creds)

    with grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), composite_creds) as channel:
      stub = tool_pb2_grpc.ToolServiceStub(channel)
      input = ToolGetUserProfile(
        id=str(self.id),
        pid=str(self.id),
      )
      response: ToolSearchResultsResponse = stub.GetUserProfile(request=input)
      print('RETRIEVE PROFILE RESULT:', response)
      return response.user_profile
    
    return None

  async def match_tutors(self, profile: ToolUserProfile) -> Optional[ToolMatchedTutors]:
    call_creds = grpc.metadata_call_credentials(JWTAuthCredentials(self.token))
    composite_creds = grpc.composite_channel_credentials(self.creds, call_creds)

    with grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), composite_creds) as channel:
      stub = tool_pb2_grpc.ToolServiceStub(channel)
      input = ToolMatchTutors(
        profile=profile,
      )
      response: ToolSearchResultsResponse = stub.MatchTutors(request=input)
      print('RETRIEVE PROFILE RESULT:', response.matched_tutors)

      return response.matched_tutors

    return None
  
  async def save_suggestions(self, suggestions: List[str]):
    call_creds = grpc.metadata_call_credentials(JWTAuthCredentials(self.token))
    composite_creds = grpc.composite_channel_credentials(self.creds, call_creds)

    with grpc.secure_channel(str(os.getenv('CORE_GRPC_HOST')), composite_creds) as channel:
      stub = tool_pb2_grpc.ToolServiceStub(channel)
      input = ToolQuerySuggestions(
        pid=str(self.id),
        user_id=str(self.id),
        suggestions=suggestions,
      )
      response: ToolSearchResultsResponse = stub.SaveSuggestions(request=input)
      print('RETRIEVE PROFILE RESULT:', response.matched_tutors)

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
