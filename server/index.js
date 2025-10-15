console.log('[index.js] module loading');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { SpeechClient } = require('@google-cloud/speech');

// Load credentials either from GOOGLE_APPLICATION_CREDENTIALS env or bundled file
function loadCredentials() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // When set, the Google client libraries will pick it up automatically,
    // but we still allow reading it to surface helpful errors.
    try {
      const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const abs = path.isAbsolute(credsPath) ? credsPath : path.join(process.cwd(), credsPath);
      const content = fs.readFileSync(abs, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.warn('Failed to read GOOGLE_APPLICATION_CREDENTIALS:', e.message);
      return null;
    }
  }

  // Fallback to bundled credentials if present
  const fallback = path.join(__dirname, 'google-credentials.json');
  if (fs.existsSync(fallback)) {
    try {
      return JSON.parse(fs.readFileSync(fallback, 'utf8'));
    } catch (e) {
      console.warn('Failed to read bundled google-credentials.json:', e.message);
      return null;
    }
  }

  return null;
}

function createServer(options = {}) {
  // Prefer APP_PORT to allow platforms which inject PORT to remain untouched.
  // This avoids UI warnings when changing the platform provided PORT env var.
  const port = Number(process.env.APP_PORT || process.env.PORT || options.port || 3001);
  const host = options.host || '0.0.0.0';

  console.log('Port selection: ', {
    APP_PORT: process.env.APP_PORT || null,
    PLATFORM_PORT: process.env.PORT || null,
    final: port
  });

  const credentials = loadCredentials();
  const speechClient = credentials ? new SpeechClient({ credentials }) : new SpeechClient();

  const wss = new WebSocket.Server({ port, host }, () => {
    console.log(`WebSocket STT server listening on ${host}:${port}`);
  });

  wss.on('connection', function connection(ws) {
    console.log('New client connected');
    let recognizeStream = null;

    ws.on('message', function incoming(message) {
      try {
        // Control JSON messages start with '{'
        const isJson = (typeof message === 'string') || (message instanceof Buffer && message[0] === '{'.charCodeAt(0));

        if (isJson) {
          const control = JSON.parse(message.toString());

          if (control.type === 'start') {
            const languageCode = control.languageCode || 'en-US';
            console.log('Starting recognition stream. languageCode =', languageCode);

            const speechConfig = {
              config: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                languageCode,
                enableAutomaticPunctuation: true,
              },
              interimResults: true,
            };

            recognizeStream = speechClient
              .streamingRecognize(speechConfig)
              .on('error', (error) => {
                console.error('Recognition error:', error);
                try { ws.send(JSON.stringify({ type: 'error', error: error.message })); } catch (e) {}
              })
              .on('data', (data) => {
                if (data.results[0] && data.results[0].alternatives[0]) {
                  const transcript = data.results[0].alternatives[0].transcript;
                  const isFinal = data.results[0].isFinal;
                  try {
                    ws.send(JSON.stringify({ type: 'transcript', transcript, isFinal }));
                  } catch (e) {}
                }
              });

            try { ws.send(JSON.stringify({ type: 'started', languageCode })); } catch (e) {}

          } else if (control.type === 'stop') {
            console.log('Stopping recognition stream');
            if (recognizeStream) {
              recognizeStream.end();
              recognizeStream = null;
            }
          }
        } else if (recognizeStream) {
          // Binary audio chunks
          recognizeStream.write(message);
        }

      } catch (e) {
        console.error('Error processing message:', e);
        try { ws.send(JSON.stringify({ type: 'error', error: e.message })); } catch (ex) {}
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected');
      if (recognizeStream) {
        recognizeStream.end();
        recognizeStream = null;
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (recognizeStream) {
        recognizeStream.end();
        recognizeStream = null;
      }
    });
  });

  return wss;
}

// If run directly, start the server
if (require.main === module) {
  // Add global handlers so startup errors are visible in the platform logs
  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err && err.stack ? err.stack : err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason && reason.stack ? reason.stack : reason);
    process.exit(1);
  });

  createServer();
}

module.exports = { createServer };
