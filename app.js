/**
 * Main App Controller
 * Integrates 3D Hologram Avatar, AI Moderator, Audio Visualizer, and Stage UI
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Hologram & Moderator
  const avatar = new HologramAvatar('canvas-container');
  const moderator = new AIModerator(avatar);
  window.avatar = avatar;
  window.moderator = moderator;

  // DOM Elements
  const micBtn = document.getElementById('mic-btn');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const subtitleBox = document.getElementById('subtitle-box');
  const avatarStatus = document.getElementById('avatar-status');
  const stageModeBtn = document.getElementById('stage-mode-btn');
  const exitStageBtn = document.getElementById('exit-stage-btn');
  const waveCanvas = document.getElementById('wave-canvas');
  const waveCtx = waveCanvas ? waveCanvas.getContext('2d') : null;

  // Initialize Waveform Canvas dimensions
  if (waveCanvas) {
    waveCanvas.width = 320;
    waveCanvas.height = 40;
  }

  // Moderator State Callback
  moderator.onStateChange = (state, userInput, avatarSpeech) => {
    if (state === 'listening') {
      micBtn.classList.add('listening');
      avatarStatus.textContent = 'LISTENING...';
      avatarStatus.style.color = '#ff5252';
      subtitleBox.classList.remove('idle');
      subtitleBox.textContent = 'Listening to your voice...';
    } else if (state === 'processing') {
      micBtn.classList.remove('listening');
      avatarStatus.textContent = 'THINKING...';
      avatarStatus.style.color = '#ffb300';
      subtitleBox.textContent = `"${userInput}"`;
    } else if (state === 'speaking') {
      micBtn.classList.remove('listening');
      avatarStatus.textContent = 'SPEAKING';
      avatarStatus.style.color = '#00e676';
      subtitleBox.classList.remove('idle');
      subtitleBox.textContent = avatarSpeech;
    } else if (state === 'idle') {
      micBtn.classList.remove('listening');
      avatarStatus.textContent = 'ONLINE / READY';
      avatarStatus.style.color = '#a7ffeb';
      if (!moderator.isSpeaking) {
        setTimeout(() => {
          if (!moderator.isSpeaking && !moderator.isListening) {
            subtitleBox.classList.add('idle');
            subtitleBox.textContent = 'Click the microphone or type below to speak with Watts';
          }
        }, 8000);
      }
    }
  };

  // Prime audio on any initial user gesture anywhere on page
  const primeAudio = () => {
    moderator.unlockAudio();
  };
  window.addEventListener('click', primeAudio, { passive: true });
  window.addEventListener('keydown', primeAudio, { passive: true });
  window.addEventListener('touchstart', primeAudio, { passive: true });

  // Mic Toggle Action
  micBtn.addEventListener('click', () => {
    moderator.unlockAudio();
    moderator.toggleListening();
  });

  // Text Send Action
  async function handleSendText() {
    const text = (chatInput.value || '').trim();
    if (!text) return;
    chatInput.value = '';

    // Prime audio context synchronously on user interaction
    moderator.unlockAudio();
    moderator.playSound('chirp');

    // Button click animation feedback
    if (sendBtn) {
      sendBtn.style.transform = 'scale(0.85)';
      setTimeout(() => { sendBtn.style.transform = ''; }, 150);
    }

    avatarStatus.textContent = 'THINKING...';
    avatarStatus.style.color = '#ffb300';
    subtitleBox.classList.remove('idle');
    subtitleBox.textContent = `"${text}"`;

    try {
      const reply = await moderator.ask(text);
      if (reply) {
        moderator.speak(reply);
      }
    } catch (err) {
      console.error('Error getting reply:', err);
      avatarStatus.textContent = 'ONLINE / READY';
      avatarStatus.style.color = '#a7ffeb';
    }
  }

  // Handle Form Submission (Enter key, button click, virtual keyboard)
  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      moderator.unlockAudio();
      handleSendText();
    });
  }

  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    moderator.unlockAudio();
    handleSendText();
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      moderator.unlockAudio();
      handleSendText();
    }
  });

  // STAGE MODE TOGGLE
  function enterStageMode() {
    document.body.classList.add('stage-mode');
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function exitStageMode() {
    document.body.classList.remove('stage-mode');
    if (document.exitFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  if (stageModeBtn) stageModeBtn.addEventListener('click', enterStageMode);
  if (exitStageBtn) exitStageBtn.addEventListener('click', exitStageMode);

  // Check URL query parameters for stage mode (e.g. ?stage=true)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('stage') === 'true' || urlParams.get('stage') === '1') {
    enterStageMode();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('stage-mode')) {
      exitStageMode();
    }
    // Spacebar to toggle mic if not focused in an input
    if (e.code === 'Space' && document.activeElement !== chatInput) {
      e.preventDefault();
      moderator.toggleListening();
    }
  });

  // Real-time Audio Waveform Visualizer Loop
  function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    if (!waveCtx) return;

    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);

    const isSpeaking = moderator.isSpeaking;
    const isListening = moderator.isListening;
    const theme = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#00e5ff';

    const barCount = 32;
    const barWidth = 4;
    const spacing = (waveCanvas.width - barCount * barWidth) / (barCount - 1);
    const time = performance.now() * 0.005;

    for (let i = 0; i < barCount; i++) {
      let height = 4; // Base idle height
      if (isSpeaking) {
        height = 6 + Math.abs(Math.sin(time * 2 + i * 0.35)) * 26 * (avatar.mouthOpen + 0.3);
      } else if (isListening) {
        height = 6 + Math.abs(Math.cos(time * 3 + i * 0.2)) * 18;
      }

      const x = i * (barWidth + spacing);
      const y = (waveCanvas.height - height) / 2;

      waveCtx.fillStyle = isListening ? '#ff5252' : theme;
      waveCtx.shadowColor = isListening ? '#ff5252' : theme;
      waveCtx.shadowBlur = 8;
      waveCtx.fillRect(x, y, barWidth, height);
    }
  }

  drawWaveform();
});
