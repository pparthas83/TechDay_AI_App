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
assert.strictEqual(targetM.mouthClose, 0.38, 'Bilabial must close lips naturally (mouthClose = 0.38)');
assert.strictEqual(targetM.mouthPressLeft, 0.0, 'Bilabial mouthPress must be 0.0 to prevent puckered smooch');
assert.strictEqual(targetM.jawOpen, 0.04, 'Bilabial jawOpen must be relaxed (0.04)');
assert(targetM.mouthStretchLeft >= 0.15, 'Bilabial retains lateral stretch to prevent narrow lip bunching');
console.log('  ✓ PASS: Bilabial consonants (P, B, M) trigger natural lip closure without smooch pout');

// Test 3: Rounded vowel on 'w' / 'o'
const welcomeW = timeline.find(t => t.text === 'w');
assert(welcomeW, "Found 'w' in timeline");
assert.strictEqual(welcomeW.viseme, 'W_OO', "'w' should map to W_OO rounded");
const targetW = VISEME_MAP[welcomeW.viseme];
assert.strictEqual(targetW.mouthFunnel, 0.42, 'W_OO must funnel lips (0.42)');
assert.strictEqual(targetW.mouthStretchLeft, 0.0, 'W_OO must maintain 0.0 stretch for pure circular funnel');
console.log('  ✓ PASS: Rounded semivowels and vowels (W, OO) trigger circular lip funnels without lateral interference');

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
assert(sampleAtM.target.mouthClose >= 0.30, 'Interpolated bilabial retains natural lip closure');
console.log('  ✓ PASS: getInterpolatedViseme provides smooth co-articulation blending');

// Test 6: Zero pucker constraint
for (const [k, v] of Object.entries(VISEME_MAP)) {
  assert.strictEqual(v.mouthPucker, 0.0, `Viseme ${k} must have mouthPucker = 0.0 to prevent tubular beak`);
}
console.log('  ✓ PASS: All visemes adhere strictly to mouthPucker = 0.0');

// Test 7: Guardrail - Silent 'e' suppression (Elimination of double-flap)
const welcomeSegments = timeline.slice(0, 6);
const trailingE = welcomeSegments.find((s, idx) => idx > 0 && welcomeSegments[idx - 1].text === 'm' && s.text === 'e');
assert(!trailingE, "'welcome' must not articulate a trailing silent 'e' after 'm'");
console.log('  ✓ PASS: Multi-syllabic silent trailing e suppressed (no double-flap on welcome)');

// Test 8: Guardrail - Monosyllable vowel preservation
const weTimeline = parseTextToVisemeTimeline("we are together");
assert(weTimeline.some(t => t.viseme === 'EE_IY'), "'we' must preserve front vowel EE_IY");
const theTimeline = parseTextToVisemeTimeline("the grid");
assert(theTimeline.some(t => t.viseme === 'E_EH'), "'the' must preserve schwa vowel E_EH");
console.log('  ✓ PASS: Monosyllabic words (we, the) retain voiced vowels');

// Test 9: Guardrail - Continuous speech flow without artificial inter-word PAUSE
const interWordPauses = timeline.filter(t => t.text === ' ');
assert.strictEqual(interWordPauses.length, 0, 'No artificial PAUSE injected between adjacent words');
console.log('  ✓ PASS: Continuous speech phonation connects words without inter-word clamps');

console.log('All 9 Phoneme Viseme tests in avatar_stage.js passed successfully!\n');
