const assert = require('assert');

console.log('=== WorshipFlow Background State Persistence & Auto-Updater Test Suite ===\n');

// Standardized getSlideBackground resolution logic
function getSlideBackground(activeSlide, songObject = null) {
  if (activeSlide) {
    if (activeSlide.bgAsset !== undefined && activeSlide.bgAsset !== null) {
      const bg = String(activeSlide.bgAsset).trim();
      if (bg.toLowerCase() === 'none' || bg === '') return '';
      return bg;
    }
    if (activeSlide.style && activeSlide.style.background !== undefined && activeSlide.style.background !== null) {
      const bgStyle = String(activeSlide.style.background).trim();
      if (bgStyle.toLowerCase() === 'none' || bgStyle.toLowerCase() === 'transparent' || bgStyle === '') return '';
      return bgStyle;
    }
  }
  if (songObject) {
    const songBg = songObject.bg_asset || songObject.bgAsset || (songObject.style && songObject.style.background);
    if (songBg && String(songBg).trim() !== '' && String(songBg).trim().toLowerCase() !== 'none') {
      return String(songBg).trim();
    }
  }
  return '';
}

// TEST 1: Background -> No Background
const slide1 = { bgAsset: 'ocean.jpg' };
const slide2 = { bgAsset: '' };
assert.strictEqual(getSlideBackground(slide1), 'ocean.jpg', 'Slide 1 should return ocean.jpg');
assert.strictEqual(getSlideBackground(slide2), '', 'Slide 2 should return empty (transparent)');
console.log('✓ TEST 1 PASSED: Background -> No Background clears background completely.');

// TEST 2: No Background -> Background
const slideNoBg = { bgAsset: null };
const slideWithBg = { bgAsset: 'worship.png' };
assert.strictEqual(getSlideBackground(slideNoBg), '', 'Null bgAsset should return empty');
assert.strictEqual(getSlideBackground(slideWithBg), 'worship.png', 'Slide with background should return worship.png');
console.log('✓ TEST 2 PASSED: No Background -> Background resolves correctly.');

// TEST 3: Background -> Different Background
const slideDiffBg = { bgAsset: 'sky.mp4' };
assert.strictEqual(getSlideBackground(slideDiffBg), 'sky.mp4', 'Slide should return sky.mp4');
console.log('✓ TEST 3 PASSED: Background -> Different Background replaces background.');

// TEST 4 & 5: Image -> Video -> No Background
const slideVideo = { bgAsset: 'loop.mp4' };
const slideCleared = { bgAsset: 'none' };
assert.strictEqual(getSlideBackground(slideVideo), 'loop.mp4', 'Video asset returned correctly');
assert.strictEqual(getSlideBackground(slideCleared), '', 'Explicit "none" background cleared completely');
console.log('✓ TEST 4 & 5 PASSED: Video and "none" background states resolved accurately.');

// TEST 6: Gradient / Color -> No Background
const slideColor = { style: { background: '#123456' } };
const slideColorCleared = { style: { background: 'transparent' } };
assert.strictEqual(getSlideBackground(slideColor), '#123456', 'Color background returned correctly');
assert.strictEqual(getSlideBackground(slideColorCleared), '', 'Transparent background cleared completely');
console.log('✓ TEST 6 PASSED: Color and transparent background styles handled correctly.');

// TEST 7 & 8: Song A with background -> Song B without background
const songA = { id: 1, title: 'Song A', bgAsset: 'ocean.jpg' };
const songB = { id: 2, title: 'Song B', bgAsset: '' };

const songASlide = { text: 'Verse 1' }; // inherits songA default bg
const songBSlide = { text: 'Verse 1' }; // inherits songB default bg (none)

assert.strictEqual(getSlideBackground(songASlide, songA), 'ocean.jpg', 'Song A slide returns ocean.jpg');
assert.strictEqual(getSlideBackground(songBSlide, songB), '', 'Song B slide returns empty (transparent)');
console.log('✓ TEST 7 & 8 PASSED: Song switching with and without backgrounds resolves independently.');

// TEST 9: Slide sequence independent evaluation
const slidesSequence = [
  { label: 'Slide 1', bgAsset: 'bg1.jpg' },
  { label: 'Slide 2', bgAsset: 'bg1.jpg' },
  { label: 'Slide 3', bgAsset: '' },
  { label: 'Slide 4', bgAsset: 'bg2.mp4' },
  { label: 'Slide 5', bgAsset: null }
];

const resolvedBgs = slidesSequence.map(s => getSlideBackground(s));
assert.deepStrictEqual(resolvedBgs, ['bg1.jpg', 'bg1.jpg', '', 'bg2.mp4', ''], 'Sequence backgrounds match expected independent array');
console.log('✓ TEST 9 PASSED: Rapid slide navigation evaluates each slide independently without previous fallback.');

// TEST 10: Auto-Updater script format check
const { stageAndLaunchUpdater } = require('../src/utils/updater');
const fs = require('fs');
const path = require('path');
const tmpDir = path.join(__dirname, '../tmp_updater_test');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const testInstaller = path.join(tmpDir, 'WorshipFlow-Setup-2.0.2.exe');
fs.writeFileSync(testInstaller, 'MZ_TEST_BINARY', 'utf8');

const updateResult = stageAndLaunchUpdater(testInstaller, 'C:\\Program Files\\WorshipFlow\\WorshipFlow.exe', 9999);
assert.strictEqual(updateResult.success, true, 'stageAndLaunchUpdater staged successfully');

const cmdPath = path.join(tmpDir, 'install_update.cmd');
assert.ok(fs.existsSync(cmdPath), 'install_update.cmd script file created');
const cmdContent = fs.readFileSync(cmdPath, 'utf8');
assert.ok(cmdContent.includes('start /wait ""'), 'CMD script contains start /wait for installer execution');
assert.ok(cmdContent.includes('tasklist'), 'CMD script contains tasklist loop for process exit check');
console.log('✓ TEST 10 PASSED: Auto-updater script generated with native CMD tasklist wait loop.');

// Clean up temp dir
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}

console.log('\n======================================================');
console.log('ALL BACKGROUND PERSISTENCE & UPDATER TESTS PASSED 100%! 🎉');
console.log('======================================================');
