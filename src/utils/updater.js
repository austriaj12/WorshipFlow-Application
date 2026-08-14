const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

/**
 * Parses a version string into semantic version components.
 * e.g., "v1.0.14" -> { major: 1, minor: 0, patch: 14, prerelease: null }
 */
function parseSemver(versionStr) {
  if (!versionStr) return null;
  const cleaned = String(versionStr).trim().replace(/^v/i, '');
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

/**
 * Compares two semver strings.
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if v1 == v2.
 */
function compareSemver(v1, v2) {
  const s1 = parseSemver(v1);
  const s2 = parseSemver(v2);
  if (!s1 && !s2) return 0;
  if (!s1) return -1;
  if (!s2) return 1;

  if (s1.major !== s2.major) return s1.major - s2.major;
  if (s1.minor !== s2.minor) return s1.minor - s2.minor;
  if (s1.patch !== s2.patch) return s1.patch - s2.patch;

  if (!s1.prerelease && s2.prerelease) return 1;
  if (s1.prerelease && !s2.prerelease) return -1;
  if (s1.prerelease && s2.prerelease) return s1.prerelease.localeCompare(s2.prerelease);

  return 0;
}

/**
 * Checks if latest is newer than current.
 */
function isNewerVersion(latest, current) {
  return compareSemver(latest, current) > 0;
}

/**
 * Queries GitHub API for releases and finds the latest valid release and installer asset.
 */
async function checkGitHubUpdate(currentVersion, repo = 'austriaj12/WorshipFlow-Application') {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}/releases`,
      method: 'GET',
      headers: {
        'User-Agent': 'WorshipFlow-AutoUpdater',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            resolve({
              success: false,
              error: `GitHub API error: HTTP status ${res.statusCode}`
            });
            return;
          }

          const releases = JSON.parse(body);
          if (!Array.isArray(releases) || releases.length === 0) {
            resolve({
              success: true,
              currentVersion,
              latestVersion: currentVersion,
              hasUpdate: false,
              notes: ''
            });
            return;
          }

          // Filter out draft and pre-releases unless necessary
          const validReleases = releases.filter(r => !r.draft && !r.prerelease);
          const targetReleases = validReleases.length > 0 ? validReleases : releases.filter(r => !r.draft);

          // Find release with highest semver version
          let latestRelease = targetReleases[0];
          for (const rel of targetReleases) {
            const relVer = rel.tag_name || rel.name;
            const latestVer = latestRelease.tag_name || latestRelease.name;
            if (compareSemver(relVer, latestVer) > 0) {
              latestRelease = rel;
            }
          }

          const rawTag = latestRelease.tag_name || latestRelease.name || '';
          const latestVersion = rawTag.replace(/^v/i, '');
          const hasUpdate = isNewerVersion(latestVersion, currentVersion);

          // Find Windows installer asset (.exe) - ignore elevate.exe helpers
          const assets = latestRelease.assets || [];
          const exeAssets = assets.filter(a => 
            a.name.toLowerCase().endsWith('.exe') && 
            !a.name.toLowerCase().endsWith('.blockmap') &&
            !a.name.toLowerCase().endsWith('.sig') &&
            !a.name.toLowerCase().includes('elevate')
          );

          // Prefer asset containing 'setup' or 'worshipflow', or largest size
          let exeAsset = exeAssets.find(a => 
            a.name.toLowerCase().includes('setup') || a.name.toLowerCase().includes('worshipflow')
          );

          if (!exeAsset && exeAssets.length > 0) {
            exeAssets.sort((a, b) => (b.size || 0) - (a.size || 0));
            exeAsset = exeAssets[0];
          }

          resolve({
            success: true,
            currentVersion,
            latestVersion,
            hasUpdate,
            notes: latestRelease.body || '',
            downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
            fileName: exeAsset ? exeAsset.name : null,
            assetSize: exeAsset ? exeAsset.size : 0
          });
        } catch (err) {
          resolve({ success: false, error: `Failed to parse release data: ${err.message}` });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: `Network error checking updates: ${err.message}` });
    });

    req.end();
  });
}

/**
 * Downloads update asset following HTTP 301/302 redirects with progress reporting.
 */
function downloadUpdateAsset(downloadUrl, targetPath, onProgress, maxRedirects = 10) {
  let activeReq = null;
  let isCancelled = false;

  const cancel = () => {
    isCancelled = true;
    if (activeReq) {
      activeReq.destroy();
    }
  };

  const promise = new Promise((resolve) => {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Temporary file path while downloading
    const partPath = `${targetPath}.part`;
    if (fs.existsSync(partPath)) {
      try { fs.unlinkSync(partPath); } catch (e) {}
    }

    const downloadStep = (currentUrl, redirectsLeft) => {
      if (isCancelled) {
        resolve({ success: false, cancelled: true, error: 'Download cancelled by user' });
        return;
      }

      if (redirectsLeft <= 0) {
        resolve({ success: false, error: 'Too many HTTP redirects' });
        return;
      }

      const client = currentUrl.startsWith('https') ? https : http;
      activeReq = client.get(currentUrl, {
        headers: {
          'User-Agent': 'WorshipFlow-AutoUpdater'
        }
      }, (res) => {
        // Handle HTTP Redirects (301, 302, 303, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadStep(res.headers.location, redirectsLeft - 1);
          return;
        }

        if (res.statusCode !== 200) {
          resolve({ success: false, error: `HTTP download failed with status ${res.statusCode}` });
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(partPath);

        res.on('data', (chunk) => {
          if (isCancelled) {
            res.destroy();
            fileStream.destroy();
            return;
          }
          downloadedBytes += chunk.length;
          fileStream.write(chunk);

          if (typeof onProgress === 'function') {
            const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            onProgress({
              bytesDownloaded: downloadedBytes,
              totalBytes,
              percent
            });
          }
        });

        res.on('end', () => {
          fileStream.end(() => {
            if (isCancelled) {
              if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
              resolve({ success: false, cancelled: true, error: 'Download cancelled by user' });
              return;
            }

            // Rename .part to actual target path
            try {
              if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
              fs.renameSync(partPath, targetPath);
              resolve({ success: true, filePath: targetPath });
            } catch (err) {
              resolve({ success: false, error: `Failed to finalize downloaded file: ${err.message}` });
            }
          });
        });

        res.on('error', (err) => {
          fileStream.destroy();
          if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
          resolve({ success: false, error: `Download stream error: ${err.message}` });
        });
      });

      activeReq.on('error', (err) => {
        if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
        if (isCancelled) {
          resolve({ success: false, cancelled: true, error: 'Download cancelled by user' });
        } else {
          resolve({ success: false, error: `Download connection error: ${err.message}` });
        }
      });
    };

    downloadStep(downloadUrl, maxRedirects);
  });

  return { promise, cancel };
}

/**
 * Verifies that a downloaded binary file is valid (exists, size > 0, matching expected size, PE magic bytes MZ).
 */
function verifyUpdatePackage(filePath, expectedSize = 0) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'Update installer file does not exist.' };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { valid: false, error: 'Downloaded update file is 0 bytes (empty).' };
    }

    if (expectedSize > 0 && stats.size !== expectedSize) {
      return { valid: false, error: `Downloaded size (${stats.size}) does not match expected size (${expectedSize}).` };
    }

    // Verify Windows PE Header ("MZ" = 0x4D 0x5A)
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(2);
    fs.readSync(fd, buffer, 0, 2, 0);
    fs.closeSync(fd);

    if (buffer[0] !== 0x4D || buffer[1] !== 0x5A) {
      return { valid: false, error: 'Downloaded update file is not a valid Windows executable binary.' };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Verification exception: ${err.message}` };
  }
}

/**
 * Creates a PowerShell runner script to execute after the main process exits,
 * then launches it detached and unreferenced.
 */
function stageAndLaunchUpdater(installerPath, targetExePath, pid) {
  try {
    const updateDir = path.dirname(installerPath);
    const cmdScriptPath = path.join(updateDir, 'install_update.cmd');

    const exeName = path.basename(targetExePath) || 'WorshipFlow.exe';

    // Create CMD script to wait for WorshipFlow process to close, run installer silently, and relaunch app
    const cmdScriptContent = `@echo off
title WorshipFlow Auto-Updater
echo Updating WorshipFlow, please wait...

:wait_loop
tasklist /FI "IMAGENAME eq ${exeName}" 2>NUL | find /I /N "${exeName}">NUL
if "%ERRORLEVEL%"=="0" (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)

timeout /t 2 /nobreak >nul

if exist "${installerPath}" (
    start /wait "" "${installerPath}" /S
)

timeout /t 2 /nobreak >nul

if exist "${targetExePath}" (
    start "" "${targetExePath}"
) else if exist "%LOCALAPPDATA%\\Programs\\worshipflow\\${exeName}" (
    start "" "%LOCALAPPDATA%\\Programs\\worshipflow\\${exeName}"
)
`;

    fs.writeFileSync(cmdScriptPath, cmdScriptContent, 'utf8');

    // Spawn cmd.exe detached background process
    const child = spawn('cmd.exe', ['/c', cmdScriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });

    child.unref();
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to stage update process: ${err.message}` };
  }
}

module.exports = {
  parseSemver,
  compareSemver,
  isNewerVersion,
  checkGitHubUpdate,
  downloadUpdateAsset,
  verifyUpdatePackage,
  stageAndLaunchUpdater
};
