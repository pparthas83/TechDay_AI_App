/**
 * Con Edison Tech Day - Stage Controller (Watt AI Moderator)
 */

class StageController {
  constructor(avatarEngine) {
    this.avatar = avatarEngine;
    this.agenda = null;
    this.currentIndex = 0;
    this.audioElement = new Audio();
    this.preloadedAudio = new Map();
    this.isPlaying = false;
    this.isListening = false;
    this.speechRecognition = null;
    this.selectedBackend = 'gecx';
    this.currentSpokenText = '';
    this.sessionId = 'stage-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    // UI Elements
    this.dialogueStream = document.getElementById('dialogue-stream');
    this.dialogueEmptyState = document.getElementById('dialogue-empty-state');
    this.subtitleBox = document.getElementById('subtitle-box');
    this.lowerThird = document.getElementById('lower-third');
    this.speakerName = document.getElementById('speaker-name');
    this.speakerTitle = document.getElementById('speaker-title');
    this.speakerOrg = document.getElementById('speaker-org');
    this.topicBadge = document.getElementById('topic-badge');
    this.micBtn = document.getElementById('mic-btn');
    this.agendaNav = document.getElementById('agenda-nav');

    this.initAudioRouting();
    this.initSpeechRecognition();
    this.loadAgenda();
    this.setupKeyBindings();
  }

  initAudioRouting() {
    this.audioElement.crossOrigin = 'anonymous';

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.avatar) {
        this.avatar.connectAudio(this.audioElement);
        if (this.currentSpokenText) {
          this.avatar.setSpokenText(this.currentSpokenText, this.audioElement);
        }
        this.avatar.isSpeaking = true;
      }
      this.updatePlayState();
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.avatar) {
        this.avatar.isSpeaking = false;
        this.avatar.clearSpokenText();
      }
      this.updatePlayState();
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.avatar) {
        this.avatar.isSpeaking = false;
        this.avatar.clearSpokenText();
      }
      this.updatePlayState();
    });

    this.audioElement.addEventListener('error', (e) => {
      console.warn('[Audio] Failed or blocked playback:', e);
      this.isPlaying = false;
      this.updatePlayState();
    });
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[SpeechRec] Web Speech API not supported in this browser.');
      if (this.micBtn) this.micBtn.style.display = 'none';
      return;
    }

    this.speechRecognition = new SpeechRec();
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = false;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onstart = () => {
      this.isListening = true;
      if (this.micBtn) this.micBtn.classList.add('active');
    };

    this.speechRecognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('[Mic] Transcribed:', transcript);
      await this.askGemini(transcript);
    };

    this.speechRecognition.onend = () => {
      this.isListening = false;
      if (this.micBtn) this.micBtn.classList.remove('active');
    };

    this.speechRecognition.onerror = (e) => {
      console.error('[Mic] Speech rec error:', e);
      this.isListening = false;
      if (this.micBtn) this.micBtn.classList.remove('active');
      if (e.error !== 'no-speech') {
        this.addDialogueMessage('watt', `Microphone note: ${e.error === 'not-allowed' ? 'Microphone permission blocked.' : 'Input was not captured.'} Please try again or type below.`);
      }
    };
  }

  toggleMicrophone() {
    if (!this.speechRecognition) return;
    if (this.isListening) {
      this.speechRecognition.stop();
    } else {
      if (this.isPlaying) this.audioElement.pause();
      try {
        this.speechRecognition.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  }

  async loadAgenda() {
    try {
      const res = await fetch('/api/agenda');
      this.agenda = await res.json();
      console.log('[Agenda] Loaded:', this.agenda.use_cases.length, 'topics');
      this.renderAgendaNav();
      this.preloadAgendaAudio();

      // Check URL hash (e.g. #billing, #weather, #manhole)
      let initialIdx = 0;
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash) {
        const found = this.agenda.use_cases.findIndex(u => u.id.toLowerCase() === hash);
        if (found !== -1) initialIdx = found;
      }
      this.goToTopic(initialIdx, false);
    } catch (e) {
      console.error('[Agenda] Failed to load agenda:', e);
    }
  }

  preloadAgendaAudio() {
    if (!this.agenda || !this.agenda.use_cases) return;
    this.agenda.use_cases.forEach((topic) => {
      if (topic.audio) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = topic.audio;
        this.preloadedAudio.set(topic.number, audio);
      }
    });
    console.log('[Audio] Preloaded', this.preloadedAudio.size, 'agenda audio tracks for instant playback.');
  }

  renderAgendaNav() {
    if (!this.agendaNav || !this.agenda) return;
    this.agendaNav.innerHTML = '';

    const labels = ['INTRO', 'BILLING', 'IDLING', 'MANHOLE', 'WEATHER', 'CLEAN HEAT', 'Q&A'];
    this.agenda.use_cases.forEach((topic, idx) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      const isCleanHeat = idx === 5;
      pill.className = `agenda-pill ${idx === this.currentIndex ? 'active' : ''} ${isCleanHeat ? 'pill-clean-heat' : ''}`;
      pill.setAttribute('data-idx', idx);
      const numStr = idx === 0 ? '00' : idx === 6 ? '06' : `0${idx}`;
      pill.innerHTML = `
        <span class="pill-status-dot"></span>
        <span class="pill-num">${numStr}</span>
        <span class="pill-label">${labels[idx] || topic.id.toUpperCase()}</span>
        <span class="pill-play-icon">▶</span>
      `;
      pill.addEventListener('click', () => {
        if (idx === this.currentIndex) {
          this.togglePlayPause();
        } else {
          this.goToTopic(idx, true);
        }
      });
      this.agendaNav.appendChild(pill);
    });
    this.updatePlayState();
  }

  async goToTopic(index, autoPlay = true) {
    if (!this.agenda || index < 0 || index >= this.agenda.use_cases.length) return;
    this.currentIndex = index;

    const topic = this.agenda.use_cases[index];

    // Update topic header & badge
    if (this.topicBadge) {
      if (index === 0) this.topicBadge.textContent = 'KEYNOTE INTRO';
      else if (index === 6) this.topicBadge.textContent = 'OPEN DISCUSSION';
      else this.topicBadge.textContent = `USE CASE ${index} OF 5`;
    }

    // Update Lower Third
    if (this.lowerThird) {
      this.speakerName.textContent = topic.speaker.name;
      this.speakerTitle.textContent = topic.speaker.title;
      this.speakerOrg.textContent = topic.speaker.organization;
      this.lowerThird.classList.remove('animate-in');
      void this.lowerThird.offsetWidth; // Force CSS reflow
      this.lowerThird.classList.add('animate-in');
    }

    // Update Teleprompter Subtitle
    this.setSubtitle(topic.script, 'script');

    // Immediate visual state sync
    this.updatePlayState();

    // Instant playback from pre-generated audio or live TTS
    if (autoPlay) {
      if (topic.audio) {
        await this.playAudioUrl(topic.audio, topic.script);
      } else {
        await this.speakText(topic.script);
      }
    }
  }

  async playAudioUrl(audioUrl, text) {
    if (this.isPlaying) {
      this.audioElement.pause();
    }

    try {
      this.currentSpokenText = text;
      this.setSubtitle(text, 'speaking');
      if (this.avatar) {
        this.avatar.setSpokenText(text, this.audioElement);
      }
      const fullUrl = audioUrl.startsWith('http') ? audioUrl : window.location.origin + audioUrl;
      if (this.audioElement.src !== fullUrl) {
        this.audioElement.src = fullUrl;
      }
      this.audioElement.currentTime = 0;
      await this.audioElement.play();
    } catch (err) {
      console.warn('[Audio] playAudioUrl direct play failed, falling back to TTS:', err.message);
      this.speakText(text);
    }
  }

  async speakText(text, onPlayCallback = null) {
    if (this.isPlaying) {
      this.audioElement.pause();
    }

    try {
      this.currentSpokenText = text;
      this.setSubtitle(text, 'speaking');
      if (this.avatar) {
        this.avatar.setSpokenText(text, this.audioElement);
      }
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: 'en-US-Neural2-F',
          rate: 1.02
        })
      });

      if (!res.ok) throw new Error(`TTS failed HTTP ${res.status}`);

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      this.audioElement.src = audioUrl;

      if (typeof onPlayCallback === 'function') {
        onPlayCallback();
      }
      await this.audioElement.play();
    } catch (err) {
      console.warn('[TTS] Falling back to Web Speech API:', err.message);
      if (typeof onPlayCallback === 'function') {
        onPlayCallback();
      }
      this.fallbackWebSpeech(text);
    }
  }

  // Play pre-synthesized audio bundled from /api/chat with zero extra network roundtrips
  async playBundledSpeech(text, audioBase64, meta = {}) {
    if (this.isPlaying) {
      this.audioElement.pause();
    }

    try {
      this.currentSpokenText = text;
      this.setSubtitle(text, 'speaking');
      if (this.avatar) {
        this.avatar.setSpokenText(text, this.audioElement);
      }

      // Convert Base64 to Blob URL for clean same-origin Web Audio processing
      const binaryStr = atob(audioBase64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);
      this.audioElement.src = audioUrl;

      // Reveal dialogue bubble in exact lockstep with audio playback initiation
      this.removeThinking();
      this.addDialogueMessage('watt', text, meta);
      await this.audioElement.play();
    } catch (err) {
      console.warn('[Audio] Bundled playback error, falling back:', err.message);
      this.removeThinking();
      this.addDialogueMessage('watt', text, meta);
      this.fallbackWebSpeech(text);
    }
  }

  fallbackWebSpeech(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    this.currentSpokenText = text;

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Zira')) && v.lang.startsWith('en')) || voices[0];
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 1.02;

    utterance.onstart = () => {
      this.isPlaying = true;
      if (this.avatar) {
        this.avatar.setSpokenText(text, null);
        this.avatar.isSpeaking = true;
      }
      this.updatePlayState();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      if (this.avatar) {
        this.avatar.isSpeaking = false;
        this.avatar.clearSpokenText();
      }
      this.updatePlayState();
    };

    window.speechSynthesis.speak(utterance);
  }

  setBackend(backend) {
    this.selectedBackend = 'gecx';
    console.log('[Controller] Intelligence backend set to:', this.selectedBackend);
  }

  addDialogueMessage(role, text, meta = {}) {
    if (!this.dialogueStream) return;

    if (this.dialogueEmptyState) {
      this.dialogueEmptyState.style.display = 'none';
    }

    const bubble = document.createElement('div');
    bubble.className = `dialogue-bubble ${role}`;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const metaTag = role === 'audience' ? 'AUDIENCE' : (meta.sender || 'WATT // AI MODERATOR');
    
    // Construct Badges & Update Conversational Flow Status Bar
    let toolBadge = '';
    const routing = meta.routing || meta.telemetry?.routing;

    if (role === 'watt') {
      const flow = this.getConversationalFlow(routing, meta);
      toolBadge = `<span class="bubble-tool-badge ${flow.type.replace('-flow', '-badge')}">${this.escapeHtml(flow.badge)}</span>`;
      this.updateFlowStatusBar(flow);
    }

    bubble.innerHTML = `
      <div class="bubble-meta">
        <span>${metaTag}</span>
        ${toolBadge}
        <span>${timeStr}</span>
      </div>
      <div class="bubble-text">${this.escapeHtml(text)}</div>
    `;

    this.dialogueStream.appendChild(bubble);
    this.scrollToBottom();
  }

  updateFlowStatusBar(flow) {
    const bar = document.getElementById('chat-flow-statusbar');
    if (!bar) return;

    // Reset modifier classes
    bar.className = `chat-flow-statusbar ${flow.type}`;

    const targetPill = document.getElementById('statusbar-target-pill');
    if (targetPill) {
      targetPill.className = `statusbar-pill target ${flow.targetClass}`;
      targetPill.innerHTML = `<span class="flow-node-icon">${flow.icon}</span> ${this.escapeHtml(flow.targetLabel)}`;
    }

    const modeTag = document.getElementById('statusbar-mode-tag');
    if (modeTag) {
      modeTag.textContent = flow.badge.replace(/^[^a-zA-Z0-9]+/, ''); // e.g. "LIVE TOOL", "CON EDISON DOCS"
    }

    const sentence = document.getElementById('statusbar-sentence');
    if (sentence) {
      sentence.innerHTML = flow.sentence;
    }
  }

  getConversationalFlow(routing, meta) {
    if (routing?.mode === 'TOOL_TRIGGERED' && routing.primaryTool) {
      const tool = routing.primaryTool;
      const toolLabel = this.getFriendlyToolName(tool.displayName || tool.toolName);
      return {
        type: 'tool-flow',
        badge: '⚡ LIVE TOOL',
        icon: '📊',
        targetLabel: toolLabel,
        targetClass: 'target-tool',
        sentence: `<strong>Flow:</strong> Watt is talking to GECX Playbook ➔ Playbook reached out to <strong>${this.escapeHtml(toolLabel)}</strong>`
      };
    } else if (routing?.mode === 'DATASTORE_RAG' || meta?.telemetry?.usedDataStore) {
      return {
        type: 'rag-flow',
        badge: '📚 CON EDISON DOCS',
        icon: '📚',
        targetLabel: 'Official Policy Documents',
        targetClass: 'target-rag',
        sentence: `<strong>Flow:</strong> Watt is talking to GECX Playbook ➔ Playbook checked <strong>Con Edison Official Documents</strong>`
      };
    } else {
      return {
        type: 'direct-flow',
        badge: '🧠 GECX PLAYBOOK',
        icon: '💬',
        targetLabel: 'Conversational Reasoning',
        targetClass: 'target-direct',
        sentence: `<strong>Flow:</strong> Watt is talking to GECX Playbook ➔ Playbook answered via <strong>Conversational Reasoning</strong>`
      };
    }
  }

  getFriendlyToolName(rawName = '') {
    const s = String(rawName).toLowerCase();
    if (s.includes('nyiso') || s.includes('grid')) return 'Live NYISO Grid Telemetry';
    if (s.includes('weather') || s.includes('nws')) return 'National Weather Service';
    if (s.includes('heat') || s.includes('rebate') || s.includes('calc')) return 'Clean Heat Rebate Calculator';
    if (s.includes('outage')) return 'Outage Management System';
    return rawName || 'Enterprise Tool';
  }

  showToolToast(tool) {
    if (!this.chatCard) {
      this.chatCard = document.getElementById('chat-interface-card');
    }
    if (!this.chatCard) return;

    // Remove any existing toast
    const existing = this.chatCard.querySelector('.chat-hud-toast');
    if (existing) existing.remove();

    const toolName = this.getFriendlyToolName(tool.displayName || tool.toolName);
    const toast = document.createElement('div');
    toast.className = 'chat-hud-toast';
    toast.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="tool-pulse-beacon"></span>
        <span>⚡ <strong>Conversational Flow:</strong> Watt is talking to GECX Playbook ➔ Reaching out to <strong>${this.escapeHtml(toolName)}</strong></span>
      </div>
    `;

    this.chatCard.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  showThinking() {
    if (this.avatar && typeof this.avatar.setThinking === 'function') {
      this.avatar.setThinking(true);
    }
    if (!this.dialogueStream) return;
    if (this.dialogueEmptyState) {
      this.dialogueEmptyState.style.display = 'none';
    }
    this.removeThinking();

    // Update Status Bar to active processing mode
    const bar = document.getElementById('chat-flow-statusbar');
    if (bar) {
      bar.className = 'chat-flow-statusbar processing';
      const targetPill = document.getElementById('statusbar-target-pill');
      if (targetPill) {
        targetPill.className = 'statusbar-pill target processing';
        targetPill.innerHTML = '<span class="flow-node-icon">⏳</span> Evaluating Intent & Tools...';
      }
      const modeTag = document.getElementById('statusbar-mode-tag');
      if (modeTag) modeTag.textContent = 'ROUTING';
      const sentence = document.getElementById('statusbar-sentence');
      if (sentence) {
        sentence.innerHTML = 'Watt is consulting <strong>Con Edison GECX Playbook</strong> & evaluating tool routes...';
      }
    }

    const thinkingDiv = document.createElement('div');
    thinkingDiv.id = 'dialogue-thinking-indicator';
    thinkingDiv.className = 'dialogue-thinking';
    thinkingDiv.innerHTML = `
      <span>Watt is consulting GECX Playbook...</span>
      <span class="thinking-dots"><span></span><span></span><span></span></span>
    `;
    this.dialogueStream.appendChild(thinkingDiv);
    this.scrollToBottom();
  }

  removeThinking() {
    if (this.avatar && typeof this.avatar.setThinking === 'function') {
      this.avatar.setThinking(false);
    }
    const existing = document.getElementById('dialogue-thinking-indicator');
    if (existing) existing.remove();
  }

  scrollToBottom() {
    if (this.dialogueStream) {
      this.dialogueStream.scrollTop = this.dialogueStream.scrollHeight;
    }
  }

  escapeHtml(unsafe) {
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async askGemini(promptText) {
    if (!promptText || !promptText.trim()) return;
    const cleanPrompt = promptText.trim();

    try {
      // 1. Render audience question bubble
      this.addDialogueMessage('audience', cleanPrompt);

      // 2. Render thinking status indicator
      this.showThinking();

      // 3. Query GECX backend (returns reply + bundled audioBase64)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          backend: 'gecx',
          sessionId: this.sessionId
        })
      });

      const data = await res.json();

      if (data.reply) {
        const meta = {
          sender: data.backend ? `WATT // ${data.backend.toUpperCase()}` : 'WATT // GECX PLAYBOOK',
          telemetry: data.telemetry,
          routing: data.routing || data.telemetry?.routing
        };

        if (meta.routing?.mode === 'TOOL_TRIGGERED' && meta.routing.primaryTool) {
          this.showToolToast(meta.routing.primaryTool);
        }

        if (data.audioBase64) {
          // Play bundled audio immediately and reveal text in lockstep with speech start
          await this.playBundledSpeech(data.reply, data.audioBase64, meta);
        } else {
          // Fallback if no audio bundled
          await this.speakText(data.reply, () => {
            this.removeThinking();
            this.addDialogueMessage('watt', data.reply, meta);
          });
        }
      } else if (data.error) {
        throw new Error(data.error);
      } else {
        this.removeThinking();
      }
    } catch (err) {
      console.error('[GECX Chat] Query error:', err);
      this.removeThinking();
      this.addDialogueMessage('watt', 'I apologize, I could not complete that query right now.');
    }
  }

  togglePlayPause() {
    if (!this.agenda) return;
    if (this.isPlaying) {
      this.audioElement.pause();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } else {
      const topic = this.agenda.use_cases[this.currentIndex];
      // If paused mid-track on the same topic, resume instantly
      if (this.audioElement.src && !this.audioElement.ended && this.audioElement.currentTime > 0) {
        this.audioElement.play().catch(e => console.warn(e));
      } else if (topic && topic.audio) {
        this.playAudioUrl(topic.audio, topic.script);
      } else if (topic) {
        this.speakText(topic.script);
      }
    }
  }

  nextTopic() {
    if (!this.agenda) return;
    const nextIdx = (this.currentIndex + 1) % this.agenda.use_cases.length;
    this.goToTopic(nextIdx, true);
  }

  prevTopic() {
    if (!this.agenda) return;
    const prevIdx = (this.currentIndex - 1 + this.agenda.use_cases.length) % this.agenda.use_cases.length;
    this.goToTopic(prevIdx, true);
  }

  setSubtitle(text, stateClass = 'idle') {
    if (!this.subtitleBox) return;
    this.subtitleBox.className = `narrative-text ${stateClass}`;
    this.subtitleBox.textContent = text;
  }

  updatePlayState() {
    const wave = document.getElementById('speaking-wave');
    if (wave) wave.classList.toggle('active', this.isPlaying);

    const pills = document.querySelectorAll('.agenda-pill');
    pills.forEach((p, idx) => {
      const isActive = idx === this.currentIndex;
      p.classList.toggle('active', isActive);
      p.classList.toggle('is-playing', isActive && this.isPlaying);
      p.classList.toggle('is-paused', isActive && !this.isPlaying);

      const icon = p.querySelector('.pill-play-icon');
      const labelText = p.querySelector('.pill-label')?.textContent || '';
      if (icon) {
        if (isActive && this.isPlaying) {
          icon.textContent = '❚❚';
          p.title = `Currently Playing: ${labelText}. Click to Pause.`;
        } else if (isActive && !this.isPlaying) {
          icon.textContent = '▶';
          p.title = `Paused: ${labelText}. Click to Resume.`;
        } else {
          icon.textContent = '▶';
          p.title = `Jump to ${labelText} & Play`;
        }
      }
    });
  }

  setupKeyBindings() {
    window.addEventListener('keydown', (e) => {
      // Space or ArrowRight: Next Topic
      if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.code === 'ArrowRight' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.nextTopic();
      } else if (e.code === 'ArrowLeft' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.prevTopic();
      } else if (e.key === 'm' || e.key === 'M') {
        if (e.target.tagName !== 'INPUT') {
          e.preventDefault();
          this.toggleMicrophone();
        }
      } else if (e.key >= '0' && e.key <= '6' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        this.goToTopic(parseInt(e.key), true);
      }
    });
  }
}

window.StageController = StageController;
