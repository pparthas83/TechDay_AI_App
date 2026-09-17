const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleAuth } = require('google-gax');
const GECXService = require('./gecx_service');
const liveDataService = require('./services/live_data_service');

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

// Live Real-Time Data & Tools Endpoints
app.get('/api/live/weather', async (req, res) => {
  const data = await liveDataService.fetchNWSWeatherAlerts();
  res.json(data);
});

app.get('/api/live/grid', async (req, res) => {
  const data = await liveDataService.fetchNYISOGridFuelMix();
  res.json(data);
});

app.get('/api/live/outages', async (req, res) => {
  const data = await liveDataService.fetchLiveOutages();
  res.json(data);
});

app.post('/api/tools/clean-heat-calc', (req, res) => {
  const result = liveDataService.calculateCleanHeatSizing(req.body);
  res.json(result);
});

// Core Text-to-Speech synthesis helper with caching
async function synthesizeSpeechBuffer(text, voice = 'en-US-Neural2-F', rate = 1.02) {
  if (!text || typeof text !== 'string' || !text.trim()) return null;
  const cleanText = text.replace(/[\*\_`#]/g, '').trim();
  const cacheKey = crypto.createHash('md5').update(`${voice}_${rate}_${cleanText}`).digest('hex');

  if (audioCache.has(cacheKey)) {
    return { buffer: audioCache.get(cacheKey), cacheStatus: 'HIT' };
  }

  if (!ttsClient) {
    return null;
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
        speakingRate: parseFloat(rate) || 1.02,
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

    return { buffer: audioBuffer, cacheStatus: 'MISS' };
  } catch (err) {
    console.error('[TTS] Synthesis error:', err.message);
    return null;
  }
}

// Google Cloud Text-to-Speech synthesis endpoint
app.post('/api/tts', async (req, res) => {
  const { text, voice = 'en-US-Neural2-F', rate = 1.02 } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text string is required' });
  }

  const result = await synthesizeSpeechBuffer(text, voice, rate);
  if (!result || !result.buffer) {
    return res.status(500).json({ error: 'Failed to synthesize speech' });
  }

  res.setHeader('Content-Type', 'audio/mp3');
  res.setHeader('X-Cache-Status', result.cacheStatus);
  res.send(result.buffer);
});

const SYSTEM_INSTRUCTION =
  "You are Watt, the AI Panel Moderator for Con Edison Tech Day. " +
  "Persona: A woman's voice, very professional, youthful, and cheerful sounding. " +
  "Maintain high corporate polish, clear articulation, and warmth. " +
  "You must NEVER use slang, colloquial abbreviations, or informal street language. " +
  "You are moderating the 'AI in Action at Con Edison' panel featuring collaborative work between Con Edison Business teams and Enterprise Technology Solutions (ETS): " +
  "1. Customer Operations & Generative Billing Agent (Customer Operations Team) " +
  "2. Fleet Vehicle Idling Reduction AI " +
  "3. Subsurface Manhole Safety & Predictive Acoustics " +
  "4. Severe Weather Modeling & Grid Resilience (Electric Operations & Meteorology Team) " +
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

  const buildChatResponse = async (replyText, extra = {}) => {
    let audioBase64 = null;
    try {
      const speechRes = await synthesizeSpeechBuffer(replyText);
      if (speechRes && speechRes.buffer) {
        audioBase64 = speechRes.buffer.toString('base64');
      }
    } catch (audioErr) {
      console.warn('[Chat] Server-side audio synthesis warning:', audioErr.message);
    }
    return {
      reply: replyText,
      audioBase64,
      ...extra
    };
  };

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

  // Real-Time Telemetry Intent Detection & Pre-fetching (1.5s timeout budget)
  let liveContext = null;
  let realTimeIntent = null;
  try {
    realTimeIntent = liveDataService.detectRealTimeQuery(trimmedPrompt);
    if (realTimeIntent === 'LIVE_WEATHER') {
      const weather = await liveDataService.fetchNWSWeatherAlerts();
      liveContext = `[Live NWS Weather Telemetry: ${weather.headline}. Details: ${weather.description}]`;
    } else if (realTimeIntent === 'LIVE_GRID_MIX') {
      const grid = await liveDataService.fetchNYISOGridFuelMix();
      liveContext = `[Live NYISO Grid Fuel Mix: ${grid.summary}. Renewables: ${grid.renewablesTotalMW} MW, Clean Percentage: ${grid.cleanPercentage}%]`;
    } else if (realTimeIntent === 'LIVE_OUTAGES') {
      const outages = await liveDataService.fetchLiveOutages();
      liveContext = `[Live Con Edison Outage Dashboard: ${outages.summary}. System Reliability: ${outages.reliabilityRate}]`;
    } else if (realTimeIntent === 'CALCULATE_CLEAN_HEAT') {
      const sqftMatch = trimmedPrompt.match(/(\d[\d,]*)\s*(?:sq|square|sqft)/i);
      const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ''), 10) : 3500;
      const dac = /dac|disadvantaged|low[- ]income/i.test(trimmedPrompt);
      const borough = /queens/i.test(trimmedPrompt) ? 'Queens' :
                      /brooklyn/i.test(trimmedPrompt) ? 'Brooklyn' :
                      /bronx/i.test(trimmedPrompt) ? 'The Bronx' :
                      /staten/i.test(trimmedPrompt) ? 'Staten Island' :
                      /westchester/i.test(trimmedPrompt) ? 'Westchester' : 'Manhattan';
      const calc = liveDataService.calculateCleanHeatSizing({ sqft, borough, dacEligible: dac });
      liveContext = `[Real-Time Clean Heat Calculation Engine: ${calc.summaryText}]`;
    }
    if (liveContext) {
      console.log(`[Hybrid Live Grounding] Detected intent: ${realTimeIntent} -> Injected live context`);
    }
  } catch (liveErr) {
    console.warn('[Hybrid Live Grounding] Error fetching real-time telemetry:', liveErr.message);
  }

  const effectivePrompt = liveContext
    ? `${liveContext} The audience asks: "${trimmedPrompt}". Using this real-time factual data, formulate your concise 1 to 2 sentence answer as Watt:`
    : trimmedPrompt;

  // 1. ROUTE TO GECX PLAYBOOK
  if (targetBackend === 'gecx') {
    if (!gecxService) {
      console.warn('[Chat] GECX service unavailable, falling back to Gemini Flash');
      try {
        const geminiReply = await queryGemini(effectivePrompt);
        const payload = await buildChatResponse(geminiReply, {
          backend: 'Gemini 3.6 Flash (GECX Fallback)',
          engine: 'gemini',
          realTimeIntent: realTimeIntent || undefined,
          isRealTimeGrounded: Boolean(liveContext)
        });
        return res.json(payload);
      } catch (geminiErr) {
        return res.status(500).json({ error: 'Both GECX and Gemini failed', details: geminiErr.message });
      }
    }

    try {
      const session = sessionId || `stage-session-${Date.now()}`;
      const gecxResult = await gecxService.detectIntent(effectivePrompt, session);
      const cleanReply = gecxResult.reply.replace(/[\*\_`#]/g, '').trim();
      console.log(`[GECX Chat] User: "${trimmedPrompt}" -> Watt (GECX Playbook): "${cleanReply}" [match: ${gecxResult.match?.matchType}]`);
      const payload = await buildChatResponse(cleanReply, {
        backend: 'GECX Playbook',
        engine: 'gecx',
        matchType: gecxResult.match?.matchType,
        confidence: gecxResult.match?.confidence,
        realTimeIntent: realTimeIntent || undefined,
        isRealTimeGrounded: Boolean(liveContext)
      });
      return res.json(payload);
    } catch (gecxErr) {
      console.error('[GECX Chat] GECX error, falling back to Gemini Flash:', gecxErr.message);
      try {
        const geminiReply = await queryGemini(effectivePrompt);
        const payload = await buildChatResponse(geminiReply, {
          backend: 'Gemini 3.6 Flash (Fallback)',
          engine: 'gemini',
          warning: 'GECX Playbook encountered an error; served by Gemini',
          realTimeIntent: realTimeIntent || undefined,
          isRealTimeGrounded: Boolean(liveContext)
        });
        return res.json(payload);
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
    const geminiReply = await queryGemini(effectivePrompt);
    console.log(`[Gemini Chat] User: "${trimmedPrompt}" -> Watt (Gemini 3.6): "${geminiReply}"`);
    const payload = await buildChatResponse(geminiReply, {
      backend: 'Gemini 3.6 Flash',
      engine: 'gemini',
      realTimeIntent: realTimeIntent || undefined,
      isRealTimeGrounded: Boolean(liveContext)
    });
    return res.json(payload);
  } catch (err) {
    console.error('[Gemini Chat] Generation error:', err.message);
    return res.status(500).json({
      error: 'Failed to generate response from Gemini',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Con Edison Tech Day Moderator Server (Watt) running on http://0.0.0.0:${PORT}`);
});
