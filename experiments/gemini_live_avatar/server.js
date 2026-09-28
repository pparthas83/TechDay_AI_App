/**
 * Isolated Evaluation Server for Gemini 3.8 Live with Live Avatar
 * 
 * Port: 8888 (isolated from production port 8080)
 * Project: pradeep-demo-1
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { execSync } = require('child_process');

const PORT = parseInt(process.env.SANDBOX_PORT || '8888', 10);
const GCP_PROJECT = process.env.GCP_PROJECT || 'pradeep-demo-1';
const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/live' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Preset Avatar Library Definitions
const PRESET_AVATARS = [
  {
    id: 'avatar-nova-pro',
    name: 'Nova',
    persona: 'Customer Experience & Utility Specialist',
    voice: 'en-US-Studio-O',
    gender: 'Female',
    style: 'Professional / Conversational',
    languagesCount: 97,
    previewThumbnail: '/assets/avatars/nova_thumb.png'
  },
  {
    id: 'avatar-orion-tech',
    name: 'Orion',
    persona: 'Grid Operations & Technical Lead',
    voice: 'en-US-Journey-D',
    gender: 'Male',
    style: 'Technical / Precision',
    languagesCount: 97,
    previewThumbnail: '/assets/avatars/orion_thumb.png'
  },
  {
    id: 'avatar-lyra-concierge',
    name: 'Lyra',
    persona: 'Clean Energy & Decarbonization Advisor',
    voice: 'en-US-Journey-F',
    gender: 'Neutral',
    style: 'Welcoming / Advisory',
    languagesCount: 97,
    previewThumbnail: '/assets/avatars/lyra_thumb.png'
  }
];

/**
 * Health check & environment diagnostics
 */
app.get('/health', (req, res) => {
  let adcAvailable = false;
  let tokenSnippet = null;

  try {
    const token = execSync('gcloud auth application-default print-access-token 2>/dev/null', { timeout: 3000 })
      .toString()
      .trim();
    if (token.length > 20) {
      adcAvailable = true;
      tokenSnippet = `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
    }
  } catch (err) {
    adcAvailable = false;
  }

  res.json({
    status: 'ONLINE',
    sandbox: 'Gemini 3.8 Live with Live Avatar Lab',
    port: PORT,
    project: GCP_PROJECT,
    location: GCP_LOCATION,
    adcAuthenticated: adcAvailable,
    tokenSnippet,
    endpoints: {
      studioConsole: `https://console.cloud.google.com/agent-platform/studio/multimodal-live?project=${GCP_PROJECT}`,
      apiDocumentation: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api'
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Returns available preset avatar models
 */
app.get('/api/avatars', (req, res) => {
  res.json({
    count: PRESET_AVATARS.length,
    avatars: PRESET_AVATARS
  });
});

/**
 * Provides an ephemeral token for client WebRTC / Live session handshakes
 */
app.get('/api/auth-token', (req, res) => {
  try {
    const token = execSync('gcloud auth application-default print-access-token 2>/dev/null', { timeout: 5000 })
      .toString()
      .trim();
    res.json({
      token,
      expiresInSec: 3600,
      projectId: GCP_PROJECT,
      location: GCP_LOCATION
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to retrieve Application Default Credentials (ADC) token',
      details: err.message
    });
  }
});

/**
 * Mock background tool endpoint to evaluate asynchronous tool execution during speech
 */
app.post('/api/tools/meter-read', (req, res) => {
  const accountId = req.body.accountId || 'ACCT-98421';
  // Simulate 800ms background retrieval
  setTimeout(() => {
    res.json({
      accountId,
      currentKwDemand: 4.82,
      billingCycleKwh: 642,
      solarExportKwh: 38.4,
      status: 'NORMAL_OPERATION',
      timestamp: new Date().toISOString()
    });
  }, 800);
});

/**
 * WebSocket Live Relay for Bidirectional Multimodal Streaming
 */
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Live Avatar Sandbox] Client connected from ${clientIp}`);

  ws.send(JSON.stringify({
    type: 'SESSION_CONNECTED',
    message: 'Connected to Gemini 3.8 Live Avatar Sandbox Relay',
    model: 'gemini-3.8-live-avatar',
    timestamp: Date.now()
  }));

  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      // Audio PCM 16-bit 16kHz or 24kHz stream chunk
      // In full production, this forwards directly to the gRPC/WebRTC upstream
      ws.send(JSON.stringify({
        type: 'AUDIO_FRAME_RECEIVED',
        byteLength: data.length,
        timestamp: Date.now()
      }));
      return;
    }

    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'START_SESSION') {
        const selectedAvatar = PRESET_AVATARS.find(a => a.id === msg.avatarId) || PRESET_AVATARS[0];
        ws.send(JSON.stringify({
          type: 'SESSION_INITIALIZED',
          avatar: selectedAvatar,
          status: 'LISTENING',
          supportedFeatures: [
            'Simultaneous Audio/Visual Processing',
            'Synchronized Speech & Face Generation',
            'Asynchronous Tool Calling',
            'SynthID Watermarking',
            'Multi-language Auto-detection (97 langs)'
          ],
          timestamp: Date.now()
        }));
      } else if (msg.type === 'USER_SPEECH_INTERRUPT') {
        // Handle low-latency interruption
        ws.send(JSON.stringify({
          type: 'INTERRUPTION_CONFIRMED',
          action: 'CANCEL_PLAYBACK',
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('[Live Avatar Sandbox] Client disconnected');
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('================================================================');
  console.log(`   GEMINI 3.8 LIVE WITH LIVE AVATAR — EVALUATION SANDBOX`);
  console.log(`   Running locally on: http://localhost:${PORT}`);
  console.log(`   Project: ${GCP_PROJECT} (Location: ${GCP_LOCATION})`);
  console.log('================================================================');
});

module.exports = { app, server };
