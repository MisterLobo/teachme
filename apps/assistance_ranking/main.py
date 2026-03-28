from dateparser import parse as parse_date
from typing import Annotated
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastembed import TextEmbedding
from ollama import chat
from datetime import datetime, timezone
import onnxruntime as ort
import json, pytz, requests

app = FastAPI()

origins = [
  "http://localhost",
  "http://localhost:3004",
  "http://localhost:3005",
]
app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

class QueryParams(BaseModel):
  prompt: str
  tz: str

OLLAMA_URL = 'http://localhost:11434/api/generate'
MODEL = 'deepseek-r1'

class Intent(BaseModel):
  subject: str
  start_time: str
  duration_minutes: int = 30
  session_price: str
  characteristics: str | None
  topic: str | None

@app.post('/search')
async def read_prompt(prompt_query: Annotated[QueryParams, Query()]):
  now_utc = datetime.now(timezone.utc)
  print(now_utc.isoformat())

  local_tz = pytz.timezone(prompt_query.tz or 'Asia/Manila')
  now_local = datetime.now(local_tz)
  print(now_local.isoformat())

  documents: list[str] = [
    prompt_query.prompt,
  ]
  embedding_model = TextEmbedding()
  print('The model BAAI/bge-small-en-v1.5 is ready to use.')
  #embeddings_generator = embedding_model.embed(documents)
  embeddings_list = list(embedding_model.embed(documents))
  print(len(embeddings_list[0]))

  system_prompt = f"""
  You are an API that extracts structured information from a user query.
  The current date/time is: {now_local.isoformat()}
  Return ONLY valid JSON following this schema:
  {{
    "subject": string,
    "topic": string,
    "start_time": string,
    "duration_minutes": integer,
    "session_price": money in USD,
    "characteristics": string
  }}
  Rules:
  - always check the current date
  - No explanations
  - Default duration_minutes to 30
  - money must start with dollar sign
  - start_time is the extracted string and must be in the future like 4pm tomorrow, next friday at 6am, in 6 hours
  """
  
  response = chat(
    model=MODEL,
    #think='medium',
    messages=[{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': prompt_query.prompt}]
  )
  print(response.message.content)
  raw_json = json.loads(str(response.message.content or '{"subject":null,"start_time":null,"duration_minutes":null}'))
  print(raw_json)

  intent = Intent.model_validate_json(str(response.message.content or '{"subject":null,"start_time":null,"duration_minutes":null}'))
  #intent = Intent.model_validate_json(raw_json)

  dt = parse_date(intent.start_time, settings={"TIMEZONE": prompt_query.tz or 'Asia/Manila', "RETURN_AS_TIMEZONE_AWARE": True})
  print(dt)
  if dt:
    intent.start_time = dt.isoformat()

  print(intent)

  response = requests.post(
    'http://localhost:5150/api/tutors/search',
    json=json.loads(intent.model_dump_json()),
    headers={
      'Content-Type': 'application/json',
    }
  )

  return {'Hello': 'World'}

@app.get('/ranking')
async def get_ranking():
  pass