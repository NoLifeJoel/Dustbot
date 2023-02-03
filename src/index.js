import discord from "./discord.js";

import { newReplay } from "./replays/index.js";
import replayTools from "./replays/util.js";

import { newStream } from "./twitch/index.js";

import { createTwitterMessage } from "./twitter/index.js";

import config from "../config.json";

let mainChannel;
let leaderboardUpdatesChannel;

const createDiscordMessage = (replay, type, firstSS, char) => {
  const lowercaseType = type.toLowerCase();
  const colors = [8493779, 12147535, 11829461, 9874791];
  const camera = "[<:camera:401772771908255755>](https://dustkid.com/replay/" + replay.replay_id + ")";
  const characterIcons = ["401402235004911616", "401402216272887808", "401402223357329418", "401402248040546315"];
  const usernameWrapper = "**[" + replay.username + "](https://dustkid.com/profile/" + replay.user + "/)**";
  const spacing = "\n       ";
  let xWayTie = "";
  let previousTime = "";
  let previousRank = "";
  if (typeof replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType] === "object" && typeof replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType].previous_rank === "number") {
    previousRank = " _" + replayTools.rankToStr(replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType].previous_rank - 1) + "_  ->";
    previousTime = " _" + replayTools.parseTime(replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType].previous_time) + "_  ->";
  }

  if (replay["rank_" + char + "_" + lowercaseType + "_ties"] !== 0) {
    xWayTie = " (" + (replay["rank_" + char + "_" + lowercaseType + "_ties"] + 1).toString() + "-way tie)";
  }

  if (firstSS) {
    type = "First SS";
  }

  const replayMessage = {
    "color": colors[replay.character], // The color of the left of the embed.
    "author": {
      "name": replay.levelname + " - " + (char === "char" ? "Char " : "") + type, // Ex. Downhill - Char Score
      "url": "https://dustkid.com/level/" + encodeURIComponent(replay.level), // Level link
      "icon_url": "https://cdn.discordapp.com/emojis/" + characterIcons[replay.character] + ".png", // Character icon
    },
    "thumbnail": {
      "url": "https://i.imgur.com/" + replayTools["level_thumbnails"][replay.level] + ".png", // Level thumbnail
    },
    "description": camera + " " + usernameWrapper + spacing + // [Camera icon] Username
      replayTools.scoreToIcon(replay.score_completion) + previousRank + " _" + replayTools.rankToStr(replay["rank_" + char + "_" + lowercaseType] + 1) + "_" + xWayTie + spacing + // [S] Previous rank -> New rank
      replayTools.scoreToIcon(replay.score_finesse) + previousTime + " _" + replayTools.parseTime(replay.time) + "_", // [S] Previous time -> New time
    "footer": {
      "text": "Date",
    },
    "timestamp": new Date(Number(replay.timestamp) * 1000),
  };
  leaderboardUpdatesChannel.sendTyping();
  leaderboardUpdatesChannel.send({ "embeds": [replayMessage] }).catch((error) => {
    console.error(error);
    console.error(replay);
  });
};

discord.once("ready", () => {
  leaderboardUpdatesChannel = discord.channels.cache.get(config.discord.channels["leaderboard-updates"]);
  mainChannel = discord.channels.cache.get(config.discord.channels["dustforce"]);

  newStream.on("stream", (stream) => {
    mainChannel.sendTyping();
    mainChannel.send("<" + stream.url + "> just went live: " + stream.title).catch((error) => {
      console.error(error);
    });
  });

  newReplay.on("replay", (replay) => {
    // console.log(replay.rid);
    for (const [key, value] of Object.entries(replay.dustbot)) {
      switch (key) {
        case "char_score":
          if ((typeof replay.dustbot["score"] === "undefined" || replay.dustbot.score.WR === false) && value.WR && replay.rank_char_score_ties === 0) {
            createDiscordMessage(replay, "Score", false, "char");
          }
          break;

        case "char_time":
          if ((typeof replay.dustbot["time"] === "undefined" || replay.dustbot.time.WR === false) && value.WR && replay.rank_char_time_ties === 0) {
            createDiscordMessage(replay, "Time", false, "char");
          }
          break;

        case "score":
          if (value.top10) {
            createDiscordMessage(replay, "Score", false, "all");
          }
          if (value.firstSS) {
            createDiscordMessage(replay, "Score", true, "all");
          }
          if (value.WR && replay["rank_all_score_ties"] === 0) {
            createTwitterMessage(replay, "Score");
          }
          break;

        case "time":
          if (value.top10) {
            createDiscordMessage(replay, "Time", false, "all");
          }
          if (value.WR && replay["rank_all_time_ties"] === 0) {
            createTwitterMessage(replay, "Time");
          }
          break;
      }
    }
  });
});
