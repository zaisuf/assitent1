const WebSocket = require('ws');
const { SpeechClient } = require('@google-cloud/speech');
const fs = require('fs');

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 3001 });
console.log('WebSocket server started on port 3001');

// Create a Speech-to-Text client with credentials from file
const credentials = JSON.parse(fs.readFileSync('./server/google-credentials.json', 'utf8'));
const speechClient = new SpeechClient({ credentials });

wss.on('connection', function connection(ws) {
  console.log('New client connected');
  
  let recognizeStream = null;

  ws.on('message', function incoming(message) {
    try {
      // Handle control messages (JSON)
      if (typeof message === 'string' || message instanceof Buffer && message[0] === '{'.charCodeAt(0)) {
        const control = JSON.parse(message.toString());
        
        if (control.type === 'start') {
          // Allow the client to request a languageCode; default to en-US
          const chosenLang = control.languageCode || 'en-US';
          console.log('Starting new recognition stream. languageCode =', chosenLang);
          
          // Create the recognize stream
          recognizeStream = speechClient
            .streamingRecognize({
              config: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                languageCode: chosenLang,
                enableAutomaticPunctuation: true,
              },
              interimResults: true,
            })
            .on('error', (error) => {
              console.error('Recognition error:', error);
              ws.send(JSON.stringify({ type: 'error', error: error.message }));
            })
            .on('data', (data) => {
              if (data.results[0] && data.results[0].alternatives[0]) {
                const transcript = data.results[0].alternatives[0].transcript;
                const isFinal = data.results[0].isFinal;
                
                ws.send(JSON.stringify({
                  type: 'transcript',
                  transcript,
                  isFinal
                }));
              }
            });

          // Acknowledge start and chosen language back to the client
          try {
            ws.send(JSON.stringify({ type: 'started', languageCode: chosenLang }));
          } catch (e) {
            console.error('Failed to send start ack:', e);
          }

        } else if (control.type === 'stop') {
          console.log('Stopping recognition stream');
          if (recognizeStream) {
            recognizeStream.end();
            recognizeStream = null;
          }
        }
      }
      // Handle audio data (binary)
      else if (recognizeStream) {
        recognizeStream.write(message);
      }
    } catch (e) {
      console.error('Error processing message:', e);
      ws.send(JSON.stringify({ type: 'error', error: e.message }));
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
