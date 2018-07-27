const request = require('./request');
const fs = require('./filesystem');
const replayTools = require('./replayTools');
const querystring = require('querystring');
const EventEmitter = require('events');
const replayEmitter = new EventEmitter();
let last_replay;
let nullAttempts = 0;
setTimeout(() => {
  fs.readFile('last_replay', 'utf8').then((data) => {
    data = JSON.parse(data);
    if (typeof data === 'number') {
      last_replay = data;
      getReplay(last_replay, true);
      return;
    }
    throw new Error('Couldn\'t parse last_replay.txt as a number.');
  }).catch((e) => {
    throw new Error(e); // Crash the script, we NEED this file.
  });
}, 10000);
function getReplay (replay_id, loop=false) {
  request({
    "host": 'df.hitboxteam.com',
    "path": '/backend6/get_replay_meta.php?' + querystring.stringify({
      "extended": true,
      "replay": replay_id
    })
  }).then((response) => {
    let data = JSON.parse(response.data);
    if (typeof data.error !== 'undefined') {
      throw new Error(data.error);
    }
    if (data.score === null) {
      nullAttempts++;
      throw new Error('Replay not finished parsing.');
    }
    nullAttempts = 0;
    return request({
      "host": 'df.hitboxteam.com',
      "path": '/backend6/get_ties.php?' + querystring.stringify({
        "score": data.finesse + data.completion,
        "time": data.time,
        "timestamp": data.timestamp,
        "level_id": data.level_id
      })
    }).then((response) => {
      response["replay"] = data;
      return response;
    });
  }).then((response) => {
    let replay = response.replay;
    let ties = JSON.parse(response.data);
    let score_ties = ties.filter((tie_replay) => {
      return tie_replay.best_score === '1' && tie_replay.user_id !== replay.user_id;
    });
    let time_ties = ties.filter((tie_replay) => {
      return tie_replay.best_time === '1' && tie_replay.user_id !== replay.user_id;
    });
    replay["score_tied_with"] = replay.score_rank - score_ties.length;
    replay["time_tied_with"] = replay.time_rank - time_ties.length;
    replay["loop"] = loop;
    last_replay++;
    if (replay["score_rank_pb"] || replay["time_rank_pb"]) {
      return request({
        "host": 'df.hitboxteam.com',
        "path": '/backend6/userScoresHistory.php?' + querystring.stringify({
          "level": replay.level_name,
          "id": replay.user_id
        })
      }).then((response) => {
        response["replay"] = replay;
        return response;
      });
    }
    fs.writeFile('last_replay', last_replay, 'utf8').catch((error) => {
      console.error(error);
    });
    replayEmitter.emit('replay', replay);
    return null;
  }).then((response) => {
    if (response === null) {
      return null;
    }
    let levelPBs = JSON.parse(response.data);
    let replay = response["replay"];
    delete levelPBs["info"];
    levelPBs = Object.values(levelPBs);
    let time_pbs = levelPBs.filter((replay) => {
      return replay["best_time"] === '1';
    });
    let score_pbs = levelPBs.filter((replay) => {
      return replay["best_score"] === '1';
    });
    if (replay["score_rank_pb"]) {
      replay["previous_score_pb"] = find_previous(replay, score_pbs);
    }
    if (replay["time_rank_pb"]) {
      replay["previous_time_pb"] = find_previous(replay, time_pbs);
    }
    return new Promise ((resolve, reject) => {
      let resolved = [ false, false ];
      if (typeof replay["previous_time_pb"] !== 'undefined' && replay["previous_time_pb"] !== null) {
        request({
          "host": 'df.hitboxteam.com',
          "path": '/backend6/get_replay_meta.php?' + querystring.stringify({
            "extended": true,
            "replay": replay["previous_time_pb"]["replay"]
          })
        }).then((response) => {
          replay["previous_time_pb"] = JSON.parse(response.data);
          if (resolved[1]) {
            resolve(replay);
          } else {
            resolved[0] = true;
          }
        }).catch((e) => {
          reject(e);
        });
      } else {
        if (resolved[1]) {
          resolve(replay);
        } else {
          resolved[0] = true;
        }
      }
      if (typeof replay["previous_score_pb"] !== 'undefined' && replay["previous_score_pb"] !== null) {
        request({
          "host": 'df.hitboxteam.com',
          "path": '/backend6/get_replay_meta.php?' + querystring.stringify({
            "extended": true,
            "replay": replay["previous_score_pb"]["replay"]
          })
        }).then((response) => {
          replay["previous_score_pb"] = JSON.parse(response.data);
          if (resolved[0]) {
            resolve(replay);
          } else {
            resolved[1] = true;
          }
        }).catch((e) => {
          reject(e);
        });
      } else {
        if (resolved[0]) {
          resolve(replay);
        } else {
          resolved[1] = true;
        }
      }
    });
  }).then((replay) => {
    if (replay !== null) {
      replayEmitter.emit('replay', replay);
      fs.writeFile('last_replay', last_replay, 'utf8').catch((error) => {
        console.error(error);
      });
    }
    return true;
  }).catch((error) => {
    return new Promise((resolve, reject) => {
      if (error.message !== 'Replay not found.' && error.message !== 'Replay not finished parsing.') {
        console.error(error);
      }
      if (nullAttempts > 2) {
        nullAttempts = 0;
        setTimeout(() => {
          resolve(true);
        }, 30000);
      } else {
        setTimeout(() => {
          resolve(false);
        }, 30000);
      }
    });
  }).then((finished) => {
    if (finished) {
      replay_id++;
    }
    if (loop) {
      getReplay(replay_id, true);
    }
  });
}
function find_previous (replay, pb_replays) {
  for (let pb_replay of pb_replays) {
    pb_replay["finesse"] = replayTools.letterToScore(pb_replay["score_finesse"]);
    pb_replay["completion"] = replayTools.letterToScore(pb_replay["score_thoroughness"]);
    if (!compareReplays(replay, pb_replay)) {
      return pb_replay;
    }
  }
  return null;
}
function compareReplays (replay1, replay2) {
  let replayOneScore = replay1["finesse"] + replay1["completion"];
  let replayTwoScore = replay2["finesse"] + replay2["completion"];
  if (replayOneScore === replayTwoScore && replay1["time"] === replay2["time"]) {
    return true;
  }
  return false;
}
module.exports = replayEmitter;
