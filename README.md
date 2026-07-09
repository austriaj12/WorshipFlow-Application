# WorshipFlow

WorshipFlow is a local-first worship presentation app built with Electron, React, Vite, and SQLite. It is designed for church services and similar live presentations where one operator controls the main display, projector output, stage display, and mobile remote from the same app.

## What this app does

- Manages a local song library stored in SQLite
- Builds and reorders a service playlist
- Sends live lyrics to a projector screen
- Shows a separate stage display with next-slide and clock panels
- Provides a mobile remote control over the local network
- Supports Bible verse lookup
- Supports image/video backgrounds, blackout, and clear-lyrics modes
- Imports PDF and PowerPoint presentations into slide sets

## How it works

The app is split into a few parts:

- `src/main.js` is the Electron main process. It creates windows, handles IPC, starts the local WebSocket/HTTP server, and connects the renderer to the database.
- `src/database.js` manages the local SQLite database. The database file is created automatically in the user app data folder as `worship.db`.
- `src/preload.js` exposes a limited API bridge to the UI so the renderer can talk to Electron safely through `window.api` and `window.stageServer`.
- `src/renderer/operator.jsx` is the main control dashboard for songs, playlist, live output, backgrounds, settings, and remote sync.
- `src/renderer/projector.jsx` renders the fullscreen audience/projector view.
- `src/renderer/stageDisplay.jsx` renders the stage display.
- `src/renderer/remoteDisplay.jsx` powers the mobile remote interface.

Flow summary:

1. Open the operator window.
2. Load or create songs in the local database.
3. Add songs to the playlist.
4. Click a slide to send it live.
5. Open the projector window for the audience screen.
6. Use the stage display and mobile remote if needed.

## Requirements

- Windows 10 or Windows 11 is strongly recommended
- Node.js 18 or newer
- npm
- Microsoft PowerPoint is required only if you want the PowerPoint import feature to work
- A local network is needed for the mobile remote and stage server

## Install

```bash
npm install
```

If you are using Windows PowerShell and `npm` is blocked by execution policy, use:

```bash
cmd /c npm install
```

## Run in development

This repository currently runs the Electron app together with the Vite dev server.

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm start
```

If PowerShell blocks `npm`, use:

```bash
cmd /c npm run dev
cmd /c npm start
```

Notes:

- `npm run dev` starts the Vite renderer server on `http://localhost:5173`
- `npm start` launches Electron
- In this codebase, Electron loads the dev server while running unpackaged
- The stage/remote local server starts automatically on port `5174`

## Build the app

```bash
npm run build
```

This generates the production renderer files in `dist/`.

Important:

- The current repository builds the front-end assets only
- It now includes a Windows packaging script and GitHub Actions release workflow
- The release workflow generates a downloadable Windows installer when you push a tag like `v1.0.0`

## How to publish on GitHub

GitHub does not turn the app into an installable package automatically. The normal flow is:

1. Build the app
2. Package it into a Windows installer or portable archive
3. Upload that file to GitHub Releases
4. Share the release download link

This repo now has a release workflow at [`.github/workflows/release.yml`](/D:/Alab%20Worship/.github/workflows/release.yml) that can automate the installer build and release upload.

Recommended desktop release formats:

- `.exe` installer
- `.msi` installer
- `.zip` portable build

For laptops and computers, do **not** use APK. APK is for Android devices only.

So the answer is:

- Yes, GitHub can host the download file
- Yes, users can download it directly from a link
- No, GitHub will not auto-install it for them
- For Windows PCs and laptops, use an installer or portable desktop build, not APK

## Security and stability notes

- All app data is stored locally in the user profile folder, not in the cloud
- The SQLite database stays on the machine unless the user manually copies it
- The mobile remote and stage views communicate over the local network
- For a public release, it is best to code-sign the installer and review Electron security settings before publishing
- Because this app imports PowerPoint files through Microsoft PowerPoint COM automation, that feature is Windows-only

## Default ports

- Vite dev server: `5173`
- Local stage/remote server: `5174`

## Project structure

```text
src/
  main.js
  database.js
  preload.js
  index.html
  projector.html
  remote.html
  stage.html
  renderer/
    operator.jsx
    projector.jsx
    remoteDisplay.jsx
    stageDisplay.jsx
    store.js
    index.css
dist/
  Generated build output
scripts/
  Utility scripts
```

## Common issues

### App opens but looks blank

- Make sure `npm run dev` is running before `npm start`
- Make sure port `5173` is free

### PowerPoint import fails

- Install Microsoft PowerPoint on the machine
- Try using the PDF import option instead

### Mobile remote cannot connect

- Make sure the phone/tablet is on the same Wi-Fi network
- Check that the stage server is running on port `5174`
- Make sure Windows firewall is not blocking local network access

### Database is missing

- The database is created automatically on first launch
- The file is stored as `worship.db` in the app data directory

## Recommended next step before release

If you want the release to be smoother and more trusted for end users, the next upgrades are code signing, automated versioning, and a proper app icon for the Windows installer.
