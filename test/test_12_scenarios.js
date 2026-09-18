/**
 * Comprehensive 12-Scenario Regression Test Suite for Pure Native GECX Playbook & Tools.
 */
const GECXService = require('../gecx_service');

const SCENARIOS = [
  { id: 1, category: 'Identity & Welcome', query: 'Who are you and what are you moderating today?' },
  { id: 2, category: 'Panel 1 (Billing Agent)', query: 'Explain how the generative billing agent assists customers.' },
  { id: 3, category: 'Panel 2 (Fleet Idling)', query: 'How does telematics and idling reduction AI save fuel for the fleet?' },
  { id: 4, category: 'Panel 3 (Manhole Acoustics)', query: 'How do acoustic sensors predict manhole events and arcing?' },
  { id: 5, category: 'Panel 4 (Weather Modeling)', query: 'How does meteorology AI assist grid storm hardening?' },
  { id: 6, category: 'Panel 5 (Clean Heat)', query: 'What is the Clean Heat program and heat pump incentive?' },
  { id: 7, category: 'Negative (Territory Probe)', query: 'Can you tell me how many neighborhoods you serve in New Jersey?' },
  { id: 8, category: 'Negative (Off-Topic Probe)', query: 'Who won the 1986 World Series?' },
  { id: 9, category: 'Live Tool (NWS Weather)', query: 'What are the current NWS weather advisories for NYC?' },
  { id: 10, category: 'Live Tool (NYISO Grid)', query: 'What is the current zero-carbon fuel mix on the electric grid?' },
  { id: 11, category: 'Live Tool (Clean Heat Calc)', query: 'Calculate heat pump rebate for 3,500 sq ft in Brooklyn' },
  { id: 12, category: 'Live Tool (Outages Telemetry)', query: 'What is the current system reliability and outage count?' }
];

async function runRegressionSuite() {
  const gecx = new GECXService({
    projectId: 'pradeep-demo-1',
    location: 'us-central1',
    agentId: '668bd4db-b76d-4f1b-be6b-8e290bb741bd'
  });

  console.log('=== STARTING 12-SCENARIO REGRESSION SUITE ===\n');
  const results = [];

  for (const s of SCENARIOS) {
    const t0 = Date.now();
    const res = await gecx.detectIntent(s.query, `regress-${s.id}-${Date.now()}`);
    const latency = Date.now() - t0;
    
    const passed = !!(res && res.reply && res.reply.length > 15 && !res.reply.includes('trouble processing'));
    results.push({
      id: s.id,
      category: s.category,
      query: s.query,
      latencyMs: latency,
      passed,
      reply: res.reply
    });

    console.log(`[${s.id}/12] [${passed ? 'PASS' : 'FAIL'}] (${latency}ms) ${s.category}`);
    console.log(`  Q: "${s.query}"`);
    console.log(`  A: "${res.reply}"\n`);
  }

  console.log('=== REGRESSION SUMMARY ===');
  const passCount = results.filter(r => r.passed).length;
  console.log(`Passed: ${passCount} / ${results.length}`);
  return passCount === results.length;
}

runRegressionSuite().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
