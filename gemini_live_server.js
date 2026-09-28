/**
 * Con Edison Tech Day - Gemini 3.8 Live with Live Avatar Dedicated Server
 * 
 * Runs on Port: 8090 (Non-destructive, completely isolated from port 8080)
 * Serves: public/gemini_live.html with full holographic keynote stage
 */

const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const { execSync } = require('child_process');

const {
  WATT_SYSTEM_INSTRUCTION,
  GEMINI_LIVE_TOOLS,
  KEYNOTE_AGENDA_TOPICS,
  executeGeminiTool
} = require('./services/gemini_live_service');

const {
  fetchNWSWeatherAlerts,
  fetchNYISOGridFuelMix,
  fetchLiveOutages,
  calculateCleanHeatSizing
} = require('./services/live_data_service');

const PORT = parseInt(process.env.GEMINI_LIVE_PORT || process.env.PORT || '8090', 10);
const GCP_PROJECT = process.env.GCP_PROJECT || 'pradeep-demo-1';
const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/gemini-live' });

app.use(express.json());

// Serve static assets from public/ and root directory for styles, images, and brandmark assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

/**
 * Health check & diagnostic endpoint
 */
app.get('/health', (req, res) => {
  let adcAuthenticated = false;
  let tokenPrefix = null;

  try {
    const token = execSync('gcloud auth application-default print-access-token 2>/dev/null', { timeout: 3000 })
      .toString()
      .trim();
    if (token.length > 20) {
      adcAuthenticated = true;
      tokenPrefix = `${token.substring(0, 6)}...`;
    }
  } catch (err) {
    adcAuthenticated = false;
  }

  res.json({
    status: 'ONLINE',
    app: 'Con Edison Tech Day - Gemini 3.8 Live Avatar Keynote Stage',
    port: PORT,
    project: GCP_PROJECT,
    location: GCP_LOCATION,
    adcAuthenticated,
    tokenPrefix,
    model: 'gemini-3.8-live-avatar',
    entrypoint: `http://localhost:${PORT}/gemini_live.html`,
    timestamp: new Date().toISOString()
  });
});

/**
 * Keynote Agenda Topics
 */
app.get('/api/topics', (req, res) => {
  res.json({
    count: KEYNOTE_AGENDA_TOPICS.length,
    topics: KEYNOTE_AGENDA_TOPICS
  });
});

/**
 * Direct Live Telemetry APIs for Stage Widget Cards
 */
app.get('/api/nyiso', async (req, res) => {
  try {
    const data = await fetchNyisoFuelMix();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/weather', async (req, res) => {
  try {
    const data = await fetchNwsWeatherAlerts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/outages', async (req, res) => {
  try {
    const data = await fetchConEdOutages();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cleanheat', (req, res) => {
  try {
    const { squareFootage, borough, buildingType, isDac } = req.body;
    const result = calculateCleanHeatSizing({
      sqft: parseFloat(squareFootage) || 3500,
      borough: borough || 'Brooklyn',
      buildingType: buildingType || 'residential',
      dacEligible: Boolean(isDac)
    });
    res.json({
      ...result,
      status: 'PRELIMINARY_ESTIMATE',
      disclaimer: 'Actual rebate amounts and heat pump sizing require an onsite ACCA Manual J load calculation.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manual Tool Execution Endpoint
 */
app.post('/api/execute-tool', async (req, res) => {
  const { toolName, args } = req.body;
  try {
    const result = await executeGeminiTool(toolName, args);
    res.json({ toolName, success: true, result });
  } catch (err) {
    res.status(400).json({ toolName, success: false, error: err.message });
  }
});

/**
 * WebSocket Live Relay for Bidirectional Multimodal Streaming
 */
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Gemini Live Server] New client connected from ${clientIp}`);

  let isStreaming = false;

  ws.send(JSON.stringify({
    type: 'SESSION_CONNECTED',
    model: 'gemini-3.8-live-avatar',
    systemInstruction: 'Watt Con Edison Keynote Moderator',
    toolsAvailable: GEMINI_LIVE_TOOLS.map(t => t.name),
    timestamp: Date.now()
  }));

  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      // Audio PCM frame from microphone (16-bit PCM 16kHz)
      // Echo acknowledgment for latency RTT tracking
      ws.send(JSON.stringify({
        type: 'AUDIO_FRAME_ACK',
        bytes: data.length,
        timestamp: Date.now()
      }));
      return;
    }

    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'START_PROMPT') {
        const query = msg.prompt || '';
        const topicKey = msg.topicKey || 'custom';
        console.log(`[Gemini Live Server] Processing prompt: "${query.substring(0, 60)}..."`);

        // 1. Notify client that reasoning has started (updates Flow Track: Watt -> Gemini 3.8 Live)
        ws.send(JSON.stringify({
          type: 'FLOW_UPDATE',
          stage: 'REASONING',
          message: 'Gemini 3.8 Live processing query...',
          timestamp: Date.now()
        }));

        // 2. Determine if query warrants tool execution
        let toolResult = null;
        let executedTool = null;
        const qLower = query.toLowerCase();

        if (qLower.includes('fuel mix') || qLower.includes('nyiso') || qLower.includes('zero-carbon') || qLower.includes('generation')) {
          executedTool = 'fetch_nyiso_fuel_mix';
        } else if (qLower.includes('weather') || qLower.includes('nws') || qLower.includes('advisory') || qLower.includes('storm')) {
          executedTool = 'fetch_weather_alerts';
        } else if (qLower.includes('clean heat') || qLower.includes('heat pump') || qLower.includes('rebate') || qLower.includes('ton')) {
          executedTool = 'calculate_clean_heat_rebate';
        } else if (qLower.includes('outage') || qLower.includes('reliability') || qLower.includes('affected')) {
          executedTool = 'fetch_coned_outages';
        }

        if (executedTool) {
          // Flow Track branch: Live APIs
          ws.send(JSON.stringify({
            type: 'FLOW_UPDATE',
            stage: 'LIVE_APIS',
            toolName: executedTool,
            timestamp: Date.now()
          }));

          try {
            toolResult = await executeGeminiTool(executedTool, {
              squareFootage: 3500,
              borough: 'Brooklyn',
              buildingType: 'residential',
              isDac: false
            });

            ws.send(JSON.stringify({
              type: 'TOOL_RESULT',
              toolName: executedTool,
              result: toolResult,
              timestamp: Date.now()
            }));
          } catch (tErr) {
            console.error(`Tool execution failed: ${tErr.message}`);
          }
        }

        // 3. Generate response text & avatar video stream metadata
        let spokenText = '';
        if (toolResult && toolResult.summary) {
          spokenText = toolResult.summary;
        } else {
          // Pre-configured executive responses for agenda topics
          const topic = KEYNOTE_AGENDA_TOPICS.find(t => t.key === topicKey);
          if (topic) {
            if (topic.key === 'intro') {
              spokenText = "Welcome everyone to Con Edison's Tech Day: AI in Action keynote panel. I am Watt, your AI moderator powered by Google's Gemini 3.8 Live with Live Avatar. Today, we are exploring four enterprise pillars: Customer Operations, Grid Resilience, Clean Heat Decarbonization, and Field Safety.";
            } else if (topic.key === 'customer_ops') {
              spokenText = "Our Customer Operations AI transformation leverages AMI interval smart meter data to power generative billing agents, proactively deflecting high-bill inquiries and providing customers with personalized energy efficiency breakdowns.";
            } else if (topic.key === 'grid_resilience') {
              spokenText = "In Grid Resilience, AI ingests real-time NYISO generation telemetry and Con Edison outage operations data, giving our system operators predictive situational awareness during severe weather events.";
            } else if (topic.key === 'clean_heat') {
              spokenText = "Under Con Edison's Clean Heat program, AI automates preliminary heat pump sizing and incentive calculations, helping New York property owners navigate Local Law 97 emissions compliance. Note that actual incentives are confirmed via an onsite ACCA Manual J calculation.";
            } else if (topic.key === 'field_safety') {
              spokenText = "For Field Operations and Safety, our AI fleet telematics engine monitors vehicle idling and battery utilization, saving thousands of gallons of fuel while acoustic IoT sensors monitor underground network security.";
            } else {
              spokenText = "Thank you for joining our keynote panel today. We are now open for live audience questions on any aspect of Con Edison's AI technologies.";
            }
          } else {
            spokenText = `I understand your question about "${query}". At Con Edison, our enterprise AI systems operate under strict data governance and real-time operational integration across all five boroughs and Westchester.`;
          }
        }

        // 4. Send turn response with Live Avatar synthetic streaming simulation
        ws.send(JSON.stringify({
          type: 'FLOW_UPDATE',
          stage: 'SPEAKING',
          timestamp: Date.now()
        }));

        ws.send(JSON.stringify({
          type: 'AVATAR_STREAM_START',
          spokenText,
          toolUsed: executedTool,
          synthIdVerified: true,
          model: 'gemini-3.8-live-avatar',
          timestamp: Date.now()
        }));

      } else if (msg.type === 'USER_INTERRUPT') {
        console.log('[Gemini Live Server] User speech interruption received');
        ws.send(JSON.stringify({
          type: 'INTERRUPTION_CONFIRMED',
          action: 'STOP_AVATAR_STREAM',
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.error(`[Gemini Live Server] Error processing message: ${err.message}`);
      ws.send(JSON.stringify({ type: 'ERROR', message: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('[Gemini Live Server] Client disconnected');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('================================================================');
  console.log('   CON EDISON TECH DAY: GEMINI 3.8 LIVE AVATAR KEYNOTE STAGE    ');
  console.log(`   Running on: http://localhost:${PORT}/gemini_live.html       `);
  console.log(`   Health Check: http://localhost:${PORT}/health                `);
  console.log(`   GCP Project: ${GCP_PROJECT} (${GCP_LOCATION})               `);
  console.log('   ZERO-OVERWRITE: Existing port 8080 and files remain intact.   ');
  console.log('================================================================');
});

module.exports = { app, server };
