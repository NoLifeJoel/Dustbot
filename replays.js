const needle = require('needle');
const fs = require('node:fs');
const config = require('./config.json');
const EventEmitter = require('node:events');
const replayEmitter = new EventEmitter();
const replayTools = require('./replayTools');

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 
 * Contents of "let replay = JSON.parse(res.body);":
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
 * @replay_id [Number] if > 0, the Replay ID that can be used across dustkid.com & Hitbox, otherwise dustkid.com only.
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

async function get_replay (replay_id) {
  let replay = await needle('get', `https://dustkid.com/replayviewer.php?replay_id=${replay_id}&json=true&metaonly&noprettyprint`);
  if (/^text\/html/.test(replay.headers['content-type'])) throw new Error('Replay not found.');
  replay = JSON.parse(replay.body);
  if (replay === false) throw new Error('Replay missing metadata.');
  return replay;
}

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

async function processReplay (replay_id) {
  if (replay_id < config.replays.newest) {
    await updateNewestReplay();
    if (replay_id < config.replays.newest) {
      await sleep(5 * 1000);
      return null;
    }
  }
  let replay = await get_replay(replay_id);
  replay.dustbot = { };
  if (replay && replay.validated && replayTools.level_thumbnails[replay.level] && replay.user > -1) { // Check if replay is validated, part of the base game, & not multiplayer.
    if (replay.pb && (replay.rank_all_score < 10 || replay.rank_all_time < 10 || replay.level === 'yottadifficult' || replay.level === 'exec func ruin user')) {
      let pbHistory = await needle('get', `https://dustkid.com/json/levelstats/${encodeURIComponent(replay.level)}/${replay.user}/${encodeURIComponent(replay.username)}`);
      pbHistory = JSON.parse(pbHistory.body);
      let firstSS = false;
      if (pbHistory.scorecounts[0].value === 1 && replay.score_completion === 5 && replay.score_finesse === 5) {
        firstSS = true;
      }
      pbHistory = sortHistory(pbHistory);
      let replayBoard = 'score';
      while (replayBoard !== 'done') {
        if (pbHistory[replayBoard + 's'][0].timestamp === replay.timestamp) {
          if (typeof replay.dustbot[replayBoard] === 'undefined') {
            replay.dustbot[replayBoard] = {
              "top10": false,
              "WR": false
            };
            if (replayBoard === 'score') {
              replay.dustbot[replayBoard].firstSS = firstSS;
            }
          }
          if (replay['rank_all_' + replayBoard] < 10) {
            replay.dustbot[replayBoard].top10 = true;
          }
          if (replay['rank_all_' + replayBoard] === 0) {
            let wrHistory = await needle('get', `https://dustkid.com/json/levelhistory/${encodeURIComponent(replay.level)}/all`);
            wrHistory = JSON.parse(wrHistory.body);
            if (replay['rank_all_' + replayBoard + '_ties'] === 0) {
              replay.dustbot[replayBoard].previous_wr = wrHistory.wrs[(replayBoard === 'score' ? 0 : 16)][(wrHistory.wrs[replayBoard === 'score' ? 0 : 16].length - 2)];
              let previousName = await needle('get', `https://dustkid.com/json/profile/${replay.dustbot[replayBoard].previous_wr.user}/all`);
              previousName = Object.values(Object.values(JSON.parse(previousName.body))[0])[0].username;
              replay.dustbot[replayBoard].previous_wr.username = previousName;
            }
            replay.dustbot[replayBoard].WR = true;
          }
          if (pbHistory[replayBoard + 's'][1]) {
            replay.dustbot[replayBoard]['previous_rank'] = pbHistory[replayBoard + 's'][1].rank;
            replay.dustbot[replayBoard]['previous_time'] = pbHistory[replayBoard + 's'][1].time;
            replay.dustbot[replayBoard]['previous_timestamp'] = pbHistory[replayBoard + 's'][1].timestamp;
          }
        }
        switch(replayBoard) {
          case 'score':
            replayBoard = 'time';
          break;
          default:
            replayBoard = 'done';
          break;
        }
      }
    }
    charblock: if ((replay.rank_char_score === 0 && replay.rank_char_score_ties === 0) || (replay.rank_char_time  === 0 && replay.rank_char_time_ties  === 0)) {
      let character;
      switch (replay.character) {
        case 0:
          character = 'man';
        break;
        case 1:
          character = 'girl';
        break;
        case 2:
          character = 'kid';
        break;
        case 3:
          character = 'worth';
        break;
        default: break charblock;
      }
      let pbHistory = await needle('get', `https://dustkid.com/json/levelstats/${encodeURIComponent(replay.level)}/${replay.user}/${encodeURIComponent(replay.username)}/${character}`);
      pbHistory = JSON.parse(pbHistory.body);
      let firstSS = false;
      if (pbHistory.scorecounts[0].value === 1 && replay.score_completion === 5 && replay.score_finesse === 5) {
        firstSS = true;
      }
      pbHistory = sortHistory(pbHistory);
      let replayBoard = 'score';
      while (replayBoard !== 'done') {
        if (pbHistory[replayBoard + 's'][0].timestamp === replay.timestamp) {
          if (typeof replay.dustbot['char_' + replayBoard] === 'undefined') {
            replay.dustbot['char_' + replayBoard] = {
              "top10": false,
              "WR": false
            };
          }
          if (replayBoard === 'score') {
            replay.dustbot['char_' + replayBoard].firstSS = firstSS;
          }
          if (replay['rank_char_' + replayBoard] < 10) {
            replay.dustbot['char_' + replayBoard].top10 = true;
          }
          if (replay['rank_char_' + replayBoard] === 0) {
            replay.dustbot['char_' + replayBoard].WR = true;
          }
          if (pbHistory[replayBoard + 's'][1]) {
            replay.dustbot['char_' + replayBoard]['previous_rank'] = pbHistory[replayBoard + 's'][1].rank;
            replay.dustbot['char_' + replayBoard]['previous_time'] = pbHistory[replayBoard + 's'][1].time;
            replay.dustbot['char_' + replayBoard]['previous_timestamp'] = pbHistory[replayBoard + 's'][1].timestamp;
          }
        }
        switch(replayBoard) {
          case 'score':
            replayBoard = 'time';
          break;
          default:
            replayBoard = 'done';
          break;
        }
      }
    }
  }
  replayEmitter.emit('replay', replay);
  config.replays.last_processed = replay_id;
  fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
  return replay;
}

(async () => {
  await sleep(5 * 1000);
  while (true) {
    await sleep(2 * 1000);
    try {
      let replay = await processReplay(config.replays.last_processed - 1);
      // if (replay !== null) { }
    } catch (e) {
      if (e.message === 'Replay not found.') {
        config.replays.last_processed--;
      } else {
        await sleep(10 * 1000);
        if (e.code !== 'ECONNRESET' && e.message !== 'query timed out.' && e.message !== 'query timed out') {
          console.error(e);
        }
        if (e.message === 'query timed out.' || e.message === 'query timed out') {
          await sleep(10 * 1000);
        }
      }
    }
  }
})();

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

function sortHistory (pbHistory) {
  let replays = { };
  for (let timesRanks in pbHistory.pbtimes) {
    let dataIterations = pbHistory.pbtimes[timesRanks].x.length;
    if (pbHistory.pbtimes[timesRanks].name === "Scores PBs") {
      replays.scores = new Array(dataIterations);
      for (let data = 0; data < dataIterations; data++) {
        let replay = {
          "timestamp": Math.trunc(pbHistory.pbtimes[timesRanks].x[data] / 1000),
          "time": Math.round(pbHistory.pbtimes[timesRanks].y[data] * 1000),
          "rank": pbHistory.pbranks[timesRanks].y[data]
        };
        replays.scores[data] = replay;
      }
      replays.scores.reverse();
    }
    if (pbHistory.pbtimes[timesRanks].name === "Times PBs") {
      replays.times = new Array(dataIterations);
      for (let data = 0; data < dataIterations; data++) {
        let replay = {
          "timestamp": Math.trunc(pbHistory.pbtimes[timesRanks].x[data] / 1000),
          "time": Math.round(pbHistory.pbtimes[timesRanks].y[data] * 1000),
          "rank": pbHistory.pbranks[timesRanks].y[data]
        };
        replays.times[data] = replay;
      }
      replays.times.reverse();
    }
  }
  return replays;
}

async function updateNewestReplay () {
  let response = await needle('get', "https://dustkid.com/search.php?validation=1&order=0&json=1&max=5");
  let replays = JSON.parse(response.body);
  if (typeof replays !== 'object') throw new Error(replays);
  for (let replay of replays) {
    let replay_id = Number(replay.replay.substring(8)); // replay.replay = /replay/[int]
    if (replay_id >= 0) continue; // Internally using dustkid ID's for the most part.
    if (replay_id < config.replays.newest) {
      config.replays.newest = replay_id;
      fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    }
    break;
  }
}

module.exports = {
  "getReplay": get_replay,
  "newReplay": replayEmitter
};
