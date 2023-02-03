import { TwitterApi } from 'twitter-api-v2';

import replayTools from '../replays/util.js';

import config from '../../config.json.js';

const twitter = new TwitterApi(config.twitter);

export function createTwitterMessage (replay, type) {
  let previous_second = replay.dustbot[type.toLowerCase()].previous_wr;
  let improvedBy = Number(previous_second["time"]) - Number(replay["time"]);
  let message = '';
  let date = new Date(Number(replay.timestamp) * 1000);
  date = date.toDateString();
  if (previous_second.user === replay.user) {
    if (Number(replay["time"]) < Number(previous_second["time"])) {
      message = replay.username + ' improved ' + replay.levelname + ' (' + type + ') by ' + replayTools.parseTime(improvedBy) +
        ' seconds with a time of ' + replayTools.parseTime(replay.time) + ', score ' + replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    } else {
      message = replay.username + ' improved ' + replay.levelname + ' (' + type + ') by getting a higher score with a time of ' + replayTools.parseTime(replay.time) +
        ', score ' + replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    }
  } else {
    if (Number(replay["time"]) < Number(previous_second["time"])) {
      message = replay.username + ' beat ' + previous_second.username + ' on ' + replay.levelname + ' (' + type + ') by ' + replayTools.parseTime(improvedBy) + ' seconds with a time of ' +
        replayTools.parseTime(replay.time) + ', score ' + replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    } else {
      message = replay.username + ' beat ' + previous_second.username + ' on ' + replay.levelname + ' (' + type + ') by getting a higher score with a time of ' + replayTools.parseTime(replay.time) + ', score ' +
        replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    }
  }

  twitter.v1.tweet(message).catch(e => console.error(e));
}
