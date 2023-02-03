import EventEmitter from 'events';

import { ApiClient } from '@twurple/api';
import { ClientCredentialsAuthProvider } from '@twurple/auth';

import config from '../../config.json';

const { twitch: { clientId, clientSecret, games } } = config;

const streamEmitter = new EventEmitter();
const streams = [];

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);

const apiClient = new ApiClient({ authProvider });

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loop (firstCall=true) {
  let results = null;
  let reset = 3 * 60000; // 3 minutes
  let loopDelay = 45 * 1000; // 45 seconds
  try {
    let response = await apiClient.streams.getStreams({ "game": games });
    results = response.data;
  } catch (e) {
    if (e.code !== "ETIMEDOUT") console.error(e); // Twitch API is slow sometimes.
  }
  if (results !== null) {
    for (let stream of results) {
      const streamExists = streams.findIndex(streamCache => streamCache.userName === stream.userName);
      if (streamExists === -1) {
        stream.url = "https://www.twitch.tv/" + stream.userName;
        stream.timer = reset;
        streams.push(stream);
        if (!firstCall) streamEmitter.emit('stream', stream);
      } else {
        streams[streamExists].timer = reset;
      }
    }
    for (let stream in streams) {
      streams[stream].timer = streams[stream].timer - loopDelay;
      if (streams[stream].timer < 1) {
        streams.splice(stream, 1);
      }
    }
  }
  await sleep(loopDelay);
  loop(false);
} setTimeout(loop, 10 * 1000); // 10 seconds.

export default {
  "newStream": streamEmitter,
  "getStreams": () => {
    return streams;
  }
};
