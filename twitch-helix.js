const twitch = require('./twitch-api');
const fs = require('./filesystem');
const EventEmitter = require('events');
const streamEmitter = new EventEmitter();
const config = require('./config.json');
let startup = false;
let streams = { };
let xiamul_stream = false;
let handleGetStreams = (data) => {
  if (xiamul_stream || data === null) return null;
  let user_ids = [ ];
  for (let stream of data.data) {
    if (typeof config.twitch.blacklist[stream["user_id"]] !== "undefined") continue;
    if (stream["user_id"] === '29504346') {
      xiamul_stream = true;
    }
    let user_id = 'twitch/' + stream["user_id"];
    user_ids.push(stream["user_id"]);
    if (typeof streams[user_id] === 'undefined') {
      streams[user_id] = { };
    }
    streams[user_id]["timer"] = 15;
    streams[user_id]["title"] = stream["title"];
    streams[user_id]["viewer_count"] = stream["viewer_count"];
  }
  if (user_ids.length > 0) {
    return twitch.users.getUsers({
      "id": user_ids
    });
  }
  return null;
}
let handleUserData = (data) => {
  if (data === null) return;
  for (let stream of data.data) {
    let user_id = 'twitch/' + stream["id"];
    if (typeof streams[user_id]["url"] === 'undefined') {
      if (startup === true && typeof config.twitch.blacklist[stream["id"]] === "undefined") {
        streamEmitter.emit('dustforceStream', {
          "url": 'https://www.twitch.tv/' + stream["login"],
          "title": streams[user_id]["title"],
          "id": stream["id"],
          "display_name": stream["display_name"],
          "login": stream["login"]
        });
      }
    }
    streams[user_id]["url"] = 'https://www.twitch.tv/' + stream["login"];
    streams[user_id]["display_name"] = stream["display_name"];
    streams[user_id]["login"] = stream["login"];
  }
  return;
}
function streamLoop () {
  xiamul_stream = false;
  let current_time = new Date();
  twitch.streams.getStreams({
    "game_id": [
      '1436588895',
      '29093'
    ],
    "type": 'live'
  }).then(handleGetStreams).then(handleUserData).then(() => {
    if (xiamul_stream || !(current_time.getDate() === 10 && current_time.getMonth() === 9)) return null;
    return twitch.streams.getStreams({
      "user_id": [
        '29504346'
      ]
    });
  }).then(handleGetStreams).then(handleUserData).catch((e) => {
    console.error(e);
  }).then(() => {
    if (startup === false) {
      startup = true;
    }
    setTimeout(streamLoop, 30000);
  });
}
setTimeout(streamLoop, 10000);
setInterval(() => {
  for (let stream of Object.keys(streams)) {
    streams[stream]["timer"]--;
    if (streams[stream]["timer"] < 1) {
      delete streams[stream];
    }
  }
}, 20000);
streamEmitter.getStreams = () => {
  return streams;
}
streamEmitter.banStream = (username) => {
  twitch.users.getUsers({
    "login": username
  }).then((user) => {
    user = user.data[0]
    config.twitch.blacklist[user.id] = {
      "login": user.login,
      "display_name": user.display_name
    };
    fs.writeFile('config.json', JSON.stringify(config, null, 2), 'utf-8').catch((error) => {
      console.error(error);
    });
  }).catch((error) => {
    console.error(error);
  });
}
streamEmitter.getBannedStreams = () => {
  return config.twitch.blacklist;
}
module.exports = streamEmitter;
