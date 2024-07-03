from dataclasses import dataclass, field
from dotenv import load_dotenv

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

@dataclass
class UserData:
    # String to build the current transcript using streamed chunks of text from STT.
    transcription: str = ""
    # The message history of the user, for a conversational AI experience with memory.
    messageHistory: ChatMessageHistory = field(default_factory=ChatMessageHistory)

# A simpler alternative to in-memory DBs or session variables for our use case.
users: dict[WebSocket, UserData] = {}

def get_chat_history(user_socket: WebSocket):
    return users[user_socket].messageHistory

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
            id="user_socket",
            annotation=WebSocket,
        )
    ]
)

# Stream response from LLM for the user's transcript.
async def get_response(user_socket: WebSocket):
    async for text in chat.astream({"query": users[user_socket].transcription}, {"configurable": {"user_socket": user_socket}}):
        if text != "":
            yield text

app = FastAPI()

# Mount directory containing static files to be served.
app.mount("/static", StaticFiles(directory="static"), "static")

@app.get("/")
async def get():
    return HTMLResponse(open("static/index.html").read())

# TODO: rename ws endpoint based on streaming voice or text
@app.websocket("/speech-query")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    users[websocket] = UserData()
    
    try:
        while True:
            transcript_chunk = await websocket.receive_text()
            if transcript_chunk == "<end>":
                # Stream LLM response for the user's transcript via the websocket to frontend.
                await websocket.send_text("<start>")
                async for text in get_response(websocket):
                    await websocket.send_text(text)
                # Clear the transcript
                users[websocket].transcription = ""
            else:
                # Append transcript to user's current prompt.
                users[websocket].transcription += transcript_chunk
    except WebSocketDisconnect:
        print("Client disconnected")
        del users[websocket]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run('app:app', host="0.0.0.0", port=8888, reload=True, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
