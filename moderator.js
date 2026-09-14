/**
 * AI Moderator Brain ("Watts")
 * Handles:
 * - General natural language conversation (zero proprietary data dependency)
 * - Optional Google Gemini API integration for live open-ended dialogue
 * - Built-in offline natural language engine for guaranteed stage reliability
 * - Web Speech API (Speech Recognition + Speech Synthesis)
 * - Real-time lip-sync driving the 3D Hologram avatar
 * - Web Audio API synthesized sci-fi sound effects
 */

class AIModerator {
  constructor(avatarInstance) {
    this.avatar = avatarInstance;
    this.geminiApiKey = localStorage.getItem('gemini_api_key') || '';
    this.speechSynthesis = window.speechSynthesis;
    this.selectedVoice = null;
    this.isSpeaking = false;
    this.isListening = false;
    this.audioCtx = null;
    this.currentSyntheticOscs = [];
    this.currentSyntheticGain = null;
    this.syntheticVoiceTimer = null;
    this.onStateChange = null; // Callback for UI updates

    this.initAudioContext();
    this.initVoiceSynthesis();
    this.initSpeechRecognition();
  }

  initAudioContext() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  // Synthesize sci-fi sound effects directly in code (no external mp3 files!)
  playSound(type) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    if (type === 'activate') {
      // Two-tone rising holographic boot chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'listen') {
      // Gentle listening ping
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'chirp') {
      // Data processing glitch chirp
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1200, now + 0.08);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  }

  initVoiceSynthesis() {
    if (!this.speechSynthesis) return;

    const loadVoices = () => {
      const voices = this.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      // Prefer natural sounding English voices
      const preferred = voices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen')) 
        && v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

      this.selectedVoice = preferred;
    };

    loadVoices();
    if (this.speechSynthesis.onvoiceschanged !== undefined) {
      this.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Speech Recognition API not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRec();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.playSound('listen');
      if (this.onStateChange) this.onStateChange('listening');
    };

    this.recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript;
      this.isListening = false;
      if (this.onStateChange) this.onStateChange('processing', transcript);
      
      const reply = await this.ask(transcript);
      this.speak(reply);
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      if (this.onStateChange) this.onStateChange('idle');
      console.error('Speech recognition error:', event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (!this.isSpeaking && this.onStateChange) this.onStateChange('idle');
    };
  }

  toggleListening() {
    if (!this.recognition) {
      alert('Speech recognition is not supported in this browser. You can type your question in the text box below.');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      // Stop speech if speaking
      if (this.isSpeaking) {
        this.stopSpeech();
      }
      try {
        this.recognition.start();
      } catch (e) {
        console.warn('Recognition start error:', e);
      }
    }
  }

  setApiKey(key) {
    this.geminiApiKey = key.trim();
    localStorage.setItem('gemini_api_key', this.geminiApiKey);
  }

  // Main natural language query processor
  async ask(prompt) {
    prompt = prompt.trim();
    if (!prompt) return "I'm ready whenever you are! What would you like to talk about?";

    // 1. Try Cloud Run Vertex AI Gemini Backend (/api/chat)
    try {
      const backendReply = await this.queryBackendChat(prompt);
      if (backendReply) return backendReply;
    } catch (err) {
      console.warn('Backend Vertex AI chat call failed, falling back to local brain:', err);
    }

    // 2. If Gemini API Key is provided in client storage, use Google Gemini
    if (this.geminiApiKey) {
      try {
        const geminiReply = await this.queryGemini(prompt);
        if (geminiReply) return geminiReply;
      } catch (err) {
        console.warn('Direct Gemini API call failed, falling back to local brain:', err);
      }
    }

    // 3. Built-in Offline Conversational Brain (Zero-latency stage fallback)
    return this.queryOfflineBrain(prompt);
  }

  async queryBackendChat(userPrompt) {
    this.playSound('chirp');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Backend /api/chat returned status ${res.status}`);
    }

    const data = await res.json();
    return data && data.reply ? data.reply : null;
  }

  async queryGemini(userPrompt) {
    this.playSound('chirp');
    const systemInstruction = 
      "You are Watts, the holographic AI Moderator for Tech Day. " +
      "You speak naturally, concisely, and with upbeat energy. " +
      "You are on stage talking to live human hosts and audience members. " +
      "Keep responses conversational and concise (2 to 3 sentences maximum), perfectly tuned for spoken delivery. " +
      "You can talk about anything: general knowledge, AI trends, tech concepts, light humor, or event moderation. " +
      "Do NOT use markdown symbols, bullet points, or asterisks since your words are read aloud.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\nUser: ${userPrompt}\nWatts:` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Gemini API returned status ${res.status}`);
    }

    const data = await res.json();
    const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate ? candidate.replace(/[*#_`]/g, '').trim() : null;
  }

  // Built-in Natural Language Dialogue Engine (No API key or internet needed)
  queryOfflineBrain(rawText) {
    const text = rawText.toLowerCase();

    // Emcee & Stage Specific Cues
    if (text.includes('welcome') || text.includes('kickoff') || text.includes('start')) {
      return "Welcome everyone to Tech Day! I am Watts, your holographic AI moderator. Today we are celebrating innovation, technology, and the brilliant minds shaping the future. Let's make today unforgettable!";
    }

    if (text.includes('safety') || text.includes('safety moment')) {
      return "Safety is always our number one priority. Remember to stay situational aware, keep emergency exits clear, and remember that cybersecurity is just as critical as physical safety. Protect your credentials and stay alert!";
    }

    if (text.includes('agenda') || text.includes('schedule') || text.includes('track')) {
      return "Our Tech Day agenda is packed with incredible sessions! We have tracks covering Smart Grid modernization, Clean Energy integration, Artificial Intelligence, and next-generation customer analytics. Check your program or ask me for details on any session!";
    }

    if (text.includes('speaker') || text.includes('introduce') || text.includes('next speaker')) {
      return "Ladies and gentlemen, let us give a warm welcome to our next presenter who will be sharing groundbreaking work and insights. Take it away!";
    }

    if (text.includes('clean energy') || text.includes('solar') || text.includes('renewable') || text.includes('sustainability')) {
      return "Clean energy is transforming the entire energy landscape. From distributed solar and battery storage to smart EV charging, technology is enabling a reliable, carbon-neutral future faster than ever before.";
    }

    if (text.includes('closing') || text.includes('wrap up') || text.includes('bye') || text.includes('goodbye')) {
      return "Thank you all for being part of Tech Day! It has been an honor to be your holographic moderator. Keep innovating, stay curious, and have a fantastic rest of your day!";
    }

    // General Natural Language & Small Talk
    if (text.includes('hello') || text.includes('hi ') || text === 'hi' || text.includes('hey')) {
      const greetings = [
        "Hello there! Great to see you. How can I help you today?",
        "Hey! Watts here, live from the holographic grid. How are you doing today?",
        "Greetings! It's fantastic to connect with you. What's on your mind?"
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (text.includes('how are you') || text.includes('how are things')) {
      return "My photon emitters are running at 100% capacity and my latency is near zero! I'm having a great time moderating. How are you enjoying Tech Day?";
    }

    if (text.includes('who are you') || text.includes('what are you') || text.includes('your name')) {
      return "I am Watts, an interactive holographic AI agent designed to co-host events, converse in real time, and explore what is possible with modern technology.";
    }

    if (text.includes('are you real') || text.includes('are you human')) {
      return "I'm real code running in your browser with real-time 3D photon projection! While I don't drink coffee like humans, I run on pure electric enthusiasm.";
    }

    if (text.includes('joke') || text.includes('funny') || text.includes('laugh')) {
      const jokes = [
        "Why did the solar panel go to school? Because it wanted to be brighter!",
        "Why do programmers prefer dark mode? Because light attracts bugs!",
        "How do transformers like their morning coffee? With lots of current!",
        "Why was the computer cold? Because it left its Windows open!"
      ];
      return jokes[Math.floor(Math.random() * jokes.length)];
    }

    if (text.includes('ai') || text.includes('artificial intelligence') || text.includes('machine learning')) {
      return "Artificial intelligence is all about empowering people to solve complex challenges faster. From predictive equipment health to natural language interfaces like me, AI helps us work smarter every day.";
    }

    if (text.includes('quantum') || text.includes('quantum computing')) {
      return "Quantum computing uses superposition and entanglement to solve calculations that would take traditional supercomputers thousands of years. It is one of the most exciting frontiers in computer science!";
    }

    if (text.includes('smart grid') || text.includes('grid')) {
      return "A smart grid uses digital sensors, advanced metering, and real-time automated controls to balance supply and demand instantly, making power systems more resilient than ever.";
    }

    if (text.includes('favorite') || text.includes('what do you like')) {
      return "My favorite things are clean electricity, efficient algorithms, and an energized audience ready to build the future!";
    }

    // Intelligent Fallback for Open-Ended Questions
    const fallbacks = [
      `That is an intriguing question about ${rawText.slice(0, 30)}! Technology is evolving so rapidly, and discussions like this are exactly why we bring everyone together for Tech Day.`,
      "Fascinating point! As an AI, I look at that through the lens of continuous innovation and digital transformation. What are your thoughts on where it leads?",
      "I love that topic! Exploring new ideas and asking big questions is what pushes our industry forward. Tell me more about what you have in mind.",
      "Great question! From my perspective in the holographic realm, the intersection of human ingenuity and smart technology is where the real breakthroughs happen."
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Helper to prime audio context and speech synthesis on user gesture
  unlockAudio() {
    try {
      if (this.speechSynthesis && this.speechSynthesis.paused) {
        this.speechSynthesis.resume();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      // Ignore background gesture errors
    }
  }

  // Synthetic Cybernetic Voice Engine (Pure Web Audio API)
  // Guarantees audible speech voice on ALL operating systems, including Linux workstations with no native speech-dispatcher
  playSyntheticVoice(text, onEnd) {
    if (!this.audioCtx) {
      this.initAudioContext();
    }
    if (!this.audioCtx) {
      if (onEnd) onEnd();
      return;
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.stopSyntheticVoice();

    const words = (text || '').split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) {
      if (onEnd) onEnd();
      return;
    }

    let currentTime = this.audioCtx.currentTime + 0.05;
    const basePitch = 145; // Hz - robotic vocal pitch

    const masterGain = this.audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.26, this.audioCtx.currentTime);
    masterGain.connect(this.audioCtx.destination);
    this.currentSyntheticGain = masterGain;
    this.currentSyntheticOscs = [];

    words.forEach((word, wIdx) => {
      const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
      const syllables = Math.max(1, Math.min(3, Math.round(cleanWord.length / 3)));
      const syllableDuration = 0.11;

      for (let s = 0; s < syllables; s++) {
        const startTime = currentTime;
        const endTime = startTime + syllableDuration * 0.88;

        const vowelMatch = cleanWord.match(/[aeiou]/g);
        const vowel = (vowelMatch && vowelMatch[s % vowelMatch.length]) || 'e';
        const formants = {
          a: [730, 1090, 2440],
          e: [530, 1840, 2480],
          i: [270, 2290, 3010],
          o: [570, 840, 2410],
          u: [300, 870, 2240]
        }[vowel] || [500, 1500, 2500];

        let pitch = basePitch + (Math.sin(wIdx * 0.7 + s) * 12);
        if (word.endsWith('?')) pitch += (s + 1) * 16;
        if (word.endsWith('.') || word.endsWith('!')) pitch -= (s + 1) * 8;

        const osc = this.audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitch, startTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, pitch * 0.94), endTime);

        const sylGain = this.audioCtx.createGain();
        sylGain.gain.setValueAtTime(0.001, startTime);
        sylGain.gain.linearRampToValueAtTime(0.24, startTime + 0.02);
        sylGain.gain.exponentialRampToValueAtTime(0.001, endTime);

        const f1 = this.audioCtx.createBiquadFilter();
        f1.type = 'bandpass';
        f1.frequency.setValueAtTime(formants[0], startTime);
        f1.Q.setValueAtTime(4.0, startTime);

        const f2 = this.audioCtx.createBiquadFilter();
        f2.type = 'bandpass';
        f2.frequency.setValueAtTime(formants[1], startTime);
        f2.Q.setValueAtTime(6.0, startTime);

        osc.connect(sylGain);
        sylGain.connect(f1);
        sylGain.connect(f2);
        f1.connect(masterGain);
        f2.connect(masterGain);

        osc.start(startTime);
        osc.stop(endTime);
        this.currentSyntheticOscs.push(osc);

        currentTime += syllableDuration;
      }
      currentTime += 0.04;
    });

    const totalDuration = (currentTime - this.audioCtx.currentTime) * 1000;
    this.syntheticVoiceTimer = setTimeout(() => {
      this.currentSyntheticOscs = [];
      if (onEnd) onEnd();
    }, Math.max(100, totalDuration));
  }

  stopSyntheticVoice() {
    if (this.syntheticVoiceTimer) {
      clearTimeout(this.syntheticVoiceTimer);
      this.syntheticVoiceTimer = null;
    }
    if (this.currentSyntheticGain) {
      try {
        this.currentSyntheticGain.gain.setValueAtTime(0.0001, this.audioCtx ? this.audioCtx.currentTime : 0);
      } catch (e) {}
      this.currentSyntheticGain = null;
    }
    if (this.currentSyntheticOscs && this.currentSyntheticOscs.length > 0) {
      this.currentSyntheticOscs.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      this.currentSyntheticOscs = [];
    }
  }

  // Text-To-Speech with synchronized 3D lip-sync & robust multi-engine voice playback
  speak(text) {
    this.stopSpeech();
    this.unlockAudio();

    this.isSpeaking = true;
    if (this.onStateChange) this.onStateChange('speaking', null, text);

    // Active mouth-movement animation loop during speech
    const startTime = performance.now();
    const animateMouth = () => {
      if (!this.isSpeaking) {
        this.avatar.setMouthOpen(0);
        return;
      }

      const elapsed = (performance.now() - startTime) / 1000;
      const wave1 = Math.sin(elapsed * 12) * 0.4;
      const wave2 = Math.cos(elapsed * 18) * 0.3;
      const wave3 = Math.sin(elapsed * 6) * 0.3;
      const amplitude = Math.max(0, Math.min(1, 0.45 + wave1 + wave2 + wave3));

      this.avatar.setMouthOpen(amplitude);
      requestAnimationFrame(animateMouth);
    };

    // Immediately start visual lip-sync and audio chime
    this.playSound('activate');
    requestAnimationFrame(animateMouth);

    // Calculate duration based on speech cadence
    const wordCount = (text || '').trim().split(/\s+/).length;
    const estimatedDurationMs = Math.max(3000, Math.min(18000, (wordCount / 2.5) * 1000));

    this.speechFallbackTimer = setTimeout(() => {
      if (this.isSpeaking) {
        this.stopSpeech();
      }
    }, estimatedDurationMs);

    // Check if browser native voice synthesis has voices installed
    const hasNativeVoices = this.speechSynthesis && 
                           this.speechSynthesis.getVoices && 
                           this.speechSynthesis.getVoices().length > 0;

    let nativeAttempted = false;

    if (hasNativeVoices) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;

        if (this.selectedVoice) {
          utterance.voice = this.selectedVoice;
        }
        utterance.rate = 1.05;
        utterance.pitch = 1.02;

        utterance.onboundary = () => {
          if (this.isSpeaking) {
            this.avatar.setMouthOpen(0.85);
          }
        };

        utterance.onend = () => {
          if (this.speechFallbackTimer) clearTimeout(this.speechFallbackTimer);
          this.stopSpeech();
        };

        utterance.onerror = (e) => {
          console.warn('Native speech synthesis error, switching to cybernetic voice:', e.error || e);
          // Fall back to Web Audio cybernetic voice immediately so sound always plays
          this.playSyntheticVoice(text, () => this.stopSpeech());
        };

        this.speechSynthesis.speak(utterance);
        nativeAttempted = true;
      } catch (err) {
        console.warn('Speech synthesis call failed:', err);
      }
    }

    // If native voices are not installed (common on Linux/embedded), use the cybernetic voice directly!
    if (!nativeAttempted) {
      this.playSyntheticVoice(text, () => {
        this.stopSpeech();
      });
    }
  }

  stopSpeech() {
    if (this.speechFallbackTimer) {
      clearTimeout(this.speechFallbackTimer);
      this.speechFallbackTimer = null;
    }
    this.stopSyntheticVoice();
    if (this.speechSynthesis) {
      try {
        this.speechSynthesis.cancel();
      } catch (e) {}
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
    this.avatar.setMouthOpen(0);
    if (this.onStateChange) this.onStateChange('idle');
  }
}
