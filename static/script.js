const micButton = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const transcriptionDiv = document.getElementById('transcription');

let ws = new WebSocket('wss://' + location.hostname + ':8888/speech-query');
let recording = false;
let transcriptCharIdx = 0

recognition = new window.webkitSpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = true;
recognition.continuous = true;

recognition.onresult = function(event) {
    console.log(event.results)
    let result = '';
    let curCharIdx = 0;
    let i = 0;

    // Skip all results that have already been streamed (i.e. everything up to `transcriptCharIdx`).
    while (
        i < event.results.length
        &&
        curCharIdx + event.results[i][0].transcript.length < transcriptCharIdx
    ) {
        curCharIdx += event.results[i][0].transcript.length;
        i += 1;
    }

    // Get only portion of results that is new (i.e. `transcriptCharIdx` onwards).
    if (i < event.results.length) {
        result += event.results[i][0].transcript.slice(transcriptCharIdx - curCharIdx)
        i += 1
        while (i < event.results.length) {
            result += event.results[i][0].transcript
            i += 1
        }
    }

    // Append to user transcript textbox and send to backend via websocket.
    transcriptCharIdx += result.length
    transcriptionDiv.textContent += result;
    ws.send(result);
};

recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
    recording = false;
    recognition.stop();
};

recognition.onstart = function() {
    // STT started. Reset transcription index and add 'recording mode' styling for button.
    transcriptCharIdx = 0;
    micIcon.classList.add('fa-beat-fade')
    micIcon.classList.add('recording')
}

recognition.onend = function() {
    // STT ended. Remove 'recording mode' styling for button.
    micIcon.classList.remove('fa-beat-fade')
    micIcon.classList.remove('recording')
}

micButton.onclick = async () => {
    if (recording) {
        recognition.stop();
    }
    else {
        recognition.start();
    }
    recording = !recording
}