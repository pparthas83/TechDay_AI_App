/**
 * Con Edison Tech Day - GECX-Powered Moderator Server
 * 
 * Standalone server connecting the 3D Holographic Stage directly to
 * Google Enterprise Customer Experience (GECX / Dialogflow CX).
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const textToSpeech = require('@google-cloud/text-to-speech');
const GECXService = require('./gecx_service');

const app = express();
const PORT = process.env.PORT || 8080;
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'pradeep-demo-1';
const GECX_LOCATION = process.env.GECX_LOCATION || 'us-central1';
const GECX_AGENT_ID = process.env.GECX_AGENT_ID || '2061bead-9591-47be-83a8-5d16fedfaeb5';

// Initialize GECX Service
const gecxService = new GECXService({
  projectId: GCP_PROJECT_ID,
  location: GECX_LOCATION,
  agentId: GECX_AGENT_ID
});

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

app.use(express.json());

// Set Cache-Control headers to prevent stale UI caching
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname), {
  index: 'index.html',
  maxAge: 0
}));

// Agenda API Endpoint
app.get('/api/agenda', (req, res) => {
  const agendaPath = path.join(__dirname, 'public', 'agenda.json');
  fs.readFile(agendaPath, 'utf8', (err, data) => {
    if (err) {
      console.error('[Agenda] Error loading agenda.json:', err.message);
      return res.status(500).json({ error: 'Failed to load panel agenda' });
    }
    try {
      res.json(JSON.parse(data));
    } catch (parseErr) {
      res.status(500).json({ error: 'Corrupt agenda JSON data' });
    }
  });
});

// GECX Agent Info Endpoint
app.get('/api/gecx/agent', async (req, res) => {
  try {
    const info = await gecxService.getAgentInfo();
    res.json({
      status: 'CONNECTED',
      backend: 'GECX / Dialogflow CX',
      agent: info
    });
  } catch (err) {
    res.status(500).json({
      status: 'ERROR',
      error: 'Could not fetch GECX agent details',
      details: err.message
    });
  }
});

// Text-to-Speech Synthesis Endpoint (Google Cloud Journey-F voice)
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Valid text string is required' });
  }

  const cleanText = text
    .replace(/[\*\_`#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Check cache
  const cacheKey = crypto.createHash('md5').update(cleanText).digest('hex');
  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Audio-Source', 'cache');
    return res.send(cachedBuffer);
  }

  // Fallback to static welcome.mp3 if TTS client is unconfigured
  if (!ttsClient) {
    const fallbackPath = path.join(__dirname, 'public', 'welcome.mp3');
    if (fs.existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-Audio-Source', 'local-fallback');
      return res.sendFile(fallbackPath);
    }
    return res.status(503).json({ error: 'TTS Service unavailable' });
  }

  try {
    const ttsRequest = {
      input: { text: cleanText },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Journey-F'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.02,
        pitch: 0.0
      }
    };

    const [response] = await ttsClient.synthesizeSpeech(ttsRequest);
    const audioBuffer = response.audioContent;

    // Cache the audio
    if (audioCache.size > 200) {
      const oldestKey = audioCache.keys().next().value;
      audioCache.delete(oldestKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Audio-Source', 'google-cloud-tts');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[TTS] Synthesis error:', err.message);
    const fallbackPath = path.join(__dirname, 'public', 'welcome.mp3');
    if (fs.existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-Audio-Source', 'local-fallback-on-error');
      return res.sendFile(fallbackPath);
    }
    res.status(500).json({ error: 'Failed to synthesize speech', details: err.message });
  }
});

// GECX Conversational Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { prompt, sessionId, queryParams } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Valid prompt string is required' });
  }

  try {
    const result = await gecxService.detectIntent(
      prompt.trim(),
      sessionId || `stage-session-${Date.now()}`,
      queryParams || {}
    );

    console.log(`[GECX Chat] User: "${prompt.trim()}" -> Clara (GECX): "${result.reply}"`);
    res.json({
      reply: result.reply,
      stagePayload: result.stagePayload,
      match: result.match,
      backend: 'GECX'
    });
  } catch (err) {
    console.error('[GECX Chat] Intent detection error:', err.message);
    res.status(500).json({
      error: 'Failed to process intent with GECX',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Con Edison Tech Day GECX Moderator Server running on http://0.0.0.0:${PORT}`);
  console.log(`Connected GECX Agent: ${GECX_AGENT_ID} (${GECX_LOCATION})`);
});
