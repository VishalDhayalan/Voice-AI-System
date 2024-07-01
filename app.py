from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketDisconnect
from pyaudio import PyAudio

audio = PyAudio()
stream = audio.open(
    format = audio.get_format_from_width(2),    # 16-bit PCM audio
    channels = 1,                               # Mono audio
    rate = 44100,
    output = True
)

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
            blob = await websocket.receive_bytes()
            stream.write(blob)
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run('app:app', host="0.0.0.0", port=8888, reload=True, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
