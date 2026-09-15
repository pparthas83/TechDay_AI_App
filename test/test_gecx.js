/**
 * Con Edison Tech Day - GECX Integration Test Suite
 * 
 * Validates GECX service configuration, session path formatting,
 * payload parsing, and live connectivity against Google Cloud Dialogflow CX.
 */

const assert = require('assert');
const GECXService = require('../gecx_service');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('   CON EDISON TECH DAY: GECX TEST SUITE');
  console.log('======================================================\n');

  // Test 1: Service Initialization & Default Config
  runTest('GECXService initializes with default project and location', () => {
    const service = new GECXService();
    assert.strictEqual(service.projectId, 'pradeep-demo-1');
    assert.strictEqual(service.location, 'us-central1');
    assert.strictEqual(service.clientOptions.apiEndpoint, 'us-central1-dialogflow.googleapis.com');
  });

  // Test 2: Custom Regional Endpoint
  runTest('GECXService properly formats regional API endpoints', () => {
    const serviceGlobal = new GECXService({ location: 'global' });
    assert.strictEqual(serviceGlobal.clientOptions.apiEndpoint, 'dialogflow.googleapis.com');

    const serviceUsEast = new GECXService({ location: 'us-east1' });
    assert.strictEqual(serviceUsEast.clientOptions.apiEndpoint, 'us-east1-dialogflow.googleapis.com');
  });

  // Test 3: Session Path Formatting
  runTest('formatSessionPath generates canonical CX resource string', () => {
    const service = new GECXService({
      projectId: 'test-proj',
      location: 'us-central1',
      agentId: 'agent-1234'
    });
    const sessionPath = service.formatSessionPath('session-stage-99');
    assert.strictEqual(
      sessionPath,
      'projects/test-proj/locations/us-central1/agents/agent-1234/sessions/session-stage-99'
    );
  });

  // Test 4: Environment-Specific Session Path
  runTest('formatSessionPath supports environment qualification', () => {
    const service = new GECXService({
      projectId: 'test-proj',
      location: 'us-central1',
      agentId: 'agent-1234',
      environmentId: 'production'
    });
    const sessionPath = service.formatSessionPath('session-stage-99');
    assert.strictEqual(
      sessionPath,
      'projects/test-proj/locations/us-central1/agents/agent-1234/environments/production/sessions/session-stage-99'
    );
  });

  // Test 5: Input Validation
  await runAsyncTest('detectIntent rejects invalid or empty utterances', async () => {
    const service = new GECXService();
    let caught = false;
    try {
      await service.detectIntent('   ');
    } catch (err) {
      caught = true;
      assert.ok(err.message.includes('Valid query text is required'));
    }
    assert.strictEqual(caught, true, 'Should have thrown on whitespace utterance');
  });

  // Test 6: Response Parsing for Plain Text & Markdown Sanitization
  runTest('parseResponse extracts and sanitizes spoken text messages', () => {
    const service = new GECXService();
    const mockResponse = {
      queryResult: {
        responseMessages: [
          { text: { text: ['Good morning *Con Edison*!'] } },
          { text: { text: ['We are highlighting our **Smart Grid** AI.'] } }
        ],
        match: {
          matchType: 'PLAYBOOK',
          confidence: 0.98
        }
      }
    };

    const parsed = service.parseResponse(mockResponse);
    assert.strictEqual(parsed.reply, 'Good morning Con Edison! We are highlighting our Smart Grid AI.');
    assert.strictEqual(parsed.match.matchType, 'PLAYBOOK');
    assert.strictEqual(parsed.match.confidence, 0.98);
    assert.strictEqual(parsed.stagePayload, null);
  });

  // Test 7: Response Parsing for Custom Stage Control Payloads
  runTest('parseResponse extracts custom stage actions and metadata', () => {
    const service = new GECXService();
    const mockResponse = {
      queryResult: {
        responseMessages: [
          { text: { text: ['Introducing Electric Operations and Meteorology for severe weather modeling.'] } },
          {
            payload: {
              fields: {
                action: { stringValue: 'SHOW_LOWER_THIRD' },
                speaker: { stringValue: 'Electric Operations & Meteorology Team' },
                topicIndex: { numberValue: 4 }
              }
            }
          }
        ]
      }
    };

    const parsed = service.parseResponse(mockResponse);
    assert.ok(parsed.stagePayload);
    assert.strictEqual(parsed.stagePayload.action, 'SHOW_LOWER_THIRD');
    assert.strictEqual(parsed.stagePayload.speaker, 'Electric Operations & Meteorology Team');
    assert.strictEqual(parsed.stagePayload.topicIndex, 4);
  });

  // Test 8: Live Connectivity to Con Edison Tech Day Moderator Agent on GCP
  await runAsyncTest('Live Con Edison Moderator Agent (pradeep-demo-1 / 668bd4db-b76d-4f1b-be6b-8e290bb741bd)', async () => {
    const service = new GECXService({
      projectId: 'pradeep-demo-1',
      location: 'us-central1',
      agentId: '668bd4db-b76d-4f1b-be6b-8e290bb741bd'
    });

    const testUtterance = 'Who are you and what are we discussing today?';
    const result = await service.detectIntent(testUtterance, `unit-test-${Date.now()}`);

    assert.ok(result.reply && typeof result.reply === 'string', 'Reply must be non-empty string');
    assert.ok(result.reply.toLowerCase().includes('watt') || result.reply.toLowerCase().includes('con edison'), 'Reply should identify Watt or Con Edison');
    assert.ok(result.match.confidence > 0, 'Match confidence should be greater than 0');
    console.log(`    [Live Watt GECX Output]: "${result.reply.substring(0, 110)}..." (Match: ${result.match.matchType})`);
  });

  // Test 9: Live Con Edison Panel Topic Query
  await runAsyncTest('Live Panel Topic Query: Customer Operations Billing Agent', async () => {
    const service = new GECXService({
      projectId: 'pradeep-demo-1',
      location: 'us-central1',
      agentId: '668bd4db-b76d-4f1b-be6b-8e290bb741bd'
    });

    const testUtterance = 'Tell us about the customer billing generative AI agent use case';
    const result = await service.detectIntent(testUtterance, `unit-test-topic-${Date.now()}`);

    assert.ok(result.reply && typeof result.reply === 'string', 'Reply must be non-empty string');
    assert.ok(result.reply.length > 20, 'Reply should contain detailed answer');
    console.log(`    [Live Topic Response]: "${result.reply.substring(0, 110)}..."`);
  });

  console.log(`\nResults: ${passedTests} of ${totalTests} tests passed.\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
