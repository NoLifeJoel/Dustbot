import { TwitterApi } from "twitter-api-v2";

import { parseTime, characterToString, scoreToLetter } from "../replays/util.js";

import config from "../../config.json.js";

const twitter = new TwitterApi(config.twitter);

export const createTwitterMessage = (replay, type) => {
  const previousSecond = replay.dustbot[type.toLowerCase()].previous_wr;
  const improvedBy = Number(previousSecond["time"]) - Number(replay["time"]);

  let message = "";
  let date = new Date(Number(replay.timestamp) * 1000);
  date = date.toDateString();

  if (previousSecond.user === replay.user) {
    if (Number(replay["time"]) < Number(previousSecond["time"])) {
      message = `${replay.username} improved ${replay.levelname} (${type}) by ${parseTime(improvedBy)} seconds with a time`
      + `of ${parseTime(replay.time)}, score ${scoreToLetter(replay.score_completion)}${scoreToLetter(replay.score_finesse)}`
      + ` as ${characterToString(replay.character)} / ${date} #Dustforce"`;
    }
    else {
      message = replay.username + " improved " + replay.levelname + " (" + type + ") by getting a higher score with a time of " + parseTime(replay.time) +
        ", score " + scoreToLetter(replay.score_completion) + scoreToLetter(replay.score_finesse) +
        " as " + characterToString(replay.character) + " / " + date + " #Dustforce";
    }
  }
  else {
    if (Number(replay["time"]) < Number(previousSecond["time"])) {
      message = replay.username + " beat " + previousSecond.username + " on " + replay.levelname + " (" + type + ") by " + parseTime(improvedBy) + " seconds with a time of " +
        parseTime(replay.time) + ", score " + scoreToLetter(replay.score_completion) + scoreToLetter(replay.score_finesse) +
        " as " + characterToString(replay.character) + " / " + date + " #Dustforce";
    }
    else {
      message = replay.username + " beat " + previousSecond.username + " on " + replay.levelname + " (" + type + ") by getting a higher score with a time of " + parseTime(replay.time) + ", score " +
        scoreToLetter(replay.score_completion) + scoreToLetter(replay.score_finesse) +
        " as " + characterToString(replay.character) + " / " + date + " #Dustforce";
    }
  }

  twitter.v1.tweet(message).catch(error => console.error(error));
};
