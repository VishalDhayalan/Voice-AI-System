const micButton = document.getElementById('micBtn');
const micIcon = document.getElementById('micIcon');
const transcriptionDiv = document.getElementById('transcription');
let recording = false;
let stream;
let mediaRecorder;
let ws = new WebSocket('wss://' + location.hostname + ':8888/speech-query');

// Function to get microphone access and handle errors in this process
async function getMicAccess() {
    try {
        return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            alert('Microphone access is required for this app.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            alert('No microphone device found. Please connect a microphone and try again.');
        } else {
            alert('An unexpected error occurred while trying to access the microphone.');
        }
        throw error;
    }
}

ws.onmessage = (event) => {
    const transcription = event.data;
    transcriptionDiv.innerHTML += transcription + '<br>';
};

micButton.onclick = async () => {
    if (!recording) {
        // Get access to client mic stream and start recording audio chunks
        stream = await getMicAccess();
    }

    // Toggle animations between recording and not recording states.
    micIcon.classList.toggle('fa-beat-fade')
    micIcon.classList.toggle('recording')

    if (!recording) {
        recording = true;
        mediaRecorder = new MediaStreamRecorder(stream);
        mediaRecorder.audioChannels = 1;
        mediaRecorder.mimeType = 'audio/pcm';

        mediaRecorder.ondataavailable = (blob) => {
            ws.send(blob);
        };

        mediaRecorder.start(1000);  // Send data every second
    }
    else {
        recording = false;
        mediaRecorder.stop();

        // Stop audio track in stream to release the microphone.
        stream.getTracks().forEach((track) => {
            if (track.readyState == 'live') {
                track.stop();
            }
        });
    }
};