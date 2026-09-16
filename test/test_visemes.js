/**
 * Con Edison Tech Day - Phoneme Viseme Engine Test Suite
 * Tests the export from avatar_stage.js
 */
const assert = require('assert');
const { VISEME_MAP, parseTextToVisemeTimeline, getInterpolatedViseme } = require('../avatar_stage.js');

console.log('Testing Phoneme-Viseme Engine from avatar_stage.js...');

// Test 1: Timeline generation
const text = "Welcome everyone to Con Edison's Tech Day: AI in Action.";
const timeline = parseTextToVisemeTimeline(text);
assert(timeline.length > 20, 'Timeline should contain over 20 phonemic segments');
assert.strictEqual(timeline[0].start, 0.0, 'Timeline must start at 0.0');
assert(Math.abs(timeline[timeline.length - 1].end - 1.0) < 0.001, 'Timeline must end at 1.0');
console.log('  ✓ PASS: parseTextToVisemeTimeline generates complete normalized sequence');

// Test 2: Bilabial closure on 'm' in 'welcome'
const welcomeM = timeline.find(t => t.text === 'm');
assert(welcomeM, "Found 'm' in timeline");
assert.strictEqual(welcomeM.viseme, 'P_B_M', "'m' should map to P_B_M bilabial");
const targetM = VISEME_MAP[welcomeM.viseme];
assert.strictEqual(targetM.mouthClose, 0.95, 'Bilabial must close lips (mouthClose = 0.95)');
assert.strictEqual(targetM.jawOpen, 0.02, 'Bilabial jawOpen must be minimal (0.02)');
console.log('  ✓ PASS: Bilabial consonants (P, B, M) trigger anatomical lip closure');

// Test 3: Rounded vowel on 'w' / 'o'
const welcomeW = timeline.find(t => t.text === 'w');
assert(welcomeW, "Found 'w' in timeline");
assert.strictEqual(welcomeW.viseme, 'W_OO', "'w' should map to W_OO rounded");
const targetW = VISEME_MAP[welcomeW.viseme];
assert.strictEqual(targetW.mouthFunnel, 0.42, 'W_OO must funnel lips (0.42)');
console.log('  ✓ PASS: Rounded semivowels and vowels (W, OO) trigger circular lip funnels');

// Test 4: Spread smiling front vowel on 'day' / 'ai'
const dayAy = timeline.find(t => t.text === 'ay');
assert(dayAy, "Found 'ay' in timeline");
assert.strictEqual(dayAy.viseme, 'EE_IY', "'ay' should map to EE_IY spread");
const targetAy = VISEME_MAP[dayAy.viseme];
assert.strictEqual(targetAy.mouthStretchLeft, 0.48, 'EE_IY must stretch horizontally');
assert.strictEqual(targetAy.mouthSmile, 0.42, 'EE_IY must engage smile');
console.log('  ✓ PASS: Front spread vowels (EE, AY, I) trigger horizontal grin and lateral stretch');

// Test 5: Co-articulation interpolation
const midP = (welcomeM.start + welcomeM.end) / 2;
const sampleAtM = getInterpolatedViseme(timeline, midP, VISEME_MAP);
assert.strictEqual(sampleAtM.viseme, 'P_B_M');
assert(sampleAtM.target.mouthClose > 0.8, 'Interpolated bilabial retains high lip closure');
console.log('  ✓ PASS: getInterpolatedViseme provides smooth co-articulation blending');

// Test 6: Zero pucker constraint
for (const [k, v] of Object.entries(VISEME_MAP)) {
  assert.strictEqual(v.mouthPucker, 0.0, `Viseme ${k} must have mouthPucker = 0.0 to prevent tubular beak`);
}
console.log('  ✓ PASS: All visemes adhere strictly to mouthPucker = 0.0');

console.log('All 6 Phoneme Viseme tests in avatar_stage.js passed successfully!\n');
