const needle = require("needle");

needle.defaults({
  "user-agent": "Dustbot/1.0"
});

const client = require("./client.js");

const replayTools = require("../replays/util.js");
const twitch = require("../twitch/observer.js");

const config = require(`${global.__root}/config.json`);

const { discord: { channels }, autoVerify } = config;

const uwu = (str) => {
  str = str.replace(/r|l/gi, (match) => {
    if (match === "r" || match === "l") {
      return "w";
    }
    if (match === "R" || match === "L") {
      return "W";
    }
  });
  if (Math.round(Math.random())) {
    str = str + " owo";
  }
  else {
    str = str + " uwu";
  }

  return str;
};

const toWeirdCase = (pattern, str) => {
  const length = pattern.length;
  return str.split("").map((v, i) => {
    const offset = 1;
    const character = pattern[(i % (length - offset)) + offset];
    if (character === character.toLowerCase()) {
      return v.toLowerCase();
    }
    return v.toUpperCase();
  }).join("");
};

const toStrimFormat = (message) => {
  return message.replace(/st(r|w)eam/i, "st$1im").replace(/st(r|w)iming/i, "st$1imming");
};

const streamCommandRegex = /^(\.|!)(st(r|w)(ea|i)ms)$/i;
const stweamCommandRegex = /^(\.|!)(stw(ea|i)ms)$/i;
const strimCommandRegex = /^(\.|!)(st(r|w)ims)$/i;
const streamNotCased = /^(\.|!)(st(r|w)(ea|i)ms)$/;
const noThumbnailRegex = /^(\.|!)(nt)$/i;
client.on("messageCreate", async (message) => {
  if ([channels["dustforce"], channels["races"], channels["tasforce"], channels["mapmaking"]].includes(message.channel.id)) {
    replayblock: if (message.content.indexOf("dustkid.com/replay/") !== -1 && !noThumbnailRegex.test(message.content.split(/ |\n/)[0])) {
      // when a Dustkid replay URL is present in the message, fetch replay
      // metadata and have Dustbot send a message with an embed

      const replayId = Number(message.content.split("dustkid.com/replay/")[1].split(/ |\n/)[0].replace(/[^0-9-]/g, ""));
      if (typeof replayId === "number" && !isNaN(replayId)) {
        message.channel.sendTyping();

        let replay;
        try {
          replay = await needle("get", `https://dustkid.com/replayviewer.php?replay_id=${replayId}&json=true&metaonly=true`, {
            parse: "json",
          });
          if (/^text\/html/.test(replay.headers["content-type"])) {
            throw new Error("Replay not found.");
          }
          replay = replay.body;
        }
        catch (error) {
          console.error(error);
          break replayblock;
        }

        if (!replay) {
          break replayblock;
        }

        let tags = "";
        if (!Array.isArray(replay.tag)) {
          // if (typeof replay.tag.version === "string") {
          //   tags = "\nDustmod version: " + replay.tag.version;
          // }

          if (typeof replay.tag.mode === "string" && replay.tag.mode !== "") {
            tags = "\nMode: " + replay.tag.mode;
          }
        }

        const usernameWrapper = `**[${replay.username}](https://dustkid.com/profile/${replay.user}/)**`;
        const camera = `[<:camera:401772771908255755>](https://dustkid.com/replay/${replay.replay_id})`;
        let ranks = "";
        let tas = "";
        if (replay.validated === -1 && replay.tag.mode === "dbg_0") {
          tags = "";
          tas = " - [TAS]";
          replay.tag.mode = "";
        }
        else if (replay.validated === -5) {
          tas = " - [TAS]";
        }
        else if (replay.rank_all_time !== false && replay.rank_all_score !== false) {
          let timeTies = "";
          let scoreTies = "";
          if (replay.rank_all_score_ties > 0) {
            scoreTies = ` (${(replay.rank_all_score_ties + 1)}-way tie)`;
          }

          if (replay.rank_all_time_ties > 0) {
            timeTies = ` (${(replay.rank_all_time_ties + 1)}-way tie)`;
          }

          ranks = `Score Rank: ${replayTools.rankToStr(replay.rank_all_score + 1)}${scoreTies}\n`
          + `Time Rank: ${replayTools.rankToStr(replay.rank_all_time + 1)}${timeTies}\n`;
        }

        if (replay.level === "unknown" && replay.levelname === "unknown" && replay.dustkid === 1 && replay.replay_id < 0 && replay.rank_all_time === false && replay.rank_all_time === false) {
          replay.level = "random";
          replay.levelname = "Dustkid Daily";
          try {
            const dailyStats = await needle("get", "https://dustkid.com/dailystats.php");
            const dailyId = Number(dailyStats.body.split("\n")[0].split(" ")[1]) + 2;
            replay.level = "random" + dailyId.toString();
          }
          catch (error) {
            console.error(error);
          }
        }

        const replayMessage = {
          "author": {
            "name": replay.levelname,
            "url": `https://dustkid.com/level/${encodeURIComponent(replay.level)}`,
            "icon_url": `https://cdn.discordapp.com/emojis/${replayTools.characterIcons(replay.character)}.png`,
          },
          "description": `${camera} ${usernameWrapper}${tas}\n`
            + `Score: ${replayTools.scoreToIcon(replay.score_completion)}${replayTools.scoreToIcon(replay.score_finesse)}\n`
            + `Time: ${replayTools.parseTime(replay.time)}\n`
            + `${ranks}<:apple:230164613424087041> ${replay.apples}${tags}`,
          "footer": {
            "text": "Date",
          },
          "timestamp": new Date(Number(replay.timestamp) * 1000),
        };

        message.channel.send({ "embeds": [replayMessage] }).catch(console.error);
      }
    }
  }

  if ([channels["dustforce"], channels["bot"], channels["bot-testing"]].indexOf(message.channel.id) > -1) {
    // respond to ".streams" messages, in various formats (e.g. ".strims",
    // ".stwims", etc.)

    if (streamCommandRegex.test(message.content)) {
      message.channel.sendTyping();

      const applyWeirdCase = !streamNotCased.test(message.content);
      const applyStrimFormat = strimCommandRegex.test(message.content);

      const streams = twitch.getStreams();

      let nobodyStreaming = "Nobody is streaming.";
      let unknownStreaming = "At least 1 person is streaming. I'll push notification(s) after I finish gathering data.";
      if (streams.length === 0) {
        if (stweamCommandRegex.test(message.content)) {
          nobodyStreaming = uwu(nobodyStreaming);
        }
        if (applyStrimFormat) {
          nobodyStreaming = toStrimFormat(nobodyStreaming);
        }
        if (applyWeirdCase) {
          nobodyStreaming = toWeirdCase(message.content, nobodyStreaming);
        }

        message.channel.send(nobodyStreaming);
      }
      else {
        let streamsString = "";
        for (const stream of streams) {
          let streamTitle = stream["title"];
          if (stweamCommandRegex.test(message.content)) {
            streamTitle = uwu(streamTitle);
          }
          if (applyStrimFormat) {
            streamTitle = toStrimFormat(streamTitle);
          }
          if (applyWeirdCase) {
            streamTitle = toWeirdCase(message.content, streamTitle);
          }
          streamTitle = streamTitle.replace(/\\(\*|@|<|>|:|_|`|~|\\)/g, "$1").replace(/(\*|@|<|>|:|_|`|~|\\)/g, "\\$1");
          streamsString += `<${stream["url"]}> - ${streamTitle}\n`;
        }

        if (streamsString === "") {
          if (stweamCommandRegex.test(message.content)) {
            unknownStreaming = uwu(unknownStreaming);
          }
          if (applyStrimFormat) {
            unknownStreaming = toStrimFormat(unknownStreaming);
          }
          if (applyWeirdCase) {
            unknownStreaming = toWeirdCase(message.content, unknownStreaming);
          }
          message.channel.send(unknownStreaming);
        }
        else {
          streamsString = streamsString.slice(0, -1);
          message.channel.send(streamsString);
        }
      }
    }
  }

  if (message.channel.id === channels["holding"]) {
    // have new users send a "!verify" message when they join the server
    const holdingRole = message.member.guild.roles.cache.find((role) => role.name === "holding");
    if (message.content.toLowerCase() === "!verify" && message.member.roles.cache.has(holdingRole.id)) {
      message.member.roles.remove(holdingRole);
      if (autoVerify.indexOf(message.member.id) === -1) {
        autoVerify.push(message.member.id);
      }
    }
  }
});
