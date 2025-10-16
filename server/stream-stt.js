const http = require('http');
const WebSocket = require('ws');
const { SpeechClient } = require('@google-cloud/speech');

// Language configuration
const supportedLanguages = {
  'af-ZA': 'Afrikaans (South Africa)',
  'ar-AE': 'Arabic (UAE)',
  'ar-BH': 'Arabic (Bahrain)',
  'ar-DZ': 'Arabic (Algeria)',
  'ar-EG': 'Arabic (Egypt)',
  'ar-IL': 'Arabic (Israel)',
  'ar-IQ': 'Arabic (Iraq)',
  'ar-JO': 'Arabic (Jordan)',
  'ar-KW': 'Arabic (Kuwait)',
  'ar-LB': 'Arabic (Lebanon)',
  'ar-MA': 'Arabic (Morocco)',
  'ar-OM': 'Arabic (Oman)',
  'ar-PS': 'Arabic (State of Palestine)',
  'ar-QA': 'Arabic (Qatar)',
  'ar-SA': 'Arabic (Saudi Arabia)',
  'ar-TN': 'Arabic (Tunisia)',
  'bg-BG': 'Bulgarian (Bulgaria)',
  'bn-BD': 'Bengali (Bangladesh)',
  'bn-IN': 'Bengali (India)',
  'ca-ES': 'Catalan (Spain)',
  'cs-CZ': 'Czech (Czech Republic)',
  'da-DK': 'Danish (Denmark)',
  'de-DE': 'German (Germany)',
  'el-GR': 'Greek (Greece)',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  'en-GB': 'English (United Kingdom)',
  'en-GH': 'English (Ghana)',
  'en-HK': 'English (Hong Kong)',
  'en-IE': 'English (Ireland)',
  'en-IN': 'English (India)',
  'en-KE': 'English (Kenya)',
  'en-NG': 'English (Nigeria)',
  'en-NZ': 'English (New Zealand)',
  'en-PH': 'English (Philippines)',
  'en-PK': 'English (Pakistan)',
  'en-SG': 'English (Singapore)',
  'en-TZ': 'English (Tanzania)',
  'en-US': 'English (United States)',
  'en-ZA': 'English (South Africa)',
  'es-AR': 'Spanish (Argentina)',
  'es-BO': 'Spanish (Bolivia)',
  'es-CL': 'Spanish (Chile)',
  'es-CO': 'Spanish (Colombia)',
  'es-CR': 'Spanish (Costa Rica)',
  'es-DO': 'Spanish (Dominican Republic)',
  'es-EC': 'Spanish (Ecuador)',
  'es-ES': 'Spanish (Spain)',
  'es-GT': 'Spanish (Guatemala)',
  'es-HN': 'Spanish (Honduras)',
  'es-MX': 'Spanish (Mexico)',
  'es-NI': 'Spanish (Nicaragua)',
  'es-PA': 'Spanish (Panama)',
  'es-PE': 'Spanish (Peru)',
  'es-PR': 'Spanish (Puerto Rico)',
  'es-PY': 'Spanish (Paraguay)',
  'es-SV': 'Spanish (El Salvador)',
  'es-US': 'Spanish (United States)',
  'es-UY': 'Spanish (Uruguay)',
  'es-VE': 'Spanish (Venezuela)',
  'fa-IR': 'Persian (Iran)',
  'fi-FI': 'Finnish (Finland)',
  'fil-PH': 'Filipino (Philippines)',
  'fr-BE': 'French (Belgium)',
  'fr-CA': 'French (Canada)',
  'fr-FR': 'French (France)',
  'fr-CH': 'French (Switzerland)',
  'he-IL': 'Hebrew (Israel)',
  'hi-IN': 'Hindi (India)',
  'hu-HU': 'Hungarian (Hungary)',
  'id-ID': 'Indonesian (Indonesia)',
  'it-IT': 'Italian (Italy)',
  'ja-JP': 'Japanese (Japan)',
  'ko-KR': 'Korean (South Korea)',
  'ms-MY': 'Malay (Malaysia)',
  'nl-BE': 'Dutch (Belgium)',
  'nl-NL': 'Dutch (Netherlands)',
  'no-NO': 'Norwegian (Norway)',
  'pl-PL': 'Polish (Poland)',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'ro-RO': 'Romanian (Romania)',
  'ru-RU': 'Russian (Russia)',
  'sk-SK': 'Slovak (Slovakia)',
  'sv-SE': 'Swedish (Sweden)',
  'ta-IN': 'Tamil (India)',
  'ta-LK': 'Tamil (Sri Lanka)',
  'th-TH': 'Thai (Thailand)',
  'tr-TR': 'Turkish (Turkey)',
  'uk-UA': 'Ukrainian (Ukraine)',
  'ur-IN': 'Urdu (India)',
  'ur-PK': 'Urdu (Pakistan)',
  'vi-VN': 'Vietnamese (Vietnam)',
  'zh-CN': 'Chinese (Mainland China)',
  'zh-HK': 'Chinese (Hong Kong)',
  'zh-TW': 'Chinese (Taiwan)'
};

// Use port from environment (Render sets PORT) or fallback to 3001
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Create a basic HTTP server. This allows the service to respond to normal
// HTTP requests (so visiting the URL in a browser doesn't return "Upgrade Required")
// and also lets the reverse proxy (Render) perform TLS termination and upgrade
// the connection to WebSocket (wss).
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/status')) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('STT WebSocket server is running. Connect via WebSocket (wss://...).');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Attach WebSocket server to the HTTP server so upgrades are handled correctly
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', function upgrade(request, socket, head) {
  // You can inspect the request.url here and accept/reject based on path or auth
  wss.handleUpgrade(request, socket, head, function done(ws) {
    wss.emit('connection', ws, request);
  });
});

server.listen(PORT, () => {
  console.log('HTTP/WebSocket server listening on port', PORT);
});
console.log(`Supported languages: ${Object.keys(supportedLanguages).length} languages`);

// Create a Speech-to-Text client
const speechClient = new SpeechClient();

wss.on('connection', function connection(ws) {
  console.log('New client connected');
  
  let recognizeStream = null;

  ws.on('message', function incoming(message) {
    try {
      // Handle control messages (JSON)
      if (typeof message === 'string' || message instanceof Buffer && message[0] === '{'.charCodeAt(0)) {
        const messageData = JSON.parse(message.toString());
        
        if (messageData.type === 'start') {
          console.log('Starting new recognition stream');
          
          // Get language code from the message
          const languageCode = messageData.languageCode || 'en-US';
          console.log('Selected language:', languageCode);
          
          console.log('Starting recognition in language:', languageCode);

          // Configure recognition with proper language settings
          const speechConfig = {
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: 16000,
              languageCode: languageCode,
              enableAutomaticPunctuation: true,
              model: 'phone_call', // Changed to phone_call model which is better for continuous speech
              useEnhanced: true,
              enableWordTimeOffsets: false,
              enableWordConfidence: false,
              maxAlternatives: 1,
              profanityFilter: false,
              // Speech adaptation settings
              adaptation: {
                phraseSetReferences: [],
                customClasses: []
              },
              // Speech detection settings
              speechContexts: [{
                phrases: [],
              }],
              // Enhanced settings for better recognition
              metadata: {
                interactionType: 'PHONE_CALL', // Changed to PHONE_CALL for better continuous speech handling
                microphoneDistance: 'NEARFIELD',
                originalMediaType: 'AUDIO',
                recordingDeviceType: 'PC_MICROPHONE'
              }
            },
            singleUtterance: false,    // Set to false for continuous recognition
            interimResults: false      // Disable interim results completely
          };

          // Language-specific configurations
          switch(languageCode) {
            case 'hi-IN': // Hindi
              speechConfig.config.model = 'latest_long';
              break;
            case 'zh-CN': // Chinese
              speechConfig.config.model = 'latest_long';
              break;
            case 'ja-JP': // Japanese
              speechConfig.config.model = 'latest_long';
              break;
            case 'ko-KR': // Korean
              speechConfig.config.model = 'latest_long';
              break;
            case 'ar-SA': // Arabic
              speechConfig.config.model = 'latest_long';
              break;
            default:
              if (!languageCode.startsWith('en')) {
                speechConfig.config.model = 'latest_long';
              }
          }

          console.log('Speech config:', speechConfig);

          // Apply special configurations to speechConfig
          if (languageCode === 'hi-IN') {
            speechConfig.config.model = 'command_and_search'; // Better for Indic languages
            speechConfig.config.languageCode = 'hi-IN';
          } else if (languageCode.startsWith('zh')) {
            speechConfig.config.encoding = 'LINEAR16';
            speechConfig.config.model = 'command_and_search';
          } else if (languageCode.startsWith('ja')) {
            speechConfig.config.model = 'command_and_search';
          } else if (languageCode.startsWith('ar')) {
            speechConfig.config.model = 'command_and_search';
          }

          console.log('Recognition config:', speechConfig);

          // Variables for transcript management
          let lastTranscript = '';
          let transcriptBuffer = [];
          const BUFFER_TIMEOUT = 1000; // 1 second buffer timeout
          
          recognizeStream = speechClient
            .streamingRecognize(speechConfig)
            .on('error', (error) => {
              console.error('Recognition error:', error);
              ws.send(JSON.stringify({ type: 'error', error: error.message }));
            })
            .on('data', (data) => {
              if (data.results[0] && data.results[0].alternatives[0]) {
                const transcript = data.results[0].alternatives[0].transcript;
                
                // Only process final results
                if (data.results[0].isFinal && transcript.trim().length > 0) {
                  // Add to buffer if it's different from the last transcript
                  if (transcript !== lastTranscript) {
                    lastTranscript = transcript;
                    transcriptBuffer.push(transcript);
                    
                    // Process buffer after a short delay to combine closely related fragments
                    clearTimeout(this.bufferTimeout);
                    this.bufferTimeout = setTimeout(() => {
                      if (transcriptBuffer.length > 0) {
                        // Combine and clean up the buffered transcripts
                        const combinedTranscript = transcriptBuffer
                          .join(' ')
                          .replace(/\s+/g, ' ')
                          .trim();
                        
                        // Send the combined transcript
                        ws.send(JSON.stringify({
                          type: 'transcript',
                          transcript: combinedTranscript,
                          isFinal: true,
                          languageCode: speechConfig.config.languageCode
                        }));
                        
                        // Clear the buffer
                        transcriptBuffer = [];
                      }
                    }, BUFFER_TIMEOUT);
                  }
                }
              }
            });

        } else if (messageData.type === 'stop') {
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
