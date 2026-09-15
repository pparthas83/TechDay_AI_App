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

    // UI Elements
    this.subtitleBox = document.getElementById('subtitle-box');
    this.lowerThird = document.getElementById('lower-third');
    this.speakerName = document.getElementById('speaker-name');
    this.speakerTitle = document.getElementById('speaker-title');
    this.speakerOrg = document.getElementById('speaker-org');
    this.topicBadge = document.getElementById('topic-badge');
    this.topicTitle = document.getElementById('topic-title');
    this.micBtn = document.getElementById('mic-btn');
    this.playBtn = document.getElementById('play-btn');
    this.prevBtn = document.getElementById('prev-btn');
    this.nextBtn = document.getElementById('next-btn');
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
        this.avatar.isSpeaking = true;
      }
      this.updatePlayState();
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.avatar) {
        this.avatar.isSpeaking = false;
      }
      this.updatePlayState();
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.avatar) {
        this.avatar.isSpeaking = false;
      }
      this.updatePlayState();
    });
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Speech Recognition not available in this browser');
      return;
    }

    this.speechRecognition = new SpeechRec();
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = false;
    this.speechRecognition.lang = 'en-US';

    this.speechRecognition.onstart = () => {
      this.isListening = true;
      if (this.micBtn) this.micBtn.classList.add('active');
      this.setSubtitle('Listening for audience question...', 'listening');
    };

    this.speechRecognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('[Mic] Transcribed:', transcript);
      this.setSubtitle(`Audience: "${transcript}"`, 'question');
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
      pill.className = `agenda-pill ${idx === this.currentIndex ? 'active' : ''}`;
      const numStr = idx === 0 ? '00' : idx === 6 ? '06' : `0${idx}`;
      pill.innerHTML = `<span class="pill-num">${numStr}</span> <span class="pill-label">${labels[idx] || topic.id.toUpperCase()}</span>`;
      pill.addEventListener('click', () => this.goToTopic(idx, true));
      this.agendaNav.appendChild(pill);
    });
  }

  async goToTopic(index, autoPlay = true) {
    if (!this.agenda || index < 0 || index >= this.agenda.use_cases.length) return;
    this.currentIndex = index;

    const topic = this.agenda.use_cases[index];

    // Update nav pills
    const pills = document.querySelectorAll('.agenda-pill');
    pills.forEach((p, idx) => p.classList.toggle('active', idx === index));

    // Update topic header & badge
    if (this.topicBadge) {
      if (index === 0) this.topicBadge.textContent = 'KEYNOTE INTRO';
      else if (index === 6) this.topicBadge.textContent = 'OPEN DISCUSSION';
      else this.topicBadge.textContent = `USE CASE ${index} OF 5`;
    }

    if (this.topicTitle) {
      this.topicTitle.textContent = topic.title;
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
      this.setSubtitle(text, 'speaking');
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

  async speakText(text) {
    if (this.isPlaying) {
      this.audioElement.pause();
    }

    try {
      this.setSubtitle(text, 'speaking');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: 'en-US-Journey-F',
          rate: 0.88
        })
      });

      if (!res.ok) throw new Error(`TTS failed HTTP ${res.status}`);

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      this.audioElement.src = audioUrl;
      await this.audioElement.play();
    } catch (err) {
      console.warn('[TTS] Falling back to Web Speech API:', err.message);
      this.fallbackWebSpeech(text);
    }
  }

  fallbackWebSpeech(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Zira')) && v.lang.startsWith('en')) || voices[0];
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 0.88;

    utterance.onstart = () => {
      this.isPlaying = true;
      if (this.avatar) this.avatar.isSpeaking = true;
      this.updatePlayState();
    };

    utterance.onend = () => {
      this.isPlaying = false;
      if (this.avatar) this.avatar.isSpeaking = false;
      this.updatePlayState();
    };

    window.speechSynthesis.speak(utterance);
  }

  setBackend(backend) {
    this.selectedBackend = 'gecx';
    console.log('[Controller] Intelligence backend set to:', this.selectedBackend);
  }

  async askGemini(promptText) {
    try {
      this.setSubtitle('Watt is consulting GECX Playbook...', 'thinking');
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          backend: 'gecx'
        })
      });

      const data = await res.json();
      if (data.reply) {
        this.setSubtitle(data.reply, 'speaking');
        await this.speakText(data.reply);
      } else if (data.error) {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('[GECX Chat] Query error:', err);
      this.setSubtitle('I apologize, I could not complete that query right now.', 'error');
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
    if (!this.playBtn) return;
    this.playBtn.innerHTML = this.isPlaying 
      ? '<span class="play-icon">❚❚</span> Pause' 
      : '<span class="play-icon">▶</span> Play';
    this.playBtn.title = this.isPlaying ? 'Pause Presentation' : 'Play Presentation';
    const wave = document.getElementById('speaking-wave');
    if (wave) wave.classList.toggle('active', this.isPlaying);
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
