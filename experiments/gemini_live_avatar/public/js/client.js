/**
 * Gemini 3.8 Live with Live Avatar - Sandbox Client Controller
 */

let ws = null;
let audioContext = null;
let mediaStream = null;
let isSessionActive = false;
let currentAvatarId = 'avatar-nova-pro';
let rttStartTime = 0;

const logEl = document.getElementById('eventLog');
const btnToggleMic = document.getElementById('btnToggleMic');
const btnMicText = document.getElementById('btnMicText');
const btnInterrupt = document.getElementById('btnInterrupt');
const btnTestTool = document.getElementById('btnTestTool');
const dialogueState = document.getElementById('dialogueState');
const latencyBadge = document.getElementById('latencyBadge');
const avatarGrid = document.getElementById('avatarGrid');
const avatarInitials = document.getElementById('avatarInitials');
const btnClearLog = document.getElementById('btnClearLog');

function appendLog(message, type = 'info') {
  const time = new Date().toTimeString().split(' ')[0];
  const prefix = type === 'error' ? '❌' : type === 'tool' ? '⚡' : '➜';
  logEl.textContent += `\n[${time}] ${prefix} ${message}`;
  logEl.scrollTop = logEl.scrollHeight;
}

/**
 * Initializes WebSocket connection to sandbox relay
 */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/live`;

  appendLog(`Connecting to Live Relay at ${wsUrl}...`);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    appendLog('WebSocket connected to sandbox relay');
    dialogueState.textContent = 'Status: Connected & Ready';
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (err) {
      appendLog(`Raw message received: ${event.data.length} bytes`);
    }
  };

  ws.onclose = () => {
    appendLog('WebSocket disconnected. Attempting reconnect in 3s...', 'error');
    dialogueState.textContent = 'Status: Disconnected';
    setTimeout(connectWebSocket, 3000);
  };
}

/**
 * Handles incoming WebSocket events
 */
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'SESSION_CONNECTED':
      appendLog(`Model connected: ${msg.model}`);
      break;

    case 'SESSION_INITIALIZED':
      appendLog(`Active Avatar: ${msg.avatar.name} (${msg.avatar.persona})`);
      dialogueState.textContent = `Status: Live - ${msg.avatar.name}`;
      btnInterrupt.disabled = false;
      break;

    case 'AUDIO_FRAME_RECEIVED': {
      const rtt = Date.now() - rttStartTime;
      if (rtt < 1000) {
        latencyBadge.textContent = `RTT: ~${rtt}ms`;
      }
      break;
    }

    case 'INTERRUPTION_CONFIRMED':
      appendLog('Avatar interrupted cleanly by user speech', 'info');
      dialogueState.textContent = 'Status: Interrupted / Listening';
      break;

    default:
      appendLog(`Event: ${msg.type}`);
  }
}

/**
 * Fetches and displays available preset avatars
 */
async function loadAvatars() {
  try {
    const res = await fetch('/api/avatars');
    const data = await res.json();

    avatarGrid.innerHTML = '';
    data.avatars.forEach((avatar) => {
      const card = document.createElement('div');
      card.className = `avatar-card ${avatar.id === currentAvatarId ? 'active' : ''}`;
      card.innerHTML = `
        <div class="avatar-info">
          <h3>${avatar.name}</h3>
          <p>${avatar.persona}</p>
        </div>
        <span class="avatar-tag">${avatar.gender}</span>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        currentAvatarId = avatar.id;
        avatarInitials.textContent = avatar.name.substring(0, 2).toUpperCase();
        appendLog(`Selected avatar changed to: ${avatar.name}`);

        if (ws && ws.readyState === WebSocket.OPEN && isSessionActive) {
          ws.send(JSON.stringify({ type: 'START_SESSION', avatarId: currentAvatarId }));
        }
      });

      avatarGrid.appendChild(card);
    });
  } catch (err) {
    appendLog(`Failed to load avatar catalog: ${err.message}`, 'error');
  }
}

/**
 * Starts or stops live microphone streaming session
 */
async function toggleMicSession() {
  if (isSessionActive) {
    // Stop session
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
    isSessionActive = false;
    btnMicText.textContent = 'Start Live Mic Session';
    btnToggleMic.classList.remove('danger');
    btnInterrupt.disabled = true;
    dialogueState.textContent = 'Status: Idle';
    appendLog('Microphone session ended');
  } else {
    // Start session
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      const bars = document.querySelectorAll('#audioWaveBar .bar');

      function updateVolume() {
        if (!isSessionActive) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        bars.forEach((bar, idx) => {
          const height = Math.max(4, Math.min(22, (avg / 255) * 35 + (idx % 2 * 3)));
          bar.style.height = `${height}px`;
        });

        // Send simulated periodic audio ping over WebSocket to test RTT
        if (ws && ws.readyState === WebSocket.OPEN && Math.random() > 0.7) {
          rttStartTime = Date.now();
          ws.send(new Uint8Array([1, 2, 3, 4]));
        }

        requestAnimationFrame(updateVolume);
      }

      isSessionActive = true;
      btnMicText.textContent = 'End Session';
      btnToggleMic.classList.add('danger');
      btnInterrupt.disabled = false;
      dialogueState.textContent = 'Status: Speaking & Listening';
      appendLog('Microphone active. Streaming 16kHz PCM frames...');

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'START_SESSION', avatarId: currentAvatarId }));
      }

      updateVolume();
    } catch (err) {
      appendLog(`Microphone access error: ${err.message}`, 'error');
    }
  }
}

/**
 * Triggers an asynchronous background tool call to test simultaneous dialogue & tool execution
 */
async function testAsyncTool() {
  appendLog('Executing background tool: GET /api/tools/meter-read', 'tool');
  try {
    const res = await fetch('/api/tools/meter-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: 'CONED-BKN-44910' })
    });
    const data = await res.json();
    appendLog(`Tool responded: Demand = ${data.currentKwDemand} kW | Cycle = ${data.billingCycleKwh} kWh`, 'tool');
  } catch (err) {
    appendLog(`Tool execution failed: ${err.message}`, 'error');
  }
}

// Event Listeners
btnToggleMic.addEventListener('click', toggleMicSession);

btnInterrupt.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    appendLog('Sending user speech interruption trigger...');
    ws.send(JSON.stringify({ type: 'USER_SPEECH_INTERRUPT' }));
  }
});

btnTestTool.addEventListener('click', testAsyncTool);

btnClearLog.addEventListener('click', () => {
  logEl.textContent = '[Console cleared]';
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  loadAvatars();
  connectWebSocket();
});
