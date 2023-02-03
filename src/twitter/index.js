const { TwitterApi } = require("twitter-api-v2");

const { parseTime, characterToString, scoreToLetter } = require("../replays/util.js");

const config = require("../../config.json.js");

const twitter = new TwitterApi(config.twitter);

const createTwitterMessage = (replay, type) => {
  const previousSecond = replay.dustbot[type.toLowerCase()].previous_wr;
  const improvedBy = Number(previousSecond["time"]) - Number(replay["time"]);

  let message = "";
  let date = new Date(Number(replay.timestamp) * 1000);
  date = date.toDateString();

  if (previousSecond.user === replay.user) {
    if (Number(replay["time"]) < Number(previousSecond["time"])) {
      message = `${replay.username} improved ${replay.levelname} (${type}) by ${parseTime(improvedBy)} seconds`;
    }
    else {
      message = `${replay.username} improved ${replay.levelname} (${type}) by getting a higher score`;
    }
  }
  else {
    if (Number(replay["time"]) < Number(previousSecond["time"])) {
      message = `${replay.username} beat ${previousSecond.username} on ${replay.levelname} (${type}) by ${parseTime(improvedBy)} seconds`;
    }
    else {
      message = `${replay.username} beat ${previousSecond.username} on ${replay.levelname} (${type}) by getting a higher score`;
    }
  }

  message += ` with a time of ${parseTime(replay.time)}, score ${scoreToLetter(replay.score_completion)}${scoreToLetter(replay.score_finesse)}`
  + ` as ${characterToString(replay.character)} / ${date} #Dustforce"`;

  twitter.v1.tweet(message).catch(error => console.error(error));
};

module.exports = {
  createTwitterMessage,
};
