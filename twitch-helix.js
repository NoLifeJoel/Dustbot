const twitch = require('twitch-helix-api');
const EventEmitter = require('events');
const streamEmitter = new EventEmitter();
let startup = false;
twitch.clientID = require('./config')["twitch-client-id"];
let streams = { };
function streamLoop () {
  twitch.streams.getStreams({
    "game_id": [
     '29093'
    ],
    "type": 'live'
  }).then((data) => {
    let res = data.response.data;
    let user_ids = [ ];
    for (let stream of res) {
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
  }).then((data) => {
    if (data === null) {
      return;
    }
    let res = data.response.data;
    for (let stream of res) {
      let user_id = 'twitch/' + stream["id"];
      if (typeof streams[user_id]["url"] === 'undefined') {
        if (startup === true) {
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
  }).catch((e) => {
    console.error(e);
  }).then(() => {
    if (startup === false) {
      startup = true;
    }
    setTimeout(streamLoop, 30000);
  });
}
setTimeout(streamLoop, 5000);
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
module.exports = streamEmitter;
