const micButton = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const transcriptionDiv = document.getElementById('transcript');

let ws = new WebSocket('wss://' + location.hostname + ':8888/speech-query');
let recording = false;

ws.onmessage = (response) => {
    if (response.data === "<start>") {
        transcriptionDiv.textContent += "\n\nAI:\n";
    }
    else {
        transcriptionDiv.textContent += response.data;
    }
};

recognition = new window.webkitSpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = true;

recognition.onresult = function(event) {
    console.log(event.results);

    // Append to user transcript textbox and send to backend via websocket.
    transcript = event.results[event.results.length - 1][0].transcript;
    transcriptionDiv.textContent += transcript;
    ws.send(transcript);
};

recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
    recording = false;
    recognition.stop();
};

recognition.onstart = function() {
    // STT started. Add 'recording mode' styling for button.
    micIcon.classList.add('fa-beat-fade');
    micIcon.classList.add('recording');

    if (transcriptionDiv.textContent !== "") {
        transcriptionDiv.textContent += "\n\n"
    }
    transcriptionDiv.textContent += "Me:\n";
};

recognition.onend = function() {
    // STT ended. Remove 'recording mode' styling for button.
    micIcon.classList.remove('fa-beat-fade');
    micIcon.classList.remove('recording');
    ws.send("<end>");
};

micButton.onclick = async () => {
    if (recording) {
        recognition.stop();
    }
    else {
        recognition.start();
    }
    recording = !recording;
};