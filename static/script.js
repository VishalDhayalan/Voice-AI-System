const button = document.getElementById('button');
const icon = document.getElementById('icon');
const voiceList = document.getElementById('voices');
const rateControl = document.getElementById('speech-rate');
const rateValueDisp = document.getElementById('rateValue');
const transcriptionArea = document.getElementById('transcript');
const micIconStyle = "fa-solid fa-microphone";
const penIconStyle = "fa-solid fa-pen-fancy fa-beat-fade";
const stopIconStyle = "fa-solid fa-stop";

let ws = new WebSocket('wss://' + location.hostname + ':8888/speech-query');
let recording = false;
let responseSynthesised = false;
let speechQueue = [];
let processingQueue = false;
let rate = parseFloat(rateControl.value);
let voices = [];
let responseStartTime;

function populateVoiceList() {
    if (voiceList.innerHTML === '') {
        voices = speechSynthesis.getVoices();
        voices.forEach((voice, i) => {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = voice.name;
            option.setAttribute("voice", voice);
            voiceList.appendChild(option);
        });
    }
}

// On some mobile devices a call to getVoice() is required for voices to be loaded.
populateVoiceList();

// Page initialisation
rateValueDisp.textContent = rate.toFixed(1);
window.speechSynthesis.onvoiceschanged = populateVoiceList;

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
observer.observe(transcriptionArea, {attributes: true, childList: true, subtree: true});

// Handles receiving LLM response stream via websocket
ws.onmessage = (response) => {
    if (response.data === "<start>") {
        transcriptionArea.textContent += "\n\nAI:\n";
        responseStartTime = performance.now();

        // Disable button and change to pen icon to indicate LLM writing response.
        button.disabled = true;
        button.style.backgroundColor = "#d2d2e7";
        icon.className = penIconStyle;
    }
    else if (response.data === "<end>") {
        // Enable button and change to stop icon.
        icon.className = stopIconStyle;
        button.style.backgroundColor = "#ccccff";
        button.disabled = false;
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
    // STT started. Add 'recording mode' styling for button icon.
    icon.classList.add('fa-beat-fade');
    icon.classList.add('recording');

    if (transcriptionArea.textContent !== "") {
        transcriptionArea.textContent += "\n\n";
    }
    transcriptionArea.textContent += "Me:\n";
};

recognition.onend = function() {
    // STT ended. Remove 'recording mode' styling for button icon.
    icon.classList.remove('fa-beat-fade');
    icon.classList.remove('recording');
    ws.send("<end>");
};

// ----------- Text to Speech -----------
function addToQueue(text) {
    speechQueue.push(text);
    if (!processingQueue) {
        processQueue();
    }
}

function asyncWait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processQueue() {
    processingQueue = true;
    while (speechQueue.length > 0) {
        // Ensure speaking only starts 1 second after LLM response stream started to allow for enough
        // words to come through. This wait is asynchronous to prevent blocking event loop.
        if (performance.now() - responseStartTime < 1000) {
            await asyncWait(1000 - performance.now() + responseStartTime);
        }
        const text = speechQueue.join('');
        speechQueue = [];
        await speak(text);
    }
    processingQueue = false;
}

// Changes UI back to mic icon and enable TTS settings.
function postSpeechUI() {
    icon.className = micIconStyle;
    voiceList.disabled = false;
    rateControl.disabled = false;
}

function speak(text) {
    return new Promise((resolve, reject) => {
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-GB';
        utterance.rate = rate;
        utterance.voice = voices[voiceList.selectedIndex];
        
        utterance.onstart = function() {
            // Disable TTS settings while speaking
            voiceList.disabled = true;
            rateControl.disabled = true;
        }

        utterance.onend = function() {
            if (speechQueue.length === 0) {
                postSpeechUI();
            }
            resolve();
        };

        utterance.onerror = function(event) {
            postSpeechUI();
            if (event.error !== "interrupted") {
                // An actual error happened.
                console.error('Speech synthesis utterance error', event);
                window.alert(
                    `An error occured during speech synthesis: ${event.error}\n\nRefresh the page to try again...`
                )
                reject(event);
            }
            else {
                // TTS was simply interrupted by the user.
                resolve();
            }
        };

        // This is to prevent speech synthesis from getting stuck and makes successive speaking smoother.
        window.speechSynthesis.cancel();
        // Speak the text
        window.speechSynthesis.speak(utterance);
    });
}

button.onclick = async () => {
    if (window.speechSynthesis.pending || window.speechSynthesis.speaking || speechQueue.length > 0) {
        // Button has been clicked in the middle of TTS and full LLM response received (since only
        // then button is enabled). Thus action is to stop TTS.
        speechQueue = [];
        window.speechSynthesis.cancel();
    }
    else if (recording) {
        recognition.stop();
        recording = false;
    }
    else {
        recognition.start();
        recording = true;
    }
};