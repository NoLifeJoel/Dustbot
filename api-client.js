const WebSocket = require('ws');
const token = require('./../tokens')["api-client"];
let liveness = 0;
let ws = null;
let msgID = 0;
const send = (msg) => {
  if (typeof msg === 'object') {
    try {
      msg = JSON.stringify(msg);
    } catch (e) { return; }
  }
  if (typeof ws.readyState !== 'undefined' && ws.readyState === 1) {
    ws.send(msg);
  }
}
const connect = () => {
  // 'ws://localhost:8010' for local testing, 'wss://joel4558.com/api/dustforce/discord/ws' for production.
  ws = new WebSocket('ws://localhost:8010');
  ws.on('open', () => {
    console.log('Connection open.');
    /*send({
      "action": 'dustforceDiscordSend',
      "message": 'hi',
      "token": token,
      "id": msgID // Optional parameter, in case you need to track the message.
    });*/
    send({
      "action": 'subscribe',
      "message": 'dustforceDiscordReactionAdd'
    });
    send({
      "action": 'subscribe',
      "message": 'dustforceDiscordReactionRemove'
    });
    send({
      "action": 'subscribe',
      "message": 'dustforceDiscordMessageAdd'
    });
    send({
      "action": 'subscribe',
      "message": 'dustfoceDiscordMessageDelete'
    });
    send({
      "action": 'subscribe',
      "message": 'dustforceDiscordStreamAdded'
    });
    send({
      "action": 'subscribe',
      "message": 'dustforceDiscordStreamDeleted'
    });
    send({
      "action": 'getSubscribed'
    })
  });
  ws.on('message', (msg) => {
    try {
      msg = JSON.parse(msg);
    } catch (e) {
      //console.log(e);
      return;
    }
    liveness = 6;
    if (msg.event !== 'pong') {
      console.log(msg);
    }
  });
  let timer = setInterval(() => {
    liveness--;
    if (liveness < 1) {
      clearInterval(timer);
      connect();
    } else if (liveness < 5) {
      send({
        "action": 'ping'
      });
    }
  }, 10000);
  ws.on('error', (e) => {
    //console.log(e);
  });
}
setTimeout(connect, 5000);
module.exports = {
  "send": (msg) => {
    send(msg);
  }
}
