const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const textToSpeech = require('@google-cloud/text-to-speech');

const app = express();
const PORT = process.env.PORT || 8080;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'pradeep-demo-1';

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
        const cacheKey = crypto.createHash('md5').update(`en-US-Journey-F_1.02_${cleanText}`).digest('hex');
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
  const { text, voice = 'en-US-Journey-F', rate = 1.02 } = req.body;
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
        speakingRate: rate,
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

// Gemini Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Valid prompt string is required' });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt.trim() }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      return res.status(500).json({ error: 'No response generated from Gemini' });
    }

    const cleanReply = textPart.replace(/[\*\_`#]/g, '').trim();
    console.log(`[Chat] Prompt: "${prompt.trim()}" -> Clara: "${cleanReply}"`);
    res.json({ reply: cleanReply });
  } catch (err) {
    console.error('[Chat] Gemini generation error:', err.message);
    res.status(500).json({
      error: 'Failed to generate response from Gemini',
      details: err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Con Edison Tech Day Moderator Server (Clara) running on http://0.0.0.0:${PORT}`);
});
