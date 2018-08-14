const twitch = require('twitch-helix-api');
const EventEmitter = require('events');
const streamEmitter = new EventEmitter();
let startup = false;
twitch.clientID = require('./../tokens')["twitch-client-id"];
let streams = { };
let gliStream = {
  "timer": 0
};
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
      user_ids.push(stream["user_id"]);
      if (typeof streams[stream["user_id"]] === 'undefined') {
        streams[stream["user_id"]] = { };
      }
      streams[stream["user_id"]]["timer"] = 15;
      streams[stream["user_id"]]["title"] = stream["title"];
      streams[stream["user_id"]]["viewer_count"] = stream["viewer_count"];
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
      if (typeof streams[stream["id"]]["url"] === 'undefined') {
        if (startup === true) {
          streamEmitter.emit('dustforceStream', {
            "url": 'https://www.twitch.tv/' + stream["login"],
            "title": streams[stream["id"]]["title"],
            "id": stream["id"],
            "display_name": stream["display_name"],
            "login": stream["login"]
          });
        }
      }
      streams[stream["id"]]["url"] = 'https://www.twitch.tv/' + stream["login"];
      streams[stream["id"]]["display_name"] = stream["display_name"];
      streams[stream["id"]]["login"] = stream["login"];
    }
    return;
  }).then(() => {
    return twitch.streams.getStreams({
      "user_id": [
        '32246447'
      ]
    });
  }).then((data) => {
    let res = data.response.data;
    if (res.length === 1) {
      gliStream.title = res[0].title;
      return res[0];
    }
    return null;
  }).then((res) => {
    if (res === null) return null;
    return twitch.games.getGames({
      "id": [
        res.game_id
      ]
    });
  }).then((data) => {
    if (data === null) return null;
    let res = data.response.data[0];
    res.box_art_url = res.box_art_url.replace('{width}', '80').replace('{height}', '107');
    gliStream.game = res.name;
    gliStream.game_box_art = res.box_art_url;
    if (gliStream.timer === 0) {
      streamEmitter.emit('gliStream', gliStream);
    }
    gliStream.timer = 12;
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
  if (gliStream.timer > 0) {
    gliStream.timer--;
  }
}, 20000);
streamEmitter.getStreams = () => {
  return streams;
}
module.exports = streamEmitter;
