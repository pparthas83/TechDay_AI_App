/**
 * Con Edison Tech Day: Enterprise Hybrid Grounding Test Suite
 * 
 * Validates:
 * 1. Live Data Connectors (NWS, NYISO, Outages, Clean Heat Calculator)
 * 2. Intent Detection for real-time queries
 * 3. 1.5s Timeout SLA protection & graceful fallback
 * 4. Deterministic calculations (Zero hallucination mathematical accuracy)
 */

const assert = require('assert');
const liveDataService = require('../services/live_data_service');

async function runTests() {
  console.log('========================================================');
  console.log('   CON EDISON TECH DAY: ENTERPRISE HYBRID TEST SUITE    ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // ---------------------------------------------------------
  // 1. Intent Detection Tests
  // ---------------------------------------------------------
  console.log('[1] REAL-TIME INTENT DETECTION');

  test('Detects live weather queries', () => {
    assert.strictEqual(liveDataService.detectRealTimeQuery('Are there any active weather alerts right now?'), 'LIVE_WEATHER');
    assert.strictEqual(liveDataService.detectRealTimeQuery('What is the current wind gust forecast in NYC?'), 'LIVE_WEATHER');
  });

  test('Detects live NYISO fuel mix queries', () => {
    assert.strictEqual(liveDataService.detectRealTimeQuery('What is the current clean energy fuel mix on the grid?'), 'LIVE_GRID_MIX');
    assert.strictEqual(liveDataService.detectRealTimeQuery('How much solar and wind is flowing through NYISO right now?'), 'LIVE_GRID_MIX');
  });

  test('Detects live outage dashboard queries', () => {
    assert.strictEqual(liveDataService.detectRealTimeQuery('How many active outages are currently reported in Queens?'), 'LIVE_OUTAGES');
    assert.strictEqual(liveDataService.detectRealTimeQuery('Is there a blackout right now in Manhattan?'), 'LIVE_OUTAGES');
  });

  test('Detects clean heat sizing & rebate calculation queries', () => {
    assert.strictEqual(liveDataService.detectRealTimeQuery('Calculate the heat pump rebate for a 4000 sq ft building in Brooklyn'), 'CALCULATE_CLEAN_HEAT');
    assert.strictEqual(liveDataService.detectRealTimeQuery('What is the Clean Heat incentive for my 2,500 square foot home?'), 'CALCULATE_CLEAN_HEAT');
  });

  test('Detects capability questions for live services and tools', () => {
    assert.strictEqual(liveDataService.detectRealTimeQuery('Do you have access to national weather service?'), 'LIVE_WEATHER');
    assert.strictEqual(liveDataService.detectRealTimeQuery('Do you have access to NYISO Grid telemetry?'), 'LIVE_GRID_MIX');
    assert.strictEqual(liveDataService.detectRealTimeQuery('Do you have access to clean heat calculator?'), 'CALCULATE_CLEAN_HEAT');
    assert.strictEqual(liveDataService.detectRealTimeQuery('What live data and tools do you have access to?'), 'LIVE_CAPABILITIES');
  });

  test('Returns null for standard narrative queries (Zero false positives)', () => {
    assert.strictEqual(liveDataService.detectRealTimeQuery('Who is the moderator of the panel?'), null);
    assert.strictEqual(liveDataService.detectRealTimeQuery('Explain Use Case 3 acoustic sensors'), null);
    assert.strictEqual(liveDataService.detectRealTimeQuery('Tell me how many neighborhoods you serve in New Jersey'), null);
    assert.strictEqual(liveDataService.detectRealTimeQuery('Who won the 1986 World Series?'), null);
  });

  // ---------------------------------------------------------
  // 2. Deterministic Clean Heat Calculator Tests
  // ---------------------------------------------------------
  console.log('\n[2] DETERMINISTIC CLEAN HEAT & LL97 CALCULATION ENGINE');

  test('Computes exact standard residential heat pump sizing & rebate', () => {
    const res = liveDataService.calculateCleanHeatSizing({ sqft: 2500, borough: 'Queens', dacEligible: false });
    assert.strictEqual(res.status, 'PRELIMINARY_ESTIMATE');
    assert.strictEqual(res.recommendedTons, 4.2);
    assert.strictEqual(res.prescriptiveRebate, 8400); // 4.2 tons * $2,000/ton
    assert.strictEqual(res.dacEligible, false);
    assert.strictEqual(res.estimatedAnnualFuelSavings, 1890); // 4.2 tons * $450/ton
    assert.ok(res.verificationRequirement.includes('Manual J'), 'Should mandate Manual J calculation');
    assert.ok(res.disclaimer.includes('Manual J'), 'Disclaimer should mention Manual J load calculation');
    assert.ok(res.summaryText.includes('$8,400'));
    assert.ok(res.summaryText.includes('Manual J'));
  });

  test('Applies 50% Disadvantaged Communities (DAC) incentive bonus accurately', () => {
    const res = liveDataService.calculateCleanHeatSizing({ sqft: 2500, borough: 'The Bronx', dacEligible: true });
    assert.strictEqual(res.dacEligible, true);
    assert.strictEqual(res.prescriptiveRebate, 12600); // $8,400 * 1.5 = $12,600
    assert.ok(res.summaryText.includes('$12,600'));
  });

  test('Computes commercial Local Law 97 penalty exposure and payback', () => {
    const res = liveDataService.calculateCleanHeatSizing({ sqft: 35000, borough: 'Manhattan', dacEligible: false });
    assert.strictEqual(res.isCommercialLL97, true);
    assert.strictEqual(res.recommendedTons, 43.8);
    // Baseline emissions: 35000 * 0.0055 = 192.5 tCO2e
    // Excess: 192.5 - (35000 * 0.0035 = 122.5) = 70.0 tCO2e
    // Penalty: 70.0 * $268 = $18,760
    assert.strictEqual(res.ll97PenaltyAvoidedAnnual, 18760);
    assert.ok(res.summaryText.includes('$18,760'));
  });

  // ---------------------------------------------------------
  // 3. Real-Time External API Telemetry Connectors
  // ---------------------------------------------------------
  console.log('\n[3] REAL-TIME TELEMETRY CONNECTORS');

  await testAsync('Fetches National Weather Service (NWS) NYC alerts', async () => {
    const weather = await liveDataService.fetchNWSWeatherAlerts();
    assert.ok(weather.status, 'Weather should have status');
    assert.ok(weather.headline, 'Weather should have headline');
    assert.ok(typeof weather.activeAlertsCount === 'number');
  });

  await testAsync('Fetches NYISO Real-Time Grid Fuel Mix', async () => {
    const grid = await liveDataService.fetchNYISOGridFuelMix();
    assert.ok(grid.status, 'Grid should have status');
    assert.ok(grid.totalLoadMW > 0, 'Total load should be > 0');
    assert.ok(grid.cleanPercentage > 0, 'Clean percentage should be > 0');
    assert.ok(grid.summary.includes('MW'));
  });

  await testAsync('Fetches Con Edison Live Outage Operations Telemetry', async () => {
    const outages = await liveDataService.fetchLiveOutages();
    assert.ok(outages.status, 'Outages should have status');
    assert.ok(outages.customersServed >= 3500000, 'Customers served should be >= 3.5M');
    assert.ok(typeof outages.activeOutages === 'number', 'Active outages should be numeric');
    assert.ok(typeof outages.affectedCustomers === 'number', 'Affected customers should be numeric');
    assert.ok(outages.reliabilityRate.includes('99.'), 'Reliability rate should be 99.x%');
  });

  // ---------------------------------------------------------
  // 4. SLA 1.5s Hard Timeout Protection
  // ---------------------------------------------------------
  console.log('\n[4] 1.5-SECOND SLA TIMEOUT PROTECTION');

  await testAsync('Safe fallback when API call exceeds 1.5s timeout budget', async () => {
    const slowOperation = () => new Promise(resolve => setTimeout(() => resolve('Finished too late'), 2000));
    const fallbackVal = { status: 'FALLBACK_TRIGGERED' };

    const startTime = Date.now();
    const result = await liveDataService.withTimeout(slowOperation(), 500, fallbackVal);
    const duration = Date.now() - startTime;

    assert.deepStrictEqual(result, fallbackVal);
    assert.ok(duration < 800, `Duration was ${duration}ms, expected ~500ms`);
  });

  // ---------------------------------------------------------
  // Summary
  // ---------------------------------------------------------
  console.log('\n========================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
