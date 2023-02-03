const EventEmitter = require("events");

const { ApiClient } = require("@twurple/api");
const { ClientCredentialsAuthProvider } = require("@twurple/auth");

const config = require("../../config.json");

const { twitch: { clientId, clientSecret, games } } = config;

const streamEmitter = new EventEmitter();
const streams = [];

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);

const apiClient = new ApiClient({ authProvider });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const reset = 3 * 60 * 1000;
const loopDelay = 45 * 1000;

const loop = async (firstCall = true) => {
  let results = null;
  try {
    const response = await apiClient.streams.getStreams({ "game": games });
    results = response.data;
  }
  catch (error) {
    if (error.code !== "ETIMEDOUT") {
      console.error(error);
    }
  }

  if (results !== null) {
    for (const stream of results) {
      const streamExists = streams.findIndex(streamCache => streamCache.userName === stream.userName);
      if (streamExists === -1) {
        stream.url = `https://www.twitch.tv/${stream.userName}`;
        stream.timer = reset;
        streams.push(stream);
        if (!firstCall) {
          streamEmitter.emit("stream", stream);
        }
      }
      else {
        streams[streamExists].timer = reset;
      }
    }

    for (const stream in streams) {
      if (Object.prototype.hasOwnProperty.call(streams, stream)) {
        streams[stream].timer = streams[stream].timer - loopDelay;
        if (streams[stream].timer < 1) {
          streams.splice(stream, 1);
        }
      }
    }
  }

  await sleep(loopDelay);
  loop(false);
};

setTimeout(loop, 10 * 1000);

module.exports = {
  "newStream": streamEmitter,
  "getStreams": () => {
    return streams;
  },
};
