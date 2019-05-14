const request = require('./request');
const querystring = require('querystring');
const EventEmitter = require('events');
const streamEmitter = new EventEmitter();
let streams = { };
let startup = false;
function streamLoop() {
  request({
    "host": 'mixer.com',
    "path": '/api/v1/channels?' + querystring.stringify({
      "where": 'typeId.eq.116133',
      "fields": 'name,token' // name = Stream name, token = Username / Stream URL
    }),
    "special": {
      "https": true
    }
  }).then((response) => {
    let res = JSON.parse(response.data);
    for (let stream of res) {
      let user_id = 'mixer/' + stream["token"];
      if (typeof streams[user_id] === 'undefined') {
        streams[user_id] = { };
        if (startup === true) {
          streamEmitter.emit('dustforceStream', {
            "url": 'https://www.mixer.com/' + stream["token"],
            "title": stream["name"],
            "login": stream["token"]
          });
        }
        streams[user_id]["url"] = 'https://www.mixer.com/' + stream["token"];
        streams[user_id]["login"] = stream["token"];
      }
      streams[user_id]["timer"] = 15;
      streams[user_id]["title"] = stream["name"];
    }
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
streamEmitter.on('dustforceStream', (stream) => {
  console.log(stream);
});
