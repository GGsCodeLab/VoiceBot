/* eslint-disable padded-blocks */
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const nameGenerator = require('../name_generator');
const config = require('../config');

let identity;

exports.tokenGenerator = function tokenGenerator() {
  identity = nameGenerator();

  const accessToken = new AccessToken(
      config.accountSid,
      config.apiKey,
      config.apiSecret
  );
  accessToken.identity = identity;
  const grant = new VoiceGrant({
    outgoingApplicationSid: config.twimlAppSid,
    incomingAllow: true,
  });
  accessToken.addGrant(grant);

  // Include identity and token in a JSON response
  return {
    identity: identity,
    token: accessToken.toJwt(),
  };
};

exports.voiceResponse = function voiceResponse(requestBody) {
  const toNumberOrClientName = requestBody.To;
  const callerId = config.callerId;
  const twiml = new VoiceResponse();

  // If the request to the /voice endpoint is TO your Twilio Number, 
  // then it is an incoming call towards your Twilio.Device.
  if (toNumberOrClientName == callerId) {
    const dial = twiml.dial();
    // This will connect the caller with your Twilio.Device/client 
    dial.client(identity);
  } else if (requestBody.To) {
    // This is an outgoing call
    // set the callerId
    const dial = twiml.dial({callerId});
    // Check if the 'To' parameter is a Phone Number or Client Name
    // in order to use the appropriate TwiML noun 
    const attr = isAValidPhoneNumber(toNumberOrClientName) ?
      'number' :
      'client';
    dial[attr]({}, toNumberOrClientName);
  } else {
    twiml.say('Thanks for calling!');
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <Response>
      <Start>
        <Stream url="wss://b6a7-36-255-87-5.ngrok-free.app" track="both_tracks"></Stream>
      </Start>
      <Dial>
          <Client>${identity}</Client>
      </Dial>
  </Response>`;
  return xml;
};

/**
 * Checks if the given value is valid as phone number
 * @param {Number|String} number
 * @return {Boolean}
 */
function isAValidPhoneNumber(number) {
  return /^[\d\+\-\(\) ]+$/.test(number);
}
