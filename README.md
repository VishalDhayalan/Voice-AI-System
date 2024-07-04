# End-to-End Voice AI System using LLMs
This project is an end-to-end voice-based conversational AI system consisting of 3 main parts:
1. Speech-to-Text (STT)
2. LLM
3. Text-to-speech (TTS)

The app transcribes and streams the user's query as it is being spoken. This query is sent to an LLM (GPT-3.5-turbo) and the response is streamed back from the LLM as it is being generated, via the app server to the frontend and rendered in real-time. The TTS synthesises the LLM response into speech as it is being streamed, thus giving a full end-to-end streaming-based voice AI system that is faster and provides a more intuitive conversational experience.

## Features
:heavy_check_mark: End-to-end voice AI system (${\textsf{\color{Tan}speech-in speech-out}}$).  
:heavy_check_mark: ${\textsf{\color{Tan}Real-time}}$ STT and TTS.  
:heavy_check_mark: ${\textsf{\color{Tan}Streaming}}$ of STT transcription and response from LLM.  
:heavy_check_mark: Backend is ${\textsf{\color{Tan}fully asynchronous}}$ and able to support multiple users and conversations on one server at the same time.  
:heavy_check_mark: Asynchronous real-time ${\textsf{\color{Tan}logging}}$ of each conversation session on the server (i.e. locally).  
:heavy_check_mark: Individually maintains ${\textsf{\color{Tan}memory}}$ of the entire conversation for that session, enabling referring back to or recalling things said before in the conversation.  
:heavy_check_mark: Full conversation session ${\textsf{\color{Tan}transcript}}$ rendered in real-time.  
:heavy_check_mark: Ability to choose between a ${\textsf{\color{Tan}variety of voices}}$ and ${\textsf{\color{Tan}rates of speech}}$!  
:heavy_check_mark: ${\textsf{\color{Tan}Stop speech synthesis}}$ of the LLM response at any point.

## Tested Platforms
The app has been tested on the following systems and browsers.
| | Browser      | Platform/OS  |
|-|--------------|--------------|
| :heavy_check_mark: | Chrome           | Windows 10 |
| :heavy_check_mark: | MS Edge          | Windows 10 |
| :heavy_check_mark: | Chrome           | Android    |
| :heavy_check_mark: | Samsung Internet | Android    |

## System Design
* **FastAPI** is used as the web framework for the app. Utilises sockets for full-duplex streaming between the frontend and backend. The backend is fully asynchronous to handle multiple concurrent users and their conversations.
* **Web Speech API (speech recognition)** for STT. This is done in the frontend and the real-time transcript is streamed to the backend.
    * Numerous STT libraries and API were compared for their performance, cost, cloud/local compute, support for streaming and ability to function asynchronously.
    * **Candidates included:** Web Speech API, SpeechRecognition (and its supported STT backends/APIs), realtimestt, google cloud STT, deepgram.
    * Web Speech API was chosen as it is free, simpler to use and most importantly performs STT transcription on the frontend, thus achieving lowest latency as it only needs to stream one-way, from frontend to backend for STT and streaming text is lighter than streaming audio blobs. Furthermore, significantly reduced server load per user when compared to local STT models running in the backend.
* **Langchain** is used to make a conversational LLM chain with individual memory of the whole conversation of that session. The response from the LLM is streamed back as it is being generated, and streamed to the frontend for real-time rendering and TTS.
* **Web Speech API (speech synthesis)** is used for text-to-speech, synthesising the LLM response into speech in real-time while it is being streamed.
