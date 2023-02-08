const EventEmitter = require("events");

const { ApiClient } = require("@twurple/api");
const { ClientCredentialsAuthProvider } = require("@twurple/auth");

const client = require("../discord/client.js");

const { SelfAdjustingInterval } = require("../util/interval.js");

const config = require("../../config.json");
const { twitch: { clientId, clientSecret, games } } = config;

const streamEmitter = new EventEmitter();
const streams = [];

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);

const apiClient = new ApiClient({ authProvider });

const expire = 3 * 60 * 1000;
const interval = 30 * 1000;

let _initialCall = true;

const sendWentLiveMessage = (stream, channel) => {
  channel.send(`<${stream.url}> just went live: ${stream.title}`).catch((error) => {
    console.error(error);
  });
};

let mainChannel;
client.once("ready", () => {
  mainChannel = client.channels.cache.get(config.discord.channels["dustforce"]);
});

const fetchStreams = async () => {
  let data = null;
  try {
    ({ data = [] } = await apiClient.streams.getStreams({ "game": games }) || {});
  }
  catch (error) {
    if (error.code !== "ETIMEDOUT") {
      console.error(error);
    }
  }

  if (data !== null) {
    for (const stream of data) {
      const streamExists = streams.findIndex(streamCache => streamCache.userName === stream.userName);
      if (streamExists === -1) {
        stream.url = `https://www.twitch.tv/${stream.userName}`;
        stream.timer = expire;
        streams.push(stream);

        if (!_initialCall) {
          streamEmitter.emit("stream", stream);
          sendWentLiveMessage(stream, mainChannel);
        }
      }
      else {
        streams[streamExists].timer = expire;
      }
    }

    for (const stream in streams) {
      if (Object.prototype.hasOwnProperty.call(streams, stream)) {
        // adjust the expiration timer
        streams[stream].timer -= interval;
        if (streams[stream].timer < 1) {
          // remove streams from the cache that have not been live in some time
          streams.splice(stream, 1);
        }
      }
    }

    // if (streams.length && _initialCall) {
    //   // in case Dustbot was just started up, announce all streams that are
    //   // currently live, in case Dustbot failed to do so previously, when it was
    //   // presumably broken and needed to be restarted
    //   let message = "Currently live:\n";
    //   const messages = [];
    //   for (const { title, url } of streams) {
    //     messages.push(`<${url}> ${title}`);
    //   }
    //   message += messages.join("\n");

    //   mainChannel.send(message).catch((error) => {
    //     console.error(error);
    //   });
    // }
  }

  if (_initialCall) {
    _initialCall = false;
  }
};

new SelfAdjustingInterval(fetchStreams, interval, (error) => {
  console.error({ error }, "failed to fetch streams");
}).start();

module.exports = {
  "newStream": streamEmitter,
  "getStreams": () => {
    return streams;
  },
};
