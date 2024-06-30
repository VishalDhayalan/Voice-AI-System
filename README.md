# End-to-End Voice AI System using LLMs
This project is an end-to-end voice-based conversational AI system consisting of 3 main parts:
1. Speech-to-Text (STT)
2. LLM
3. Text-to-speech (TTS)

The app utilises streaming of the user's speech and the transcribed text to the LLM as well as streaming the response of the LLM back to the user and converting it to speech, in an end-to-end fashion to acheive a much faster and more intuitive conversational experience.

## System Design
* **FastAPI** for the app. Utilises sockets for full-duplex streaming between the frontend and backend, as well as asynchronicity to handle multiple concorrent users.
* **SpeechRecognition** for interfacing with speech-to-text backends and APIs.
* **Langchain** for streaming text to LLM and receiving response as a stream.
* **__** for text-to-speech with streaming support.

A key consideration was performing STT and TTS on the frontend using the **Speech Web API**, thus saving server resources and bandwidth since streaming text is less heavy than quality audio. However due to it's lack of support and varying functionality among browsers and devices (see [here](https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1)), it was not used, in favour of a system that is as device and browser agnostic as possible.