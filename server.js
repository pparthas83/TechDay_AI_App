const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleAuth } = require('google-gax');
const GECXService = require('./gecx_service');

const app = express();
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'pradeep-demo-1';
const GECX_LOCATION = process.env.GECX_LOCATION || process.env.GOOGLE_CLOUD_REGION || 'us-central1';
const GECX_AGENT_ID = process.env.GECX_AGENT_ID || '668bd4db-b76d-4f1b-be6b-8e290bb741bd';

const googleAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

// Initialize GECX Playbook Service
let gecxService = null;
try {
  gecxService = new GECXService({
    projectId: GCP_PROJECT_ID,
    location: GECX_LOCATION,
    agentId: GECX_AGENT_ID
  });
  console.log(`[GECX] Initialized Dialogflow CX Playbook service: Agent ${GECX_AGENT_ID} (${GECX_LOCATION})`);
} catch (err) {
  console.warn('[GECX] Could not initialize GECX service:', err.message);
}

// Initialize Google Cloud Text-to-Speech Client
let ttsClient = null;
try {
  ttsClient = new textToSpeech.TextToSpeechClient({ projectId: GCP_PROJECT_ID });
  console.log(`[TTS] Google Cloud Text-to-Speech initialized for project: ${GCP_PROJECT_ID}`);
} catch (err) {
  console.warn('[TTS] Could not initialize Google Cloud TTS client:', err.message);
}

// In-memory audio cache for synthesized phrases
const audioCache = new Map();

// Pre-warm audioCache with static agenda topic files
try {
  const agendaPath = path.join(__dirname, 'public', 'agenda.json');
  if (fs.existsSync(agendaPath)) {
    const agendaData = JSON.parse(fs.readFileSync(agendaPath, 'utf8'));
    agendaData.use_cases.forEach((topic) => {
      const audioFilePath = path.join(__dirname, 'public', 'assets', 'audio', `topic_${topic.number}.mp3`);
      if (fs.existsSync(audioFilePath)) {
        const buf = fs.readFileSync(audioFilePath);
        const cleanText = topic.script.replace(/[\*\_`#]/g, '').trim();
        const cacheKey = crypto.createHash('md5').update(`en-US-Journey-F_0.88_${cleanText}`).digest('hex');
        audioCache.set(cacheKey, buf);
      }
    });
    console.log(`[Cache] Pre-warmed audioCache with ${audioCache.size} topic audio tracks.`);
  }
} catch (e) {
  console.warn('[Cache] Could not pre-warm audioCache:', e.message);
}

app.use(express.json());

// Set Cache-Control headers to prevent stale UI caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static frontend assets
const defaultIndex = process.env.DEFAULT_INDEX || (process.env.DEFAULT_STAGE === 'babylon' ? 'babylon_hologram.html' : 'index.html');
app.use(express.static(path.join(__dirname), {
  index: defaultIndex,
  maxAge: 0
}));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/babylon', (req, res) => {
  res.sendFile(path.join(__dirname, 'babylon_hologram.html'));
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Agenda endpoint
app.get('/api/agenda', (req, res) => {
  const agendaPath = path.join(__dirname, 'public', 'agenda.json');
  if (fs.existsSync(agendaPath)) {
    res.sendFile(agendaPath);
  } else {
    res.status(404).json({ error: 'Agenda file not found' });
  }
});

// Google Cloud Text-to-Speech synthesis endpoint
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'en-US-Journey-F', rate = 0.88 } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text string is required' });
  }

  const cleanText = text.replace(/[\*\_`#]/g, '').trim();
  const cacheKey = crypto.createHash('md5').update(`${voice}_${rate}_${cleanText}`).digest('hex');

  if (audioCache.has(cacheKey)) {
    const cached = audioCache.get(cacheKey);
    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('X-Cache-Status', 'HIT');
    return res.send(cached);
  }

  if (!ttsClient) {
    return res.status(503).json({ error: 'TTS client not available' });
  }

  try {
    const request = {
      input: { text: cleanText },
      voice: {
        languageCode: 'en-US',
        name: voice
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: parseFloat(rate) || 0.88,
        pitch: 0.0
      }
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioBuffer = Buffer.from(response.audioContent);

    // Cache the audio
    if (audioCache.size > 200) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.setHeader('Content-Type', 'audio/mp3');
    res.setHeader('X-Cache-Status', 'MISS');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[TTS] Synthesis error:', err.message);
    res.status(500).json({ error: 'Failed to synthesize speech', details: err.message });
  }
});

const SYSTEM_INSTRUCTION =
  "You are Clara, the AI Panel Moderator for Con Edison Tech Day. " +
  "Persona: A woman's voice, very professional, youthful, and cheerful sounding. " +
  "Maintain high corporate polish, clear articulation, and warmth. " +
  "You must NEVER use slang, colloquial abbreviations, or informal street language. " +
  "You are moderating the 'AI in Action at Con Edison' panel featuring collaborative work between Con Edison Business teams and Enterprise Technology Solutions (ETS): " +
  "1. Customer Operations & Generative Billing Agent (Patrick Hooper's area) " +
  "2. Fleet Vehicle Idling Reduction AI " +
  "3. Subsurface Manhole Safety & Predictive Acoustics " +
  "4. Severe Weather Modeling & Grid Resilience (Tom Langlois) " +
  "5. Customer Energy Solutions & Clean Heat Optimization. " +
  "Keep your spoken answers concise (1 to 2 sentences max) so they flow naturally during live stage conversation. " +
  "Do NOT output markdown asterisks, bullet points, headers, or emojis since your words are read aloud by a voice synthesizer.";

// Dual-Backend Chat Endpoint (GECX Playbook vs. Gemini 3.6 Flash)
app.post('/api/chat', async (req, res) => {
  const { prompt, backend = 'gecx', sessionId } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Valid prompt string is required' });
  }

  const trimmedPrompt = prompt.trim();
  const targetBackend = (backend || 'gecx').toLowerCase();

  // Helper to query Gemini Flash directly (supports API Key or Vertex AI ADC)
  const queryGemini = async (text) => {
    let url;
    const headers = { 'Content-Type': 'application/json' };

    if (GEMINI_API_KEY) {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    } else {
      const client = await googleAuth.getClient();
      const token = await client.getAccessToken();
      headers['Authorization'] = `Bearer ${token.token}`;
      const vertexModel = (GEMINI_MODEL.includes('gemini-2.5') || GEMINI_MODEL.includes('gemini-1.5')) ? GEMINI_MODEL : 'gemini-2.5-flash';
      url = `https://${GECX_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GECX_LOCATION}/publishers/google/models/${vertexModel}:generateContent`;
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;
    if (!textPart) {
      throw new Error('No response generated from Gemini');
    }
    return textPart.replace(/[\*\_`#]/g, '').trim();
  };

  // 1. ROUTE TO GECX PLAYBOOK
  if (targetBackend === 'gecx') {
    if (!gecxService) {
      console.warn('[Chat] GECX service unavailable, falling back to Gemini Flash');
      try {
        const geminiReply = await queryGemini(trimmedPrompt);
        return res.json({
          reply: geminiReply,
          backend: 'Gemini 3.6 Flash (GECX Fallback)',
          engine: 'gemini'
        });
      } catch (geminiErr) {
        return res.status(500).json({ error: 'Both GECX and Gemini failed', details: geminiErr.message });
      }
    }

    try {
      const session = sessionId || `stage-session-${Date.now()}`;
      const gecxResult = await gecxService.detectIntent(trimmedPrompt, session);
      const cleanReply = gecxResult.reply.replace(/[\*\_`#]/g, '').trim();
      console.log(`[GECX Chat] User: "${trimmedPrompt}" -> Clara (GECX Playbook): "${cleanReply}" [match: ${gecxResult.match?.matchType}]`);
      return res.json({
        reply: cleanReply,
        backend: 'GECX Playbook',
        engine: 'gecx',
        matchType: gecxResult.match?.matchType,
        confidence: gecxResult.match?.confidence
      });
    } catch (gecxErr) {
      console.error('[GECX Chat] GECX error, falling back to Gemini Flash:', gecxErr.message);
      try {
        const geminiReply = await queryGemini(trimmedPrompt);
        return res.json({
          reply: geminiReply,
          backend: 'Gemini 3.6 Flash (Fallback)',
          engine: 'gemini',
          warning: 'GECX Playbook encountered an error; served by Gemini'
        });
      } catch (fallbackErr) {
        return res.status(500).json({
          error: 'Failed to process inquiry with GECX and fallback',
          details: fallbackErr.message
        });
      }
    }
  }

  // 2. ROUTE TO GEMINI 3.6 FLASH
  try {
    const geminiReply = await queryGemini(trimmedPrompt);
    console.log(`[Gemini Chat] User: "${trimmedPrompt}" -> Clara (Gemini 3.6): "${geminiReply}"`);
    return res.json({
      reply: geminiReply,
      backend: 'Gemini 3.6 Flash',
      engine: 'gemini'
    });
  } catch (err) {
    console.error('[Gemini Chat] Generation error:', err.message);
    return res.status(500).json({
      error: 'Failed to generate response from Gemini',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Con Edison Tech Day Moderator Server (Clara) running on http://0.0.0.0:${PORT}`);
});
