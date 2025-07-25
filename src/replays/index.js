const needle = require("needle");

needle.defaults({
  "user_agent": "Dustbot/1.0"
});

const fs = require("fs");
const EventEmitter = require("events");

const client = require("../discord/client.js");

const { SelfAdjustingInterval } = require("../util/interval.js");

const replayTools = require("./util.js");

const { createTwitterMessage } = require("./twitter.js");

const configPath = `${global.__root}/config.json`;
const config = require(configPath);

const replayEmitter = new EventEmitter();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 *
 * Contents of result of GET `https://dustkid.com/replayviewer.php?replayId=${replayId}&json=true&metaonly&noprettyprint`:
 *
 * @rid [Number] Internal dustkid.com replay ID, if incremented by 1 then made negative can be used to query for the replay in the Dustkid API.
 * @user [Number] User ID of the user that uploaded the replay.
 * @level [String] Level name, can be used to query for the level.
 * @time [Number] Time in milliseconds it took the user to complete the level.
 * @character [Number: 0-7] 0 = Dustman, 1 = Dustgirl, 2 = Dustkid, 3 = Dustworth, 4 = Dustwraith, 5 = Leafsprite, 6 = Trashking, 7 = Slimeboss
 * @score_completion [Number: 1-5] 1 = D, 2 = C, 3 = B, 4 = A, 5 = S
 * @score_finesse [Number: 1-5] 1 = D, 2 = C, 3 = B, 4 = A, 5 = S
 * @apples [Number] Number of apples the user has hit in the replay.
 * @timestamp [Number: Unix Epoch] Time/day the replay was uploaded.
 * @replayId [Number] if > 0, the Replay ID that can be used across dustkid.com & Hitbox, otherwise dustkid.com only.
 * @validated [Number] 1 = Validated, -1 = Frame advance, -5 = TAS, -7 = Minecraft plugin, -8 = Boss mode plugin, -9 = Unload% plugin
 * @dustkid [Number] Appears to always return 1???
 * @input_jumps [Number] Jump inputs.
 * @input_dashes [Number] Dash inputs.
 * @input_lights [Number] Light attack inputs.
 * @input_heavies [Number] Heavy attack inputs.
 * @input_super [Number] Super attack inputs.
 * @input_directions [Number] Directional inputs.
 * @tag [Array/Object] Empty array if nothing, otherwise is a JSON object containing more keys/values indented below.
 *     Note: All [Number] @tag key=>values are actually strings, but can be converted to numbers.
 *     @version [String] Dustmod version
 *     @release [String] stable, ?
 *     @mode [String] dbg_X: Indicates Dustmod options were used that disabled the replay from validating,
 *                           X is a bitmask that idendifies what plugins (if any) were used that disabled the replay from validating.
 *                           More often than not doesn't exist, if it does it's usually set to dbg_0 (No plugins used, only options)
 *     @filth [Number] Amount of dust on the map?
 *     @collected [Number] Amount of dust collected, as per the combo meter. Can be higher than @filth
 *     @apples [Number] Number of apples the user has hit in the replay.
 *     @reason [String] The reason the replay didn't validate. Might not exist.
 *     @genocide [Number] 1 if player killed all enemies, otherwise this key/value doesn't exist.
 * @numplayers [Number] Number of players in the replay.
 * NOTE: Ranks are 0 indexed.
 * @rank_all_score [Number] Current rank the replay is at. (Score)
 * @rank_all_time [Number] Current rank the replay is at. (Time)
 * @rank_char_score [Number] Current rank the replay is at on the character score leaderboard.
 * @rank_char_time [Number] Current rank the replay is at on the character time leaderboard.
 * @username [String] What the user is currently using as their username.
 * @levelname [String] Readable version of the level name. Should not be used to query for the level. (Use @level instead)
 * @pb [bool] Whether or not the replay is currently a PB on either the all characters scores or times leaderboard.
 * @rank_all_score_ties [Number] Amount of players tied for @rank_all_score
 * @rank_all_time_ties [Number] Amount of players tied for @rank_all_time
 * @rank_char_score_ties [Number] Amount of players tied for @rank_char_score
 * @rank_char_time_ties [Number] Amount of players tied for @rank_char_time
 *
 */

const getReplay = async (replayId) => {
  const replay = await needle("get", `https://dustkid.com/replayviewer.php?replay_id=${replayId}&json=true&metaonly&noprettyprint`, {
    parse: "json",
  });

  if (/^text\/html/.test(replay.headers["content-type"])) {
    throw new Error("Replay not found.");
  }

  if (!replay || !replay.body || !Object.keys(replay.body).length) {
    throw new Error("Replay missing metadata.");
  }

  return replay.body;
};

/**
 *
 * This is what sortHistory returns after feeding it pbHistory. It's ordered by rank, from smallest to biggest.
 * @replays [Object]
 *    @scores [Array]->[Object]
 *        @timestamp [Number: Unix Epoch] Time/day the replay was uploaded.
 *        @time [Number] Time in milliseconds it took the user to complete the level.
 *        @rank [Number] What rank the PB would be if it were current, 1 indexed.
 *    @times [Array]->[Object] Similar to the scores array above.
 *        @timestamp [Number: Unix Epoch] Time/day the replay was uploaded.
 *        @time [Number] Time in milliseconds it took the user to complete the level.
 *        @rank [Number] What rank the PB would be if it were current, 1 indexed.
 */

const sortHistory = (pbHistory) => {
  const replays = {};
  for (const timesRanks in pbHistory.pbtimes) {
    if (Object.prototype.hasOwnProperty.call(pbHistory.pbtimes, timesRanks)) {
      const dataIterations = pbHistory.pbtimes[timesRanks].x.length;
      if (pbHistory.pbtimes[timesRanks].name === "Scores PBs") {
        replays.scores = new Array(dataIterations);
        for (let data = 0; data < dataIterations; data++) {
          const replay = {
            "timestamp": Math.trunc(pbHistory.pbtimes[timesRanks].x[data] / 1000),
            "time": Math.round(pbHistory.pbtimes[timesRanks].y[data] * 1000),
            "rank": pbHistory.pbranks[timesRanks].y[data],
          };

          replays.scores[data] = replay;
        }

        replays.scores.reverse();
      }

      if (pbHistory.pbtimes[timesRanks].name === "Times PBs") {
        replays.times = new Array(dataIterations);
        for (let data = 0; data < dataIterations; data++) {
          const replay = {
            "timestamp": Math.trunc(pbHistory.pbtimes[timesRanks].x[data] / 1000),
            "time": Math.round(pbHistory.pbtimes[timesRanks].y[data] * 1000),
            "rank": pbHistory.pbranks[timesRanks].y[data],
          };

          replays.times[data] = replay;
        }

        replays.times.reverse();
      }
    }
  }

  return replays;
};

const updateNewestReplayId = async () => {
  const response = await needle("get", "https://dustkid.com/search.php?validation=1&order=0&json=1&max=5", {
    parse: "json",
  });
  const replays = JSON.parse(response.body);
  if (typeof replays !== "object") {
    throw new Error(replays);
  }

  for (const metadata of replays) {
    // `metadata.replay` is a string like, "/replay/-1234567" or
    // "/replay/1234567"
    const replayId = Number(metadata.replay.substring(8));
    if (replayId >= 0) {
      // Dustkid replays have IDs that are negative numbers (to separate them
      // from Hitbox replay IDs), which are the only ones we care about
      continue;
    }

    if (replayId < config.replays.newest) {
      config.replays.newest = replayId;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      break;
    }
  }
};

/**
 *
 * Contents of "let pbHistory = JSON.parse(res.body);":
 * @charcounts [Array] Objects containing the following values below.
 *    @value [Number] Amount of times the user has PB'd the level with this character
 *    @color [String] HEX color code for pie chart used on the non-json version of this page.
 *    @highlight [String] HEX color code for when you hover over the pie chart for this character.
 *    @label [String] Name of character ex. Dustman, Dustgirl, etc.
 * @scorecounts [Array] Objects containing the following values below.
 *    @value [Number] Amount of times the user has PB'd the level with this score
 *    @color [String] RGBa color code for this score on the pie chart.
 *    @label [String] The two characters representing the score. ex: SS, BA, etc.
 * @pbtimes [Array] Objects containing the following values below.
 *    @x [Array]->[Number] Timestamps of PB's.
 *    @y [Array]->[Number] Times of PB's in the format of `seconds.milliseconds`
 *    @margin [Object] Unknown use.
 *      @t [Number] Unknown use.
 *    @type [String] Appears to always say "scatter"
 *    @name [String] Specifies whether the containing object is "Times PBs" or "Scores PBs"
 * @pbranks [Array] Objects containing the values below.
 *    @x [Array]->[Number] Timestamps of PB's.
 *    @y [Array]->[Number] What rank the PB would be if it were current, 1 indexed.
 *    @margin [Object] Unknown use.
 *      @t [Number] Unknown use.
 *    @type [String] Appears to always say "scatter"
 *    @name [String] Specifies whether the containing object is "Times PBs" or "Scores PBs"
 *
 */

const processReplay = async (replayId) => {
  if (replayId < config.replays.newest) {
    // replay IDs are negative numbers; check if we're caught up to the latest
    // update

    await updateNewestReplayId();

    if (replayId < config.replays.newest) {
      // we're all caught up to the latest replay, so increase the interval
      // somewhat
      await sleep(5 * 1000);
      return null;
    }
  }

  const replay = await getReplay(replayId);
  replay.dustbot = {};
  if (replay && replay.validated && replayTools.level_thumbnails[replay.level] && replay.user > -1) {
    // replay is validated, part of the base game, and not multiplayer.
    if (replay.pb && (replay.rank_all_score < 10 || replay.rank_all_time < 10 || replay.level === "yottadifficult" || replay.level === "exec func ruin user")) {
      let pbHistory = await needle("get", `https://dustkid.com/json/levelstats/${encodeURIComponent(replay.level)}/${replay.user}/${encodeURIComponent(replay.username)}`, {
        parse: "json",
      });
      pbHistory = JSON.parse(pbHistory.body);

      let firstSS = false;
      if (pbHistory.scorecounts[0].value === 1 && replay.score_completion === 5 && replay.score_finesse === 5) {
        firstSS = true;
      }
      pbHistory = sortHistory(pbHistory);

      let replayBoard = "score";
      while (replayBoard !== "done") {
        if (pbHistory[`${replayBoard}s`][0].timestamp === replay.timestamp) {
          if (typeof replay.dustbot[replayBoard] === "undefined") {
            replay.dustbot[replayBoard] = {
              "top10": false,
              "WR": false,
            };

            if (replayBoard === "score") {
              replay.dustbot[replayBoard].firstSS = firstSS;
            }
          }

          if (replay[`rank_all_${replayBoard}`] < 10) {
            replay.dustbot[replayBoard].top10 = true;
          }

          if (replay[`rank_all_${replayBoard}`] === 0) {
            let wrHistory = await needle("get", `https://dustkid.com/json/levelhistory/${encodeURIComponent(replay.level)}/all`);
            wrHistory = JSON.parse(wrHistory.body);

            if (replay[`rank_all_${replayBoard}_ties`] === 0) {
              replay.dustbot[replayBoard].previous_wr = wrHistory.wrs[(replayBoard === "score" ? 0 : 16)][(wrHistory.wrs[replayBoard === "score" ? 0 : 16].length - 2)];
              let previousName = await needle("get", `https://dustkid.com/json/profile/${replay.dustbot[replayBoard].previous_wr.user}/all`, {
                parse: "json",
              });
              previousName = Object.values(Object.values(JSON.parse(previousName.body))[0])[0].username;
              replay.dustbot[replayBoard].previous_wr.username = previousName;
            }

            replay.dustbot[replayBoard].WR = true;
          }

          if (pbHistory[`${replayBoard}s`][1]) {
            replay.dustbot[replayBoard]["previous_rank"] = pbHistory[`${replayBoard}s`][1].rank;
            replay.dustbot[replayBoard]["previous_time"] = pbHistory[`${replayBoard}s`][1].time;
            replay.dustbot[replayBoard]["previous_timestamp"] = pbHistory[`${replayBoard}s`][1].timestamp;
          }
        }

        switch (replayBoard) {
          case "score":
            replayBoard = "time";
            break;

          default:
            replayBoard = "done";
            break;
        }
      }
    }

    charblock: if ((replay.rank_char_score === 0 && replay.rank_char_score_ties === 0) || (replay.rank_char_time  === 0 && replay.rank_char_time_ties  === 0)) {
      let character;
      switch (replay.character) {
        case 0:
          character = "man";
          break;
        case 1:
          character = "girl";
          break;
        case 2:
          character = "kid";
          break;
        case 3:
          character = "worth";
          break;
        default:
          break charblock;
      }

      let pbHistory = await needle("get", `https://dustkid.com/json/levelstats/${encodeURIComponent(replay.level)}/${replay.user}/${encodeURIComponent(replay.username)}/${character}`, {
        parse: "json",
      });
      pbHistory = JSON.parse(pbHistory.body);
      let firstSS = false;
      if (pbHistory.scorecounts[0].value === 1 && replay.score_completion === 5 && replay.score_finesse === 5) {
        firstSS = true;
      }
      pbHistory = sortHistory(pbHistory);

      let replayBoard = "score";
      while (replayBoard !== "done") {
        if (pbHistory[`${replayBoard}s`][0].timestamp === replay.timestamp) {
          if (typeof replay.dustbot[`char_${replayBoard}`] === "undefined") {
            replay.dustbot[`char_${replayBoard}`] = {
              "top10": false,
              "WR": false,
            };
          }

          if (replayBoard === "score") {
            replay.dustbot[`char_${replayBoard}`].firstSS = firstSS;
          }

          if (replay[`rank_char_${replayBoard}`] < 10) {
            replay.dustbot[`char_${replayBoard}`].top10 = true;
          }

          if (replay[`rank_char_${replayBoard}`] === 0) {
            replay.dustbot[`char_${replayBoard}`].WR = true;
          }

          if (pbHistory[`${replayBoard}s`][1]) {
            replay.dustbot[`char_${replayBoard}`]["previous_rank"] = pbHistory[`${replayBoard}s`][1].rank;
            replay.dustbot[`char_${replayBoard}`]["previous_time"] = pbHistory[`${replayBoard}s`][1].time;
            replay.dustbot[`char_${replayBoard}`]["previous_timestamp"] = pbHistory[`${replayBoard}s`][1].timestamp;
          }
        }

        switch (replayBoard) {
          case "score":
            replayBoard = "time";
            break;

          default:
            replayBoard = "done";
            break;
        }
      }
    }
  }

  replayEmitter.emit("replay", replay);

  config.replays.lastProcessed = replayId;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return replay;
};

const processReplays = async () => {
  try {
    await processReplay(config.replays.lastProcessed - 1);
  }
  catch (error) {
    if (error.message === "Replay not found.") {
      config.replays.lastProcessed--;
    }
    else {
      await sleep(10 * 1000);
      if (error.code !== "ECONNRESET" && error.message !== "query timed out.") {
        console.error(error);
      }

      if (error.message === "query timed out.") {
        await sleep(10 * 1000);
      }
    }
  }
};

new SelfAdjustingInterval(processReplays, 2000, (error) => {
  console.error(error, "failed to process replays.");
}).start();

let leaderboardUpdatesChannel;
const createDiscordMessage = (replay, type, firstSS, char) => {
  const lowercaseType = type.toLowerCase();
  const colors = [8493779, 12147535, 11829461, 9874791];
  const camera = `[<:camera:401772771908255755>](https://dustkid.com/replay/${replay.replay_id})`;
  const characterIcons = ["401402235004911616", "401402216272887808", "401402223357329418", "401402248040546315"];
  const usernameWrapper = `**[${replay.username}](https://dustkid.com/profile/${replay.user}/)**`;
  const spacing = "\n       ";
  let xWayTie = "";
  let previousTime = "";
  let previousRank = "";
  if (typeof replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType] === "object" && typeof replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType].previous_rank === "number") {
    previousRank = ` _${replayTools.rankToStr(replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType].previous_rank - 1)}_  ->`;
    previousTime = ` _${replayTools.parseTime(replay.dustbot[(char === "char" ? "char_" : "") + lowercaseType].previous_time)}_  ->`;
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

client.once("ready", () => {
  leaderboardUpdatesChannel = client.channels.cache.get(config.discord.channels["leaderboard-updates"]);

  replayEmitter.on("replay", (replay) => {
    console.log(replay.rid);
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

module.exports = { replayEmitter };
