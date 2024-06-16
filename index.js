/* eslint-disable camelcase */
const http = require('http');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const router = require('./src/router');

// Create Express webapp
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(router);

// Create http server and run it
const server = http.createServer(app);
const port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Express server running on *:' + port);
});


const WebSocketServer = require('ws');
const {createClient, LiveTranscriptionEvents} = require('@deepgram/sdk');

const websocketServer = new WebSocketServer.Server({server});
const deepgramApiKey = '1c22528a731b8c64ae8d33ddc37047b12eeeaed7';

websocketServer.on('connection', (ws) => {
  console.log('new client connected');

  const deepgram = createClient(deepgramApiKey);
  const connection = deepgram.listen.live({
    model: 'nova-2',
    smart_format: true,
    encoding: 'mulaw',
    sample_rate: 8000,
    channels: 2,
    multichannel: true,
  });

  let inboundSamples = [];
  let outboundSamples = [];

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.log('DEEPGRAM ERROR');
    console.error(error);
  });
  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('DEEPGRAM OPEN');
    connection.on(LiveTranscriptionEvents.Close, () => {
      console.log('Connection closed.');
    });

    connection.on(LiveTranscriptionEvents.Transcript, (transcription) => {
      // console.dir(transcription, {depth: null});
      console.log((transcription.channel_index[0] == 0 ?
      'Prospect:' : 'Agent:'),
      transcription.channel.alternatives[0].transcript);
    });

    ws.on('message', (data) => {
      const twilioMessage = JSON.parse(data);
      // console.log('MESSAGE', twilioMessage['event'], twilioMessage);
      if (
        twilioMessage['event'] === 'connected' ||
        twilioMessage['event'] === 'start'
      ) {
        console.log('received a twilio connected or start event');
      }
      if (twilioMessage['event'] === 'media') {
        const media = twilioMessage['media'];
        const audio = Buffer.from(media['payload'], 'base64');
        // console.log('Converted audio to binary', media['track']);
        if (media['track'] === 'inbound') {
          for (let i = 0; i < audio.length; i++) {
            inboundSamples.push(audio[i]);
          }
        }
        if (media['track'] === 'outbound') {
          for (let i = 0; i < audio.length; i++) {
            outboundSamples.push(audio[i]);
          }
        }
        const mixable_length = Math.min(
            inboundSamples.length,
            outboundSamples.length
        );
        if (mixable_length > 0) {
          const mixedSamples = Buffer.alloc(mixable_length * 2);
          for (let i = 0; i < mixable_length; i++) {
            mixedSamples[2 * i] = inboundSamples[i];
            mixedSamples[2 * i + 1] = outboundSamples[i];
          }

          inboundSamples = inboundSamples.slice(mixable_length);
          outboundSamples = outboundSamples.slice(mixable_length);

          if (connection) {
            // console.log('SAMPLE SEND');
            connection.send(Buffer.from(mixedSamples));
          }
        }
      }
    });

    ws.on('close', () => {
      console.log('client has disconnected');
      connection.finish();
    });

    ws.onerror = function() {
      console.log('some error occurred');
      connection.finish();
    };
  });
});

// console.log('the websocket server is running on port 5000');
