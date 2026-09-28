/**
 * Automated Verification for Gemini 3.8 Live Avatar Evaluation Sandbox
 */

const assert = require('assert');
const http = require('http');
const { WebSocket } = require('ws');
const { server } = require('../server');

const TEST_PORT = 8888;

function runTests() {
  console.log('\n======================================================');
  console.log('   GEMINI 3.8 LIVE AVATAR SANDBOX: TEST SUITE');
  console.log('======================================================\n');

  // Test 1: GET /health
  http.get(`http://127.0.0.1:${TEST_PORT}/health`, (res) => {
    assert.strictEqual(res.statusCode, 200, 'Health endpoint should return 200');
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const json = JSON.parse(data);
      assert.strictEqual(json.status, 'ONLINE');
      assert.strictEqual(json.project, 'pradeep-demo-1');
      console.log('  ✓ PASS: GET /health returns online status and active GCP project');

      // Test 2: GET /api/avatars
      http.get(`http://127.0.0.1:${TEST_PORT}/api/avatars`, (res2) => {
        assert.strictEqual(res2.statusCode, 200);
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const json2 = JSON.parse(data2);
          assert(json2.avatars.length >= 3, 'Should provide at least 3 preset avatars');
          console.log(`  ✓ PASS: GET /api/avatars returns ${json2.avatars.length} preset avatars`);

          // Test 3: POST /api/tools/meter-read (Async background tool simulation)
          const postReq = http.request({
            hostname: '127.0.0.1',
            port: TEST_PORT,
            path: '/api/tools/meter-read',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }, (res3) => {
            assert.strictEqual(res3.statusCode, 200);
            let data3 = '';
            res3.on('data', chunk => data3 += chunk);
            res3.on('end', () => {
              const json3 = JSON.parse(data3);
              assert.strictEqual(json3.status, 'NORMAL_OPERATION');
              console.log('  ✓ PASS: POST /api/tools/meter-read executes background async tool call');

              // Test 4: WebSocket Relay connection to /ws/live
              const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws/live`);
              ws.on('open', () => {
                ws.send(JSON.stringify({ type: 'START_SESSION', avatarId: 'avatar-nova-pro' }));
              });
              ws.on('message', (msgData) => {
                const wsMsg = JSON.parse(msgData.toString());
                if (wsMsg.type === 'SESSION_INITIALIZED') {
                  assert.strictEqual(wsMsg.avatar.name, 'Nova');
                  console.log('  ✓ PASS: WebSocket /ws/live initiates session with selected avatar');
                  ws.close();
                  server.close(() => {
                    console.log('\nAll 4 Sandbox verification tests passed successfully!\n');
                    process.exit(0);
                  });
                }
              });
              ws.on('error', (err) => {
                console.error('WebSocket error:', err);
                process.exit(1);
              });
            });
          });
          postReq.write(JSON.stringify({ accountId: 'ACCT-98421' }));
          postReq.end();
        });
      });
    });
  }).on('error', (err) => {
    console.error('HTTP error:', err);
    process.exit(1);
  });
}

// Allow server a moment to bind if just started
setTimeout(runTests, 500);
