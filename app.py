from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketDisconnect

app = FastAPI()

# Mount the directory containing the HTML file as a static files directory
app.mount("/static", StaticFiles(directory="static"), "static")

@app.get("/")
async def get():
    return HTMLResponse(open("static/index.html").read())

@app.websocket("/speech-query")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            transcript = await websocket.receive_text()
            print(transcript, end="", flush=True)
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
