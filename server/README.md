# Webstock STT WebSocket Server

This repository contains a standalone WebSocket server that proxies live audio to Google Cloud Speech-to-Text and streams transcripts back to connected clients. It's extracted from the original `webstock` project so you can deploy it on Render, Railway, Heroku, or any VPS instead of Vercel.

Features
- WebSocket server (binds to 0.0.0.0 and PORT)
- Supports control messages: `{ type: 'start', languageCode: 'en-US' }` and `{ type: 'stop' }`
- Streams binary audio (LINEAR16, 16 kHz) to Google Cloud STT
- Credentials can be supplied via `GOOGLE_APPLICATION_CREDENTIALS` env var or bundled `google-credentials.json` (not recommended for production)

Quick start (local)

1. Install dependencies

```powershell
cd server
npm install
```

2. Start the server

```powershell
# Option A: use a credentials file path
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\creds.json"
npm start

# Option B: copy a credentials file to server/google-credentials.json (not recommended)
npm start
```

3. Connect from your frontend via WebSocket to `ws://<host>:<PORT>` (default PORT=3001). Send a start control message before sending audio:

```json
{ "type": "start", "languageCode": "en-US" }
```

Then stream raw PCM 16-bit little-endian LINEAR16 at 16kHz as binary messages. When finished, send `{ "type": "stop" }`.

Deploying

- Render / Railway: set `PORT` (some platforms provide this automatically) and add a secret or file for `GOOGLE_APPLICATION_CREDENTIALS`. On Render you can upload the JSON as a secret and point the env var to the file path.
- Heroku: add the credentials JSON to a config var (base64-encoded) and write a small start script to decode it to a file and set `GOOGLE_APPLICATION_CREDENTIALS` before starting.

Security note
- Do not commit service account credentials to source control for production. Use provider secrets.

If you want, I can add a small sample client (browser) that records microphone audio and connects to this server.
