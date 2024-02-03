const EventEmitter = require("events");

const { ApiClient } = require("@twurple/api");
const { ClientCredentialsAuthProvider } = require("@twurple/auth");

const client = require("../discord/client.js");

const { SelfAdjustingInterval } = require("../util/interval.js");

const config = require(`${global.__root}/config.json`);
const { twitch: { clientId, clientSecret, games } } = config;

const streamEmitter = new EventEmitter();

const streamsByUserId = new Map();

const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);

const apiClient = new ApiClient({ authProvider });

const expire = 3 * 60 * 1000;
const interval = 30 * 1000;

let _initialCall = true;

let mainChannel;
client.once("ready", () => {
  mainChannel = client.channels.cache.get(config.discord.channels["dustforce"]);
});

const sendWentLiveMessage = (stream, channel) => {
  channel.send(`<${stream.url}> just went live: ${stream.title}`).catch((error) => {
    console.error(error);
  });
};

const fetchStreams = async () => {
  // remove expired streams from the cache
  for (const stream of streamsByUserId.values()) {
    stream.timer -= interval;
    if (stream.timer <= 0) {
      streamsByUserId.delete(stream.userId);
    }
  }

  const { data = [] } = await apiClient.streams.getStreams({ "game": games }) || {};
  if (data?.length) {
    for (const helixStream of data) {
      const { userId, userName, title } = helixStream;

      if (streamsByUserId.has(userId)) {
        const cachedStream = streamsByUserId.get(userId);
        if (cachedStream.title !== title) {
          // replace with the new title
          cachedStream.title = title;
        }

        // reset the expiration timer
        cachedStream.timer = expire;
        continue;
      }

      const stream = {
        helixStream,
        userId,
        userName,
        title,
        url: `https://www.twitch.tv/${userName}`,
        timer: expire,
      };
      streamsByUserId.set(userId, stream);

      if (_initialCall) {
        // only aggregate the streams on start-up, to prevent sending
        // redundant duplicate messages on restart (with the assumption the
        // bot sent "went-live" messages last it was online)
        continue;
      }

      streamEmitter.emit("newStream", stream);
      sendWentLiveMessage(stream, mainChannel);
    }
  }

  /*
  Uncomment to send a message on start-up with all live streams at the current
  moment
  */
  // if (streamsByUserId.size && _initialCall) {
  //   // in case Dustbot was just started up, announce all streams that are
  //   // currently live, in case Dustbot failed to do so previously, when it was
  //   // presumably broken and needed to be restarted
  //   let message = "Currently live:\n";
  //   const messages = [];
  //   for (const { title, url } of streamsByUserId.values()) {
  //     messages.push(`<${url}> ${title}`);
  //   }
  //   message += messages.join("\n");

  //   mainChannel.send(message).catch((error) => {
  //     console.error(error);
  //   });
  // }

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
    return Array.from(streamsByUserId.values());
  },
};
