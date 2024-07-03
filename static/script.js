const micButton = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const voiceList = document.getElementById('voices');
const rateControl = document.getElementById('speech-rate');
const rateValueDisp = document.getElementById('rateValue');
const transcriptionArea = document.getElementById('transcript');

let ws = new WebSocket('wss://' + location.hostname + ':8888/speech-query');
let recording = false;
let speaking = false;
let speechQueue = [];
let processingQueue = false;
let rate = parseFloat(rateControl.value);
let voices = [];


// Page initialisation
rateValueDisp.textContent = rate.toFixed(1);
window.speechSynthesis.onvoiceschanged = () => {
    voices = speechSynthesis.getVoices();
    voiceList.innerHTML = '';
    voices.forEach((voice, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = voice.name;
        option.setAttribute("voice", voice);
        voiceList.appendChild(option);
    });
};

// Update speech rate
rateControl.oninput = (event) => {
    rate = parseFloat(event.target.value);
    rateValueDisp.textContent = rate.toFixed(1);
};

// Keep current transcription in view when STT or LLM response is being rendered.
function keepTranscriptInView() {
    transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
}

const observer = new MutationObserver(keepTranscriptInView);
observer.observe(transcriptionArea, {attributes: true, childList: true, subtree: true})

// Handles receiving LLM response stream via websocket
ws.onmessage = (response) => {
    if (response.data === "<start>") {
        transcriptionArea.textContent += "\n\nAI:\n";
    }
    else {
        // Append text from LLM response stream to transcription and push to speech queue.
        transcriptionArea.textContent += response.data;
        addToQueue(response.data);
    }
};

// ----------- Speech to Text -----------
// TODO: Change this to be the OR of speechRecognition and webkitSpeechRecognition?
recognition = new window.webkitSpeechRecognition();
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = true;

recognition.onresult = function(event) {
    // Append to user transcript textbox and send to backend via websocket.
    transcript = event.results[event.results.length - 1][0].transcript;
    transcriptionArea.textContent += transcript;
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

    if (transcriptionArea.textContent !== "") {
        transcriptionArea.textContent += "\n\n"
    }
    transcriptionArea.textContent += "Me:\n";
};

recognition.onend = function() {
    // STT ended. Remove 'recording mode' styling for button.
    micIcon.classList.remove('fa-beat-fade');
    micIcon.classList.remove('recording');
    ws.send("<end>");
};

// ----------- Text to Speech -----------
function addToQueue(text) {
    speechQueue.push(text);
    if (!processingQueue) {
        processQueue();
    }
}

async function processQueue() {
    processingQueue = true;
    while (speechQueue.length > 0) {
        if (!speaking) {
            console.log(speechQueue);
            const text = speechQueue.join('');
            speechQueue = [];
            await speak(text);
        }
    }
    processingQueue = false;
}

function speak(text) {
    return new Promise((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-GB';
        utterance.rate = rate;
        utterance.voice = voices[voiceList.selectedIndex];

        utterance.onend = function() {
            speaking = false;
            resolve();
        };

        utterance.onerror = function(event) {
            console.error('Speech synthesis utterance error', event);
            speaking = false;
            reject(event);
        };

        speaking = true;
        // This is to prevent Web Speech API speech synthesis from getting stuck
        window.speechSynthesis.cancel();
        // Speak the text
        window.speechSynthesis.speak(utterance);
    });
}

// Trigger STT start and stop when mic button is clicked.
micButton.onclick = async () => {
    if (recording) {
        recognition.stop();
    }
    else {
        recognition.start();
    }
    recording = !recording;
};