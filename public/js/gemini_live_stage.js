/**
 * Con Edison Tech Day - Gemini 3.8 Live Avatar Client Stage Controller
 * 
 * Manages WebSocket communication, microphone capture, avatar synthetic rendering,
 * real-time speech interruption, agenda navigation pills, and conversational flow track.
 */

class GeminiLiveStageController {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isRecording = false;
    this.isSpeaking = false;
    this.currentTopicIndex = 0;
    this.topics = [];

    // Audio Context & Worklet
    this.audioContext = null;
    this.mediaStream = null;
    this.audioInput = null;
    this.audioProcessor = null;

    // Latency Telemetry
    this.lastPingTimestamp = 0;
    this.currentRtt = 14;

    // DOM Elements
    this.dom = {
      canvas: document.getElementById('avatar-canvas-element'),
      speechAura: document.getElementById('avatar-speech-aura'),
      speakingWave: document.getElementById('speaking-wave'),
      flowTrack: document.getElementById('header-flow-track'),
      branchApis: document.getElementById('branch-apis'),
      branchReasoning: document.getElementById('branch-reasoning'),
      branchDatastores: document.getElementById('branch-datastores'),
      topicBadge: document.getElementById('topic-badge'),
      rttElement: document.getElementById('live-rtt-indicator'),
      dialogueStream: document.getElementById('dialogue-stream'),
      dialogueWrapper: document.getElementById('dialogue-stream-wrapper'),
      emptyState: document.getElementById('dialogue-empty-state'),
      chatForm: document.getElementById('chat-form'),
      chatInput: document.getElementById('chat-input'),
      micBtn: document.getElementById('mic-btn'),
      agendaNav: document.getElementById('agenda-nav'),
      interruptBtn: document.getElementById('interrupt-btn')
    };

    this.initCanvasAnimation();
    this.initWebSocket();
    this.bindEvents();
    this.fetchTopics();
  }

  /**
   * Initializes the 2D canvas animation simulating the Gemini 3.8 synthetic avatar
   */
  initCanvasAnimation() {
    if (!this.dom.canvas) return;
    const canvas = this.dom.canvas;
    const ctx = canvas.getContext('2d');

    // Resize canvas to display container
    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    window.addEventListener('resize', resize);
    resize();

    let frame = 0;
    const render = () => {
      frame++;
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const centerX = w / 2;
      const centerY = h * 0.42;

      // Draw futuristic holographic rings & particle field
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const radius = 90 + i * 26 + (this.isSpeaking ? Math.sin(frame * 0.08 + i) * 8 : 0);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = this.isSpeaking 
          ? `rgba(6, 155, 215, ${0.4 - i * 0.1})` 
          : `rgba(0, 85, 150, ${0.25 - i * 0.06})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw Avatar Silhouette / Neural Face representation
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY - 15, 65, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(centerX, centerY - 15, 10, centerX, centerY - 15, 65);
      grad.addColorStop(0, this.isSpeaking ? 'rgba(6, 155, 215, 0.45)' : 'rgba(0, 85, 150, 0.25)');
      grad.addColorStop(1, 'rgba(2, 16, 38, 0.85)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#069BD7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Expressive Eyes (Blurs & Blinks)
      const blink = Math.sin(frame * 0.03) > 0.98;
      const eyeY = centerY - 25;
      const eyeSpacing = 22;

      ctx.fillStyle = '#00e676';
      if (!blink) {
        ctx.beginPath();
        ctx.arc(centerX - eyeSpacing, eyeY, 4, 0, Math.PI * 2);
        ctx.arc(centerX + eyeSpacing, eyeY, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - eyeSpacing - 5, eyeY);
        ctx.lineTo(centerX - eyeSpacing + 5, eyeY);
        ctx.moveTo(centerX + eyeSpacing - 5, eyeY);
        ctx.lineTo(centerX + eyeSpacing + 5, eyeY);
        ctx.stroke();
      }

      // Dynamic Lip-Sync Mouth Curve
      ctx.beginPath();
      ctx.strokeStyle = '#069BD7';
      ctx.lineWidth = 2.5;
      if (this.isSpeaking) {
        const mouthOpen = 4 + Math.abs(Math.sin(frame * 0.25)) * 14;
        ctx.ellipse(centerX, centerY + 18, 16, mouthOpen / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.moveTo(centerX - 14, centerY + 18);
        ctx.quadraticCurveTo(centerX, centerY + 21, centerX + 14, centerY + 18);
        ctx.stroke();
      }

      // SynthID Watermark verification badge on canvas bottom-right
      ctx.font = '10px "SF Mono", monospace';
      ctx.fillStyle = 'rgba(142, 197, 234, 0.4)';
      ctx.fillText('Gemini 3.8 Live Avatar • SynthID Protected', centerX - 110, h - 30);

      ctx.restore();
      requestAnimationFrame(render);
    };

    render();
  }

  /**
   * Initializes WebSocket connection to gemini_live_server.js
   */
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/gemini-live`;
    console.log(`[Gemini Live Client] Connecting to ${wsUrl}...`);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Gemini Live Client] Connected successfully.');
      this.isConnected = true;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerMessage(msg);
      } catch (err) {
        console.error('Failed to parse WebSocket message', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Gemini Live Client] WebSocket disconnected. Reconnecting in 2s...');
      this.isConnected = false;
      setTimeout(() => this.initWebSocket(), 2000);
    };
  }

  /**
   * Handles incoming events from Gemini Live Server
   */
  handleServerMessage(msg) {
    switch (msg.type) {
      case 'FLOW_UPDATE':
        this.updateFlowTrack(msg.stage, msg.toolName);
        break;

      case 'AUDIO_FRAME_ACK':
        if (this.lastPingTimestamp > 0) {
          this.currentRtt = Date.now() - this.lastPingTimestamp;
          if (this.dom.rttElement) {
            this.dom.rttElement.textContent = `${this.currentRtt} ms`;
          }
        }
        break;

      case 'TOOL_RESULT':
        this.renderToolCard(msg.toolName, msg.result);
        break;

      case 'AVATAR_STREAM_START':
        this.startSpeaking(msg.spokenText);
        break;

      case 'INTERRUPTION_CONFIRMED':
        this.stopSpeaking();
        this.appendMessage('system', '⚡ [User Interruption] Avatar speech cancelled immediately.');
        break;
    }
  }

  /**
   * Updates the Conversational Flow Track in Header
   */
  updateFlowTrack(stage, toolName) {
    if (!this.dom.flowTrack) return;

    // Reset branch highlights
    if (this.dom.branchReasoning) this.dom.branchReasoning.classList.remove('active-branch');
    if (this.dom.branchDatastores) this.dom.branchDatastores.classList.remove('active-branch');
    if (this.dom.branchApis) this.dom.branchApis.classList.remove('active-branch');

    if (stage === 'REASONING') {
      this.dom.flowTrack.className = 'header-flow-track active reasoning';
      if (this.dom.branchReasoning) this.dom.branchReasoning.classList.add('active-branch');
    } else if (stage === 'LIVE_APIS') {
      this.dom.flowTrack.className = 'header-flow-track active live-apis';
      if (this.dom.branchApis) this.dom.branchApis.classList.add('active-branch');
    } else if (stage === 'SPEAKING') {
      this.dom.flowTrack.className = 'header-flow-track active speaking';
    } else {
      this.dom.flowTrack.className = 'header-flow-track idle';
    }
  }

  /**
   * Triggers speaking state with aura and visualizer
   */
  startSpeaking(text) {
    this.isSpeaking = true;
    if (this.dom.speechAura) this.dom.speechAura.classList.add('speaking');
    if (this.dom.speakingWave) this.dom.speakingWave.classList.add('active');

    this.appendMessage('watt', text);

    // Speak via browser speech synthesis as local audio channel
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onend = () => this.stopSpeaking();
      utterance.onerror = () => this.stopSpeaking();
      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback timer if speech synthesis is unavailable
      const duration = Math.max(3000, text.length * 50);
      setTimeout(() => this.stopSpeaking(), duration);
    }
  }

  /**
   * Cancels speaking state
   */
  stopSpeaking() {
    this.isSpeaking = false;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.dom.speechAura) this.dom.speechAura.classList.remove('speaking');
    if (this.dom.speakingWave) this.dom.speakingWave.classList.remove('active');
    this.updateFlowTrack('IDLE');
  }

  /**
   * Appends dialogue message to chat feed
   */
  appendMessage(sender, text) {
    if (this.dom.emptyState) {
      this.dom.emptyState.style.display = 'none';
    }

    const item = document.createElement('div');
    item.className = `dialogue-turn turn-${sender}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const senderName = sender === 'watt' ? 'WATT // GEMINI 3.8 LIVE' : (sender === 'user' ? 'YOU' : 'SYSTEM');

    item.innerHTML = `
      <div class="turn-header">
        <span class="turn-sender">${senderName}</span>
        <span class="turn-time">${timestamp}</span>
      </div>
      <div class="turn-body">${text}</div>
    `;

    this.dom.dialogueStream.appendChild(item);
    this.dom.dialogueWrapper.scrollTop = this.dom.dialogueWrapper.scrollHeight;
  }

  /**
   * Renders visual tool result card in chat feed
   */
  renderToolCard(toolName, result) {
    const card = document.createElement('div');
    card.className = 'tool-result-card';

    if (toolName === 'fetch_nyiso_fuel_mix') {
      card.innerHTML = `
        <div class="tool-card-header">⚡ NYISO Real-Time Fuel Mix</div>
        <div class="tool-card-body">
          <p><strong>Zero-Carbon Clean Energy:</strong> ${result.zeroCarbonPercent}%</p>
          <p><strong>Total Generation:</strong> ${result.totalMw?.toLocaleString()} MW</p>
          <div class="tool-meta">Authoritative Feed: mis.nyiso.com (${result.timestamp})</div>
        </div>
      `;
    } else if (toolName === 'fetch_weather_alerts') {
      card.innerHTML = `
        <div class="tool-card-header">🌦️ NWS Weather Advisories</div>
        <div class="tool-card-body">
          <p><strong>Active NYC Alerts:</strong> ${result.alertCount}</p>
          <p>${result.summary}</p>
          <div class="tool-meta">Authoritative Feed: api.weather.gov</div>
        </div>
      `;
    } else if (toolName === 'calculate_clean_heat_rebate') {
      card.innerHTML = `
        <div class="tool-card-header">🏠 Con Edison Clean Heat Sizing & Rebate</div>
        <div class="tool-card-body">
          <p><strong>Estimated Capacity:</strong> ${result.heatPumpTons} Tons (${result.estimatedBtuPerHour?.toLocaleString()} BTU/hr)</p>
          <p><strong>Estimated Total Rebate:</strong> $${result.totalIncentive?.toLocaleString()}</p>
          <p><strong>Annual Fuel Savings:</strong> $${result.estimatedAnnualSavings?.toLocaleString()}/yr</p>
          <div class="preliminary-warning">
            ⚠️ <em>${result.verificationRequirement}</em>
          </div>
        </div>
      `;
    } else if (toolName === 'fetch_coned_outages') {
      card.innerHTML = `
        <div class="tool-card-header">🔌 Con Edison Live Outage Operations</div>
        <div class="tool-card-body">
          <p><strong>Customers Affected:</strong> ${result.customersAffected?.toLocaleString()}</p>
          <p><strong>System Reliability:</strong> ${result.systemReliability}%</p>
          <div class="tool-meta">Authoritative Feed: outagemap.coned.com</div>
        </div>
      `;
    }

    this.dom.dialogueStream.appendChild(card);
    this.dom.dialogueWrapper.scrollTop = this.dom.dialogueWrapper.scrollHeight;
  }

  /**
   * Fetches Keynote Topics and renders Agenda Nav Pills
   */
  async fetchTopics() {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      this.topics = data.topics || [];
      this.renderAgendaPills();
    } catch (err) {
      console.warn('Failed to load topics:', err);
    }
  }

  renderAgendaPills() {
    if (!this.dom.agendaNav) return;
    this.dom.agendaNav.innerHTML = '';

    this.topics.forEach((topic, idx) => {
      const btn = document.createElement('button');
      btn.className = `agenda-pill ${idx === this.currentTopicIndex ? 'active' : ''}`;
      btn.dataset.index = idx;
      btn.innerHTML = `
        <span class="pill-number">${idx + 1}</span>
        <span class="pill-title">${topic.title}</span>
      `;
      btn.addEventListener('click', () => this.selectTopic(idx));
      this.dom.agendaNav.appendChild(btn);
    });
  }

  selectTopic(index) {
    if (index < 0 || index >= this.topics.length) return;
    this.currentTopicIndex = index;

    // Update active pill
    const pills = this.dom.agendaNav.querySelectorAll('.agenda-pill');
    pills.forEach((p, idx) => p.classList.toggle('active', idx === index));

    const topic = this.topics[index];
    if (this.dom.topicBadge) {
      this.dom.topicBadge.textContent = topic.title.toUpperCase();
    }

    this.sendPrompt(topic.prompt, topic.key);
  }

  /**
   * Submits prompt to Gemini Live session
   */
  sendPrompt(promptText, topicKey = 'custom') {
    if (!promptText || !promptText.trim()) return;

    if (this.isSpeaking) {
      this.sendInterrupt();
    }

    this.appendMessage('user', promptText);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastPingTimestamp = Date.now();
      this.ws.send(JSON.stringify({
        type: 'START_PROMPT',
        prompt: promptText,
        topicKey: topicKey,
        timestamp: Date.now()
      }));
    }
  }

  /**
   * Dispatches speech interruption to Gemini Live server
   */
  sendInterrupt() {
    console.log('[Gemini Live Client] Sending interruption request...');
    this.stopSpeaking();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'USER_INTERRUPT',
        timestamp: Date.now()
      }));
    }
  }

  /**
   * Binds UI events & hotkeys
   */
  bindEvents() {
    // Chat Form Submit
    if (this.dom.chatForm) {
      this.dom.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.dom.chatInput.value.trim();
        if (text) {
          this.sendPrompt(text);
          this.dom.chatInput.value = '';
        }
      });
    }

    // Starter Prompt Chips
    document.querySelectorAll('.starter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) this.sendPrompt(prompt);
      });
    });

    // Interruption Button
    if (this.dom.interruptBtn) {
      this.dom.interruptBtn.addEventListener('click', () => this.sendInterrupt());
    }

    // Microphone Toggle
    if (this.dom.micBtn) {
      this.dom.micBtn.addEventListener('click', () => this.toggleMicrophone());
    }

    // Keyboard Hotkeys
    window.addEventListener('keydown', (e) => {
      if (document.activeElement === this.dom.chatInput) return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggleMicrophone();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (this.isSpeaking) {
          this.sendInterrupt();
        } else {
          this.selectTopic(this.currentTopicIndex);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.selectTopic((this.currentTopicIndex + 1) % this.topics.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.selectTopic((this.currentTopicIndex - 1 + this.topics.length) % this.topics.length);
      } else if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        this.selectTopic(idx);
      }
    });
  }

  async toggleMicrophone() {
    if (this.isRecording) {
      this.stopMicrophone();
    } else {
      await this.startMicrophone();
    }
  }

  async startMicrophone() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      this.audioInput = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Simple processor simulating audio streaming frames
      this.audioProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
      this.audioProcessor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert to 16-bit linear PCM
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.lastPingTimestamp = Date.now();
          this.ws.send(pcm16.buffer);
        }
      };

      this.audioInput.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);

      this.isRecording = true;
      if (this.dom.micBtn) this.dom.micBtn.classList.add('recording');
      console.log('[Gemini Live Client] Microphone streaming active (16kHz PCM).');
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      alert('Microphone access unavailable. You can continue interacting via text prompts.');
    }
  }

  stopMicrophone() {
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    if (this.audioInput) {
      this.audioInput.disconnect();
      this.audioInput = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isRecording = false;
    if (this.dom.micBtn) this.dom.micBtn.classList.remove('recording');
    console.log('[Gemini Live Client] Microphone stopped.');
  }
}

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.geminiLiveStage = new GeminiLiveStageController();
});
