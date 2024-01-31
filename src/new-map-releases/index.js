const fs = require("fs");

const needle = require("needle");
const cheerio = require("cheerio");

const { EmbedBuilder } = require("discord.js");

const client = require("../discord/client.js");

const { SelfAdjustingInterval } = require("../util/interval.js");

const { cleanCache } = require("./expiration.js");

const baseUrl = "http://atlas.dustforce.com/";
const atlasDownloadUrl = "http://atlas.dustforce.com/gi/downloader.php?id=";

const config = require(`${global.__root}/config.json`);

const dataPath = `${__dirname}/data.json`;
let data = {};
let { currentAtlasId, cache, queue } = data;

const filenameRegex = /filename="(.+)"/;

const writeData = (fields) => {
  return new Promise(resolve => {
    // ensure all deconstructed modified variables are always written
    fs.writeFileSync(dataPath, JSON.stringify({
      ...data,
      currentAtlasId,
      cache: { ...cache },
      queue: [...queue],

      ...fields,
    }, null, 2));

    resolve();
  });
};

const workInterval = 1000 * 30;
const processQueueInterval = 1000 * 60 * 1;
// when maps are fetched, we first put them in a queue; this variable determines
// how old maps need to be in the queue before we actually fetch the atlas data
// and post a message for them; this is to give users time to hide their map if
// need be (either because they made a mistake, or for an event like Custom Map
// Race or DLC where maps get hidden immediately, and unhidden at a later date)
const minimumAge = 1000 * 60 * 5;

const cleanExpiredDataInterval = 1000 * 60 * 60;
// determine when maps expire, and should no longer be visible in the channel;
// older messages will also get retroactively deleted if they've expired
const expiration = 1000 * 60 * 60 * 24 * 7 * 2;

const unhideInterval = 1000 * 60 * 10;
// check unpublished maps at a more rapid interval than hidden ones, as it is
// possible we just caught someone in the process of publishing one, and don't
// want to wait a while sending the message once they're finished doing so
const unhideUnpublishedInterval = 1000 * 60 * 5;

// some maps that are visible get hidden afterwards by their author; if we see
// this, delete the posted message for that map retroactively
const retroactivelyHideInterval = 1000 * 60 * 5;

// keep track of timers (at 1fps), so we can execute all functions that write to
// the JSON data file in sequence, to avoid potential issues with race
// conditions
let queueTimer = 0;
let cleanUpTimer = 0;
let unhideTimer = 0;
let unhideUnpublishedTimer = 0;
let retroactivelyHideTimer = 0;

setInterval(() => {
  queueTimer += 1000;
  cleanUpTimer += 1000;
  unhideTimer += 1000;
  unhideUnpublishedTimer += 1000;
  retroactivelyHideTimer += 1000;

  if (queueTimer >= (24 * 60 * 60 * 1000)) {
    queueTimer = 0;
  }
  if (cleanUpTimer >= (24 * 60 * 60 * 1000)) {
    cleanUpTimer = 0;
  }
  if (unhideTimer >= (24 * 60 * 60 * 1000)) {
    unhideTimer = 0;
  }
  if (unhideTimer >= (24 * 60 * 60 * 1000)) {
    unhideUnpublishedTimer = 0;
  }
  if (unhideTimer >= (24 * 60 * 60 * 1000)) {
    retroactivelyHideTimer = 0;
  }
}, 1000);

// keep a list of tags that will make Dustbot ignore the map entirely
const ignoreTags = [
  "ignore",
  "db-ignore",
  "dustbot-ignore",
];

const embedSideColors = [
  "404556",
  "60515c",
  "777076",
  "597d7c",
  "386775",
  "20504e",
  "343F4C",
  "3B3A55",
  "453B55",
  "524157",
];
let colourIndex = 0;
let _decreaseColourIndex = false;

let mapReleasesChannel;
// let roleId;

const escapeMarkdown = function(text) {
  return text.replace(/(_|\*|~|`|\|)/g, "\\$1");
};

const sendMessages = async (maps) => {
  if (!maps.length) {
    return;
  }

  if (!mapReleasesChannel) {
    mapReleasesChannel = client.channels.cache.get(config.discord.channels["new-map-releases"]);

    if (!mapReleasesChannel) {
      throw new Error("Cannot find Map Updates Channel.");
    }
  }

  const messages = [];

  const descriptionLengthMax = 150;
  for (let { atlasId, filename, authorName, authorAvatar, description, tags } of maps) {
    // split the filename by hyphens, and remove the last element which
    // corresponds to the map ID, as the filename has a format such as:
    // "cool-ramen-10490"; note that if the map name has hyphens in it that
    // don't act as empty space separators, e.g. "wolf-chase--updated-3207",
    // these will end up as empty strings in the `split()` result, and we'll
    // simply filter these out
    const split = filename.split("-");
    split.pop();
    let mapName = split.filter(Boolean).join(" ");
    if (!mapName) {
      // though unlikely, it seems this map is simply a hyphen, or a collection
      // of them; get the length of them and return half minus one (which
      // exempts the separator between the map name and ID in the original
      // filename)
      const hyphenCount = (filename.match(/-/g) || []).length;
      for (let i = 0; i < hyphenCount; i++) {
        mapName += "-";
      }

      if (!mapName) {
        // seemingly this map does not have a name, though we never expect this
        // to happen
        mapName = "???";
      }
    }

    if (description) {
      // escape markdown characters, so that e.g. an asterisk would not cause
      // the entire description in the message to be displayed in italics
      description = escapeMarkdown(description);

      if (description.length > descriptionLengthMax) {
        description = `${description.substring(0, descriptionLengthMax)}...`;
      }

      // split by newline, and filter out multiple newlines in a row (as these
      // will show up as empty strings in the resulting array)
      let descriptionByNewline = description.split("\n");
      if (descriptionByNewline.length > 3) {
        // if a description has more than 3 lines, only use the first 3, and add
        // a new line with "(...)" to indicate a part of the description was cut
        // off
        descriptionByNewline = descriptionByNewline.slice(0, 3);
        descriptionByNewline.push("(...)");
        description = descriptionByNewline.join("\n");
      }

      // // add a link to the map's Dustkid leaderboards
      // description += `\n\n[Leaderboards](https://dustkid.com/level/${filename})`;
    }
    else {
      // // add a link to the map's Dustkid leaderboards
      // description = `\n[Leaderboards](https://dustkid.com/level/${filename})`;
    }

    // possibly display existing tags, limiting the overall displayed length
    // (which means we only look at `tag.name.length` not `tag.href.length` too,
    // as the tags will be transformed into hyperlinks)
    const maxLength = 75;
    let _reachedMax = false;
    let currentString = "";
    const displayedTags = [];
    for (const tag of tags) {
      if (tag.name.length > maxLength) {
        _reachedMax = true;
        continue;
      }

      currentString += ` ${tag.name}`;
      if (currentString.length >= maxLength) {
        _reachedMax = true;
        break;
      }

      tag.name = escapeMarkdown(tag.name);
      displayedTags.push(tag);
    }

    if (displayedTags.length) {
      description += "\n\nTags:";
      for (const tag of displayedTags) {
        description += ` [${tag.name}](${tag.href})`;
      }

      if (_reachedMax) {
        description += " etc.";
      }
    }

    const colour = "#" + embedSideColors[colourIndex];
    // cycle through the colours start to end, then end to start, and repeat
    if (!_decreaseColourIndex) {
      colourIndex++;
      if (colourIndex >= embedSideColors.length) {
        colourIndex = embedSideColors.length - 2;
        _decreaseColourIndex = true;
      }
    }
    else {
      colourIndex--;
      if (colourIndex < 0) {
        _decreaseColourIndex = false;
        colourIndex = 1;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(colour)
      .setTitle(`${mapName}`)
      .setAuthor({ name: authorName, url: `https://atlas.dustforce.com/user/${encodeURI(authorName)}`, iconURL: authorAvatar })
      .setURL(`https://atlas.dustforce.com/${atlasId}`)
      .setThumbnail(`https://atlas.dustforce.com/gi/maps/${filename}.png`)
      // .setImage(`https://atlas.dustforce.com/gi/maps/${filename}.png`)
      .setFooter({ text: "Date" })
      .setTimestamp();

    if (description) {
      embed.setDescription(description);
    }

    messages.push({
      embed,
      atlasId,
      filename,
      url: `https://atlas.dustforce.com/${atlasId}`,
    });
  }

  // sort the maps from oldest to newest, so messages are sent in that order too
  messages.sort((a, b) => a.atlasId - b.atlasId);

  // uncomment to enable an initial @<role> message
  // if (roleId) {
  //   // first announce new maps being released; we want to keep messages
  //   // separate for the future as we may want to delete them retroactively,
  //   // and additionally, putting a tag with an embed would highlight the
  //   // entire message, which looks ugly, and is strange if multiple embeds are
  //   // sent at once and only the first is highlighted
  //   let content = `<@&${roleId}>`;
  //   if (messages.length === 1) {
  //     content += " A new map has been released!";
  //   }
  //   else {
  //     content += ` ${messages.length} new maps have been released!`;
  //   }

  //   mapReleasesChannel.send({
  //     content,
  //   });
  // }

  const messageIdByAtlasIds = {};
  for (const { atlasId, embed, filename, url } of messages) {
    const message = await mapReleasesChannel.send({
      components: [
        {
          type: 1,
          components: [
            {
              style: 5,
              label: "Atlas",
              url,
              disabled: false,
              type: 2,
            },
            {
              style: 5,
              label: "Leaderboards",
              url: `https://dustkid.com/level/${filename}`,
              disabled: false,
              type: 2,
            },
          ],
        },
      ],
      embeds: [embed],
    });

    messageIdByAtlasIds[atlasId] = message.id;
  }

  return messageIdByAtlasIds;
};

const checkAtlasStatus = async () => {
  // do a simple head request to the main page to check if Atlas is up
  const response = await needle("head", baseUrl, {
    timeout: 5000,
  });

  if (response.statusCode !== 200) {
    return false;
  }

  return true;
};

const fetchAtlasData = async (atlasId) => {
  const response = await needle("get", `${baseUrl}${atlasId}`, {
    timeout: 5000,
    headers: {
      "Content-Type": "text/html",
    },
  });

  response.setEncoding("utf8");
  if (response.statusCode === 200) {
    const $ = cheerio.load(response.body);

    let description = "";
    let authorName = "???";
    let authorAvatar = "";

    const authorData = $(".qa-avatar-link");
    if (!authorData.html()) {
      // this page does not have any author data, and therefore must be a hidden
      // map
      return {
        _hidden: true,
      };
    }

    const authorLink = authorData.attr("href");
    if (authorLink) {
      authorName = authorLink.split("/").pop();
      authorName = decodeURI(authorName);
    }
    const authorAvatarImageSrc = authorData.children(".qa-avatar-image").attr("src");
    if (authorAvatarImageSrc) {
      authorAvatar = `${baseUrl}${authorAvatarImageSrc.split("/").pop()}.png`;
    }

    const descriptionSpan = $(".map-description-contents").children(".entry-content");
    if (descriptionSpan) {
      description = descriptionSpan.text();
    }

    let _ignore = false;
    const tags = [];
    const _tags = $(".tag-area a");
    for (const tag of _tags) {
      const text = $(tag).text().replace(/\s/g, "-");

      if (ignoreTags.includes(text.toLowerCase())) {
        _ignore = true;
        break;
      }

      tags.push({
        name: text,
        href: `https://atlas.dustforce.com/tag/${encodeURI(text)}`,
      });
    }

    if (_ignore) {
      // have Dustbot ignore this map; cache it as hidden for now, in case
      // someone removes the tag later, so Dustbot will pick it up again,
      // assuming it hasn't expired by that point; this is mostly for events
      return {
        _hidden: true,
      };
    }

    return {
      _hidden: false,
      description,
      authorName,
      authorAvatar,
      tags,
    };
  }

  // consume response data to free up memory
  response.resume();

  if (response.statusCode === 404) {
    // this map is unpublished (meaning someone clicked "publish" in-game, but
    // never posted the map in their browser); mark it as such and treat it as
    // hidden, as there is a chance that someone is currently in the process of
    // publishing the map, and we just encountered it in the period where
    // they're still filling in information and then actually saving the map
    return {
      _hidden: true,
      _unpublished: true,
    };
  }

  const error = new Error();
  error.message = `Request failed with status code: ${response.statusCode}`;
  error.statusCode = response.statusCode;
  throw error;
};

const retroactivelyHideMaps = async () => {
  let _wroteData = false;
  for (const [atlasId, { messageId }] of Object.entries(cache)) {
    if (!messageId) {
      // no message was posted for this map, as far as the cache is concerned
      continue;
    }

    const { _hidden, _unpublished } = await fetchAtlasData(atlasId);
    if (_hidden || _unpublished) {
      // this map was hidden (or somehow unpublished, perhaps deleted by admins)
      // in the meantime, so delete the message
      try {
        await mapReleasesChannel.messages.delete(messageId);
      }
      catch (error) {
        if (error.code === 10008) {
          // "Message Unknown"; remove from the cache anyway since it apparently
          // should not be there
        }
        else {
          console.error(error);
          continue;
        }
      }

      cache[atlasId]._hidden = _hidden;
      cache[atlasId]._unpublished = _unpublished;
      delete cache[atlasId].messageId;
      _wroteData = true;
    }
  }

  if (_wroteData) {
    await writeData({
      cache: { ...cache },
    });
  }
};

const maybeUnhideCachedMaps = async (_onlyUnpublished = false) => {
  let _wroteData = false;
  const _messages = [];
  for (const [atlasId, { _hidden, _unpublished, filename, _createdAt }] of Object.entries(cache)) {
    if (!_hidden && !_unpublished) {
      continue;
    }

    if (_onlyUnpublished && !_unpublished) {
      // only check unpublished maps
      continue;
    }

    let atlasData;
    try {
      atlasData = await fetchAtlasData(atlasId);
      if (atlasData._hidden) {
        if (_unpublished && !atlasData._unpublished) {
          // the map is still hidden, but no longer unpublished, so unmark it in
          // the cache
          delete cache[atlasId]._unpublished;
          _wroteData = true;
        }

        // the map is still hidden, continue
        continue;
      }
    }
    catch (error) {
      console.error(error);
      continue;
    }

    cache[atlasId] = {
      _createdAt,
      filename,
      _hidden: false,
    };
    _wroteData = true;

    _messages.push({
      ...atlasData,
      atlasId,
      filename,
    });
  }

  if (_messages.length) {
    // have the client send messages to the appropriate channel(s)
    const messagesByAtlasId = await sendMessages(_messages);
    if (messagesByAtlasId && Object.keys(messagesByAtlasId).length) {
      for (const [key, messageId] of Object.entries(messagesByAtlasId)) {
        cache[key].messageId = messageId;
      }
    }
  }

  if (_wroteData) {
    await writeData({
      cache: { ...cache },
    });
  }
};

const fetchNewMap = async (atlasId) => {
  let filename;
  try {
    const response = await needle("head", `${atlasDownloadUrl}${atlasId}`, {
      timeout: 5000,
    });

    if (response.statusCode !== 200) {
      console.error(`Bad response: ${response.statusCode}`);
      return;
    }

    if (!response.headers["content-length"]) {
      // no map with this ID exists yet
      return;
    }

    const header = response.headers["content-disposition"];
    if (!header) {
      console.error(`No headers found for map ID: "${atlasId}"`);
      return;
    }

    const match = header.match(filenameRegex);
    if (!match.length) {
      console.error(`No filename found for map ID: "${atlasId}", with headers: `, response.headers["content-disposition"]);
      return;
    }

    filename = match[1];
    return filename;
  }
  catch (error) {
    console.error(error);
    return;
  }
};

const processQueue = async () => {
  if (!queue.length) {
    return;
  }

  // fetch atlas data for each of the maps that are queued up given that they
  // are X seconds old

  const now = Date.now();
  const _queue = [];
  const _messages = [];
  for (const element of queue) {
    const { atlasId, date, filename } = element;
    if ((date + minimumAge) >= now) {
      // the map was fetched too recently, so hold off on gathering data and
      // posting a message for it; see `minimumAge` definition
      _queue.push(element);
      continue;
    }

    let atlasData;
    try {
      atlasData = await fetchAtlasData(atlasId);
    }
    catch (error) {
      console.error(error);
      continue;
    }

    const { _hidden, _unpublished } = atlasData;
    const doc = {
      _createdAt: Date.now(),
      filename,
      _hidden,
    };

    if (_unpublished) {
      doc._unpublished = true;
    }
    cache[atlasId] = doc;

    if (!_hidden && !_unpublished) {
      _messages.push({
        ...atlasData,
        atlasId,
        filename,
      });
    }
  }

  if (_messages.length) {
    // have the client send messages to the appropriate channel(s)
    const messagesByAtlasId = await sendMessages(_messages);
    if (messagesByAtlasId && Object.keys(messagesByAtlasId).length) {
      for (const [key, messageId] of Object.entries(messagesByAtlasId)) {
        cache[key].messageId = messageId;
      }
    }
  }

  await writeData({
    cache: { ...cache },
    queue: [..._queue],
  });

  queue = [..._queue];
};

const work = async () => {
  if (cleanUpTimer >= cleanExpiredDataInterval) {
    cleanUpTimer = 0;

    // clean the cache, which may have data that was never posted as a message;
    // this is not expected, it's a precaution
    await cleanCache(expiration);
  }

  try {
    // check the status of Atlas up front
    const ok = await checkAtlasStatus();
    if (!ok) {
      return;
    }
  }
  catch (error) {
    console.error(error);
    return;
  }

  if (unhideTimer >= unhideInterval) {
    unhideTimer = 0;
    unhideUnpublishedTimer = 0;

    // possible unhide maps that have been cached as hidden (and/or
    // unpublished), and in the meantime been reshown by the map author on Atlas
    await maybeUnhideCachedMaps();
  }
  else if (unhideUnpublishedTimer >= unhideUnpublishedInterval) {
    unhideUnpublishedTimer = 0;

    // possible unhide maps that have been cached as unpublished, and in the
    // meantime been reshown by the map author on Atlas
    await maybeUnhideCachedMaps(true);
  }

  if (retroactivelyHideTimer >= retroactivelyHideInterval) {
    retroactivelyHideTimer = 0;

    // possible unhide maps that have been cached as unpublished, and in the
    // meantime been reshown by the map author on Atlas
    await retroactivelyHideMaps();
  }

  if (queueTimer >= processQueueInterval) {
    queueTimer = 0;

    // process maps that are waiting in the queue
    await processQueue();
  }

  // fetch maps in batches - arbitarily chosen - as not to fetch too much from
  // Atlas in one go, and later inherently spread out when messages are sent
  // from the queue
  const maxIterations = 100;
  let lastCheckedAtlasId = currentAtlasId;
  const now = Date.now();
  for (let i = 0; i < maxIterations; i++) {
    let atlasId = currentAtlasId + i;

    if (cache[atlasId] || (queue.findIndex(element => element.atlasId === (atlasId)) >= 0)) {
      // a message was already sent for this map, or it was cached while hidden
      atlasId++;
      lastCheckedAtlasId = atlasId;
      continue;
    }

    try {
      const filename = await fetchNewMap(atlasId);

      if (!filename) {
        // we've reached the most recent map on Atlas, so stop fetching
        lastCheckedAtlasId = atlasId;
        break;
      }

      // add the map to the queue
      queue.push({
        atlasId,
        date: now,
        filename,
      });
    }
    catch (error) {
      console.error(error);
    }

    lastCheckedAtlasId = atlasId;
  }

  if (lastCheckedAtlasId !== currentAtlasId) {
    currentAtlasId = lastCheckedAtlasId;
    await writeData({
      queue: [...queue],
      currentAtlasId,
    });
  }
};

client.once("ready", async (_client) => {
  mapReleasesChannel = _client.channels.cache.get(config.discord.channels["new-map-releases"]);
  // roleId = mapReleasesChannel.guild.roles.cache.find(role => role.name === "map-releases")?.id;

  if (!mapReleasesChannel) {
    console.error("Could not find map updates channel");
    return;
  }

  await cleanCache(expiration);

  data = JSON.parse(fs.readFileSync(dataPath));
  ({ currentAtlasId, cache, queue } = data);

  await maybeUnhideCachedMaps();

  await retroactivelyHideMaps();

  if (queue.length) {
    // process the existing queue on startup
    await processQueue();
  }

  // start an interval that, unlike `setInterval()`, runs its calls
  // sequentially, and never concurrently
  new SelfAdjustingInterval(work, workInterval, (error) => {
    console.error(error, "failed to fetch map.");
  }).start();
});
