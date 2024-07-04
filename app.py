import asyncio
from dataclasses import dataclass, field
import datetime as dt
import os
import aiofiles
from dotenv import load_dotenv
import shortuuid
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.runnables.utils import ConfigurableFieldSpec
from langchain_community.chat_message_histories import ChatMessageHistory
from langchain_openai import ChatOpenAI

load_dotenv()

def generate_log_filename():
    # Generates a unique log filename for each conversation session, consisting of date, time and a short UUID.
    return "{:%Y-%m-%d_%H-%M-%S}".format(dt.datetime.now(dt.UTC)) + f"_{shortuuid.uuid()}.txt"

@dataclass
class SessionData:
    # String to build the current transcript using streamed chunks of text from STT.
    transcription: str = ""
    # The message history of the session, for a conversational AI experience with memory.
    messageHistory: ChatMessageHistory = field(default_factory=ChatMessageHistory)
    logFilename: str = field(default_factory=generate_log_filename)

# A simpler alternative to in-memory DBs or session variables for our use case.
sessions: dict[WebSocket, SessionData] = {}

def get_chat_history(session_socket: WebSocket):
    return sessions[session_socket].messageHistory

# Set up a chain with prompt, LLM model and output parsing. This chain is run with message history.
prompt_template = ChatPromptTemplate.from_messages(
    [
        ("placeholder", "{history}"),
        ("human", "{query}"),
    ]
)
llm = ChatOpenAI(model="gpt-3.5-turbo")
output_parser = StrOutputParser()
chain = prompt_template | llm | output_parser
chat = RunnableWithMessageHistory(
    chain,
    get_chat_history,
    input_messages_key="query",
    history_messages_key="history",
    history_factory_config=[
        ConfigurableFieldSpec(
            id="session_socket",
            annotation=WebSocket,
        )
    ]
)

os.makedirs("logs", exist_ok=True)
app = FastAPI()
# Mount directory containing static files to be served.
app.mount("/static", StaticFiles(directory="static"), "static")

async def log(session_socket: WebSocket, source: str, text: str):
    # Sanitise text to log on a single line
    text = text.replace('\n', '\\n')
    async with aiofiles.open(os.path.join("logs", sessions[session_socket].logFilename), "a", encoding="utf-8") as logFile:
        await logFile.write(f"{dt.datetime.now(dt.UTC)} {source} {text}\n")

# Stream response from LLM for the session user's query transcript.
async def get_response(session_socket: WebSocket):
    async for text in chat.astream({"query": sessions[session_socket].transcription}, {"configurable": {"session_socket": session_socket}}):
        if text != "":
            yield text

@app.get("/")
async def get():
    return HTMLResponse(open("static/index.html").read())

@app.websocket("/query")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    sessions[websocket] = SessionData()
    
    try:
        while True:
            transcript_chunk = await websocket.receive_text()
            if transcript_chunk == "<end>":
                # Append user's query transcript to their session conversation log.
                # This is done asynchronously to enable LLM response to be streamed back to frontend while logging.
                log_query = asyncio.create_task(log(websocket, "USER", sessions[websocket].transcription))
                
                # Stream LLM response for the session user's query transcript via the websocket to frontend.
                await websocket.send_text("<start>")
                response = ""
                async for text in get_response(websocket):
                    response += text
                    await websocket.send_text(text)
                await websocket.send_text("<end>")
                
                # Log LLM response after query has finished logging
                await log_query
                await log(websocket, "AI", response)
                
                # Clear the query transcript
                sessions[websocket].transcription = ""
            else:
                # Append chunk to session user's current query.
                sessions[websocket].transcription += transcript_chunk
    except WebSocketDisconnect:
        print("Client disconnected")
        del sessions[websocket]

if __name__ == "__main__":
    uvicorn.run('app:app', host="0.0.0.0", port=8888, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
