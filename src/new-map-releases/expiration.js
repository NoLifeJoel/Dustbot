const fs = require("fs");

const dataPath = `${__dirname}/data.json`;

const deletableMessageIds = [];

const limit = 100;
// fetching of messages is limited to 100 per call by the API, so we'll need
// to use pagination to get all of them; fetched messages are sorted from
// newest to oldest
let lastMessageId;
let cache;
const bulkDeleteMessages = async (data, channel, expiration = 0, beforeId = null) => {
  console.log( "--- BULK DELETE MESSAGES ---" );
  if (!data) {
    data = JSON.parse(fs.readFileSync(dataPath));
    ({ cache } = data);
  }

  const now = Date.now();
  const messagePage = await channel.messages.fetch({ limit, before: beforeId });
  messagePage.forEach(async (message) => {
    lastMessageId = message.id;

    if (!message.author.bot) {
      return;
    }

    const { createdTimestamp } = message;
    if (createdTimestamp < (now - expiration)) {
      // message has expired, store it for bulk deletion
      deletableMessageIds.push(message.id);
    }
  });

  if (deletableMessageIds.length) {
    await channel.bulkDelete(deletableMessageIds);
    for (const id of deletableMessageIds) {
      for (const [atlasId, { messageId }] of Object.entries(cache)) {
        // remove the deleted messages from our cache too
        if (messageId === id) {
          delete cache[atlasId];
        }
      }
    }

    fs.writeFileSync(dataPath, JSON.stringify({
      ...data,
      cache: { ...cache },
    }, null, 2));
  }

  if (messagePage.size >= limit) {
    await bulkDeleteMessages(data, channel, expiration, lastMessageId);
  }
};

const cleanCache = async (expiration) => {
  console.log("--- CLEAN CACHE ---");
  return new Promise(resolve => {
    const now = Date.now();

    const data = JSON.parse(fs.readFileSync(dataPath));
    const { cache: _cache } = data;
    for (const [atlasId, { _createdAt }] of Object.entries(_cache)) {
      if (_createdAt < (now - expiration)) {
        delete _cache[atlasId];
      }
    }

    fs.writeFileSync(dataPath, JSON.stringify({
      ...data,
      cache: { ..._cache },
    }, null, 2));

    resolve();
  });
};

module.exports = {
  bulkDeleteMessages,
  cleanCache,
};
