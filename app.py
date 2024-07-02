from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Maintain current prompt of users. A simpler alternative to in-memory DBs and session variables in this case.
# This prompt is built via concatenation of STT chunks streamed from the frontend.
user_prompt: dict[WebSocket, str] = {}

# Mount the directory containing the HTML file as a static files directory
app.mount("/static", StaticFiles(directory="static"), "static")

@app.get("/")
async def get():
    return HTMLResponse(open("static/index.html").read())

# TODO: rename ws endpoint based on streaming voice or text
@app.websocket("/speech-query")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            transcript_chunk = await websocket.receive_text()
            if transcript_chunk == "<end>":
                # Send to LLM
                print(f"\nSENDING TO LLM!\n{user_prompt[websocket]}", flush=True)
            else:
                # Append transcript to user's current prompt, creating an item for the prompt only when the first chunk is received.
                user_prompt[websocket] = user_prompt.get(websocket, "") + transcript_chunk
                print(transcript_chunk, end="", flush=True)
    except WebSocketDisconnect:
        print("Client disconnected")
        del user_prompt[websocket]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run('app:app', host="0.0.0.0", port=8888, reload=True, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
