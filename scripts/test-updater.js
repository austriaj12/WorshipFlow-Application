const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  parseSemver,
  compareSemver,
  isNewerVersion,
  checkGitHubUpdate,
  verifyUpdatePackage,
  stageAndLaunchUpdater
} = require('../src/utils/updater');

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('\n--- 1. Testing SemVer Parsing & Comparison ---');
  
  assert(compareSemver('1.0.14', '1.0.13') > 0, 'v1.0.14 is newer than v1.0.13');
  assert(compareSemver('1.1.0', '1.0.13') > 0, 'v1.1.0 is newer than v1.0.13');
  assert(compareSemver('2.0.0', '1.0.13') > 0, 'v2.0.0 is newer than v1.0.13');
  assert(compareSemver('v1.0.14', '1.0.14') === 0, 'v1.0.14 equals 1.0.14');
  assert(compareSemver('1.0.13', '1.0.14') < 0, 'v1.0.13 is older than v1.0.14');
  assert(compareSemver('1.0.13', '1.0.13') === 0, 'v1.0.13 equals v1.0.13');
  assert(compareSemver('1.0.14', '1.0.14-beta.1') > 0, 'Full release 1.0.14 is newer than 1.0.14-beta.1');
  assert(isNewerVersion('1.0.14', '1.0.13') === true, 'isNewerVersion returns true for 1.0.14 vs 1.0.13');
  assert(isNewerVersion('1.0.13', '1.0.13') === false, 'isNewerVersion returns false for 1.0.13 vs 1.0.13');

  console.log('\n--- 2. Testing Update Package Verification ---');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-update-test-'));
  
  // Test non-existent file
  const nonExistent = path.join(tempDir, 'missing.exe');
  const resMissing = verifyUpdatePackage(nonExistent);
  assert(resMissing.valid === false, 'Rejects missing file');

  // Test 0-byte empty file
  const emptyFile = path.join(tempDir, 'empty.exe');
  fs.writeFileSync(emptyFile, Buffer.alloc(0));
  const resEmpty = verifyUpdatePackage(emptyFile);
  assert(resEmpty.valid === false, 'Rejects 0-byte file');

  // Test invalid header file (corrupted)
  const corruptFile = path.join(tempDir, 'corrupt.exe');
  fs.writeFileSync(corruptFile, Buffer.from('NOT AN EXE FILE'));
  const resCorrupt = verifyUpdatePackage(corruptFile);
  assert(resCorrupt.valid === false, 'Rejects corrupted non-PE executable file');

  // Test valid PE executable header ("MZ" = 0x4D 0x5A)
  const validPeFile = path.join(tempDir, 'valid.exe');
  const peBuffer = Buffer.alloc(100);
  peBuffer[0] = 0x4D; // M
  peBuffer[1] = 0x5A; // Z
  fs.writeFileSync(validPeFile, peBuffer);
  const resValid = verifyUpdatePackage(validPeFile, 100);
  assert(resValid.valid === true, 'Validates executable file with MZ PE header and correct size');

  // Cleanup temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n--- 3. Testing GitHub Releases Integration ---');
  const gitHubResult = await checkGitHubUpdate('1.0.13', 'austriaj12/WorshipFlow-Application');
  assert(gitHubResult.success === true, 'Successfully queried GitHub Releases API');
  assert(typeof gitHubResult.hasUpdate === 'boolean', 'GitHub result contains boolean hasUpdate');
  console.log(`Installed: ${gitHubResult.currentVersion}, Latest: ${gitHubResult.latestVersion}, Has Update: ${gitHubResult.hasUpdate}`);
  if (gitHubResult.downloadUrl) {
    console.log(`Download URL: ${gitHubResult.downloadUrl}`);
    assert(gitHubResult.downloadUrl.endsWith('.exe'), 'Download URL points to a .exe file');
  }

  console.log('\n--- 4. Testing PowerShell Updater Staging Script ---');
  const stageTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-stage-test-'));
  const dummyInstaller = path.join(stageTestDir, 'installer.exe');
  const dummyTarget = path.join(stageTestDir, 'WorshipFlow.exe');
  fs.writeFileSync(dummyInstaller, 'test');
  
  const stageRes = stageAndLaunchUpdater(dummyInstaller, dummyTarget, 99999);
  assert(stageRes.success === true, 'Successfully staged updater PowerShell runner');
  const psScriptPath = path.join(stageTestDir, 'install_update.ps1');
  assert(fs.existsSync(psScriptPath), 'install_update.ps1 file was created in update directory');
  const psContent = fs.readFileSync(psScriptPath, 'utf8');
  assert(psContent.includes('Wait-Process') && psContent.includes('Start-Process') && psContent.includes('/S'), 'PowerShell script contains correct silent installer execution logic');

  try {
    fs.rmSync(stageTestDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n🎉 ALL UPDATER TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
