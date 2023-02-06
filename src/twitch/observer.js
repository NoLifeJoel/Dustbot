const EventEmitter = require("events");

const { ApiClient } = require("@twurple/api");
const { ClientCredentialsAuthProvider } = require("@twurple/auth");

const client = require("../discord/client.js");

const config = require("../../config.json");

const { twitch: { clientId, clientSecret, games } } = config;

const streamEmitter = new EventEmitter();
const streams = [];

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);

const apiClient = new ApiClient({ authProvider });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const expire = 3 * 60 * 1000;
const loopDelay = 45 * 1000;

let mainChannel;
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
        stream.timer = expire;
        streams.push(stream);

        if (!firstCall) {
          streamEmitter.emit("stream", stream);
        }
      }
      else {
        streams[streamExists].timer = expire;
      }
    }

    for (const stream in streams) {
      if (Object.prototype.hasOwnProperty.call(streams, stream)) {
        // remove streams from the cache that have not been live in some time
        streams[stream].timer = streams[stream].timer - loopDelay;
        if (streams[stream].timer < 1) {
          streams.splice(stream, 1);
        }
      }
    }

    if (firstCall) {
      // in case Dustbot was reset, announce all streams that are currently
      // live, in case Dustbot failed to do so previously, when it was
      // presumably broken and needed to be reset in the first place
      let message = "Currently live:\n";
      const messages = [];
      for (const { title, url } of streams) {
        messages.push(`<${url}> ${title}`);
      }
      message += messages.join("\n");

      mainChannel.send(message).catch((error) => {
        console.error(error);
      });
    }
  }

  await sleep(loopDelay);
  loop(false);
};

client.once("ready", () => {
  mainChannel = client.channels.cache.get(config.discord.channels["dustforce"]);

  streamEmitter.on("stream", (stream) => {
    mainChannel.send(`<${stream.url}> just went live: ${stream.title}`).catch((error) => {
      console.error(error);
    });
  });
});

loop();

module.exports = {
  "newStream": streamEmitter,
  "getStreams": () => {
    return streams;
  },
};
