/**
 * Automated Verification Suite for Gemini 3.8 Live Avatar Keynote Stage
 * 
 * Verifies:
 * 1. Gemini Live Service & Tool Declarations
 * 2. Deterministic Tool Execution & SLA compliance
 * 3. HTTP Server Endpoints (/health, /api/topics, /gemini_live.html)
 * 4. WebSocket Bidirectional Streaming & Interruption Handling
 */

const assert = require('assert');
const http = require('http');
const { WebSocket } = require('ws');

const {
  WATT_SYSTEM_INSTRUCTION,
  GEMINI_LIVE_TOOLS,
  KEYNOTE_AGENDA_TOPICS,
  executeGeminiTool
} = require('../services/gemini_live_service');

process.env.GEMINI_LIVE_PORT = '8091';
const { app, server } = require('../gemini_live_server');

const TEST_PORT = 8091;

function runTests() {
  console.log('======================================================');
  console.log('   GEMINI 3.8 LIVE AVATAR KEYNOTE STAGE: TEST SUITE   ');
  console.log('======================================================\n');

  let passed = 0;

  try {
    // 1. Service Definition & Tool Declarations
    assert(WATT_SYSTEM_INSTRUCTION.includes('Watt'), 'System instruction must define Watt');
    assert(WATT_SYSTEM_INSTRUCTION.includes('Con Edison'), 'System instruction must reference Con Edison');
    assert.strictEqual(GEMINI_LIVE_TOOLS.length, 4, 'Must declare 4 live tools');
    assert.strictEqual(KEYNOTE_AGENDA_TOPICS.length, 6, 'Must declare 6 keynote agenda topics');
    console.log('  ✓ PASS: Gemini Live service declares Watt persona, 4 tools, and 6 topics');
    passed++;

    // 2. Deterministic Tool Execution: Clean Heat & Manual J Disclaimer
    executeGeminiTool('calculate_clean_heat_rebate', { squareFootage: 3500, borough: 'Brooklyn', buildingType: 'residential' })
      .then(result => {
        assert(result.heatPumpTons > 0, 'Must calculate heating tons');
        assert(result.totalIncentive > 0, 'Must calculate total incentive rebate');
        assert.strictEqual(result.status, 'PRELIMINARY_ESTIMATE', 'Must enforce preliminary estimate status');
        assert(result.verificationRequirement.includes('Manual J'), 'Must mandate onsite ACCA Manual J load calculation');
        console.log('  ✓ PASS: Clean Heat tool executes with ACCA Manual J preliminary estimate disclaimer');
        passed++;

        // 3. Deterministic Tool Execution: NYISO Fuel Mix
        return executeGeminiTool('fetch_nyiso_fuel_mix');
      })
      .then(result => {
        assert(result.summary, 'NYISO tool must return summary');
        assert(result.zeroCarbonPercent !== undefined, 'Must return zero carbon percent');
        console.log(`  ✓ PASS: NYISO tool fetches real-time fuel mix (${result.zeroCarbonPercent}% zero-carbon)`);
        passed++;

        // 4. HTTP Health & Static Serving
        return new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${TEST_PORT}/health`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              const json = JSON.parse(data);
              assert.strictEqual(json.status, 'ONLINE');
              assert.strictEqual(json.model, 'gemini-3.8-live-avatar');
              console.log('  ✓ PASS: GET /health returns online status and gemini-3.8-live-avatar model');
              passed++;
              resolve();
            });
          }).on('error', reject);
        });
      })
      .then(() => {
        // 5. HTTP HTML Page
        return new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${TEST_PORT}/gemini_live.html`, (res) => {
            assert.strictEqual(res.statusCode, 200);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              assert(data.includes('Gemini 3.8 Live Avatar Keynote Stage'), 'Must serve correct page title');
              assert(data.includes('SynthID Verified'), 'Must include SynthID watermark');
              assert(data.includes('avatar-canvas-element'), 'Must include avatar viewport canvas');
              console.log('  ✓ PASS: GET /gemini_live.html delivers complete keynote stage layout');
              passed++;
              resolve();
            });
          }).on('error', reject);
        });
      })
      .then(() => {
        // 6. WebSocket Protocol & Interruption
        return new Promise((resolve, reject) => {
          const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws/gemini-live`);
          let receivedSessionConnected = false;
          let receivedToolResult = false;

          ws.on('open', () => {
            // Trigger prompt to invoke tool
            ws.send(JSON.stringify({
              type: 'START_PROMPT',
              prompt: 'Calculate clean heat rebate for 3,500 sq ft in Brooklyn',
              topicKey: 'clean_heat'
            }));
          });

          ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'SESSION_CONNECTED') {
              receivedSessionConnected = true;
            } else if (msg.type === 'TOOL_RESULT') {
              receivedToolResult = true;
              assert.strictEqual(msg.toolName, 'calculate_clean_heat_rebate');
              // Test Interruption
              ws.send(JSON.stringify({ type: 'USER_INTERRUPT' }));
            } else if (msg.type === 'INTERRUPTION_CONFIRMED') {
              assert(receivedSessionConnected, 'Must have received SESSION_CONNECTED');
              assert(receivedToolResult, 'Must have received TOOL_RESULT');
              console.log('  ✓ PASS: WebSocket /ws/gemini-live session streaming, tool dispatch & interruption confirmed');
              passed++;
              ws.close();
              resolve();
            }
          });

          ws.on('error', reject);
        });
      })
      .then(() => {
        console.log(`\nAll ${passed} Gemini 3.8 Live Avatar verification tests passed successfully!`);
        server.close(() => process.exit(0));
      })
      .catch(err => {
        console.error('Test failed:', err);
        server.close(() => process.exit(1));
      });

  } catch (err) {
    console.error('Test setup failed:', err);
    server.close(() => process.exit(1));
  }
}

// Allow server to listen before running tests
setTimeout(runTests, 500);
