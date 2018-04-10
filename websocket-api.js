const WebSocket = require('ws');
const wss = new WebSocket.Server({
  "port": 8010,
  "host": '127.0.0.1'
});
const clientToken = require('./../tokens')["api-client"];
const clientIPs = { };
let lastID = 0;
let discord = { };
const pushEvent = (event, msg) => {
  if (typeof event !== 'string') {
    return;
  }
  if (typeof wss.clients !== 'undefined') {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.subscribedEvents.indexOf(msg.eventName) !== -1) {
        client.send(JSON.stringify({
          "event": event,
          "message": msg
        }));
      }
    });
  }
}
let exportObj = {
  "discord": discord,
  "pushEvent": pushEvent,
  "getStreams": null
};
wss.on('connection', (ws, req) => {
  console.log(req.headers);
  if (typeof req.headers["X-Real-IP"] !== 'undefined') { // I set this by proxying the connection through nginx.
    if (typeof clientIPs[req.headers["X-Real-IP"]] === 'undefined') {
      clientIPs[req.headers["X-Real-IP"]] = {
        "tokenFailed": 0
      }
    }
  }
  const clientSend = (msg) => {
    try {
      if (typeof msg === 'object') {
        msg = JSON.stringify(msg);
      }
    } catch (e) { return; }
    if (typeof msg === 'string') {
      ws.send(msg);
    }
  }
  ws.subscribedEvents = [ ];
  lastID++;
  ws.id = lastID;
  clientSend({
    "event": 'getID',
    "message": ws.id
  });
  ws.on('message', (message) => {
    try {
      if (typeof message !== 'string') {
        throw new Error();
      }
      message = JSON.parse(message);
      if (message.constructor !== {}.constructor) {
        throw new Error();
      }
    } catch (e) {
      clientSend({
        "event": 'error',
        "message": 'This server only accepts JSON.'
      });
      return;
    }
    if (typeof message.action === 'string') {
      if (message.action !== 'ping') {
        console.log(message);
      }
      if (typeof message.token !== 'undefined' && typeof req.headers["X-Real-IP"] !== 'undefined') {
        if (clientIPs[req.headers["X-Real-IP"]].tokenFailed > 0) {
          clientSend({
            "event": 'tokenRequestFailed',
            "message": 'You recently failed to guess the client token correctly. You can try again from this IP in approximately ' + clientIPs[req.headers["X-Real-IP"]].tokenFailed + ' minutes.'
          });
          return;
        } else if (message.token !== clientToken) {
          clientSend({
            "event": 'tokenRequestFailed',
            "message": 'You guessed the client token incorrectly. You can try again from this IP in approximately 15 minutes.'
          });
          clientIPs[req.headers["X-Real-IP"]].tokenFailed = 15;
          return;
        }
      }
      switch (message.action) {
        case 'subscribe':
          if (typeof message.message === 'string') {
            if (ws.subscribedEvents.indexOf(message.message) === -1) {
              ws.subscribedEvents.push(message.message);
            }
          }
        break;
        case 'unsubscribe':
          if (typeof message.message === 'string') {
            if (ws.subscribedEvents.indexOf(message.message) !== -1) {
              ws.subscribedEvents.splice(ws.subscribedEvents.indexOf(message.message), 1);
            }
          }
        break;
        case 'getSubscribed':
          clientSend({
            "event": 'subscribedEvents',
            "message": ws.subscribedEvents
          });
        break;
        case 'getID':
          clientSend({
            "event": 'getID',
            "message": ws.id
          });
        break;
        case 'discordSend':
          if (typeof discord.send === 'function') {
            if (typeof message.message === 'string' && typeof message.token === 'string') {
              discord.send(message.message).then((discordMessage) => {
                let sendObj = {
                  "event": 'discordMessageSent',
                  "message": {
                    "discordMessage": {
                      "id": discordMessage.id
                    }
                  }
                };
                if (typeof message.id !== 'undefined') {
                  sendObj["id"] = message.id;
                }
                clientSend(sendObj);
              }).catch((e) => {
                console.log(e);
              });
            }
          } else {
            clientSend({
              "event": 'error',
              "message": 'Discord client doesn\'t appear to be ready.'
            });
          }
        break;
        case 'getStreams':
          if (typeof exportObj.getStreams === 'function') {
            clientSend({
              "event": 'getStreams',
              "message": exportObj.getStreams()
            });
          }
        break;
        case 'ping':
          clientSend({
            "event": 'pong'
          });
        break;
        default:
          clientSend({
            "event": 'error',
            "message": 'Unrecognized action.'
          });
        break;
      }
    }
  });
  ws.on('close', () => {
    try {
      delete ws;
    } catch (e) { }
  });
  ws.on('error', () => {
    try {
      delete ws;
    } catch (e) { }
  })
});
setInterval(() => {
  for (let client of Object.keys(clientIPs)) {
    if (clientIPs[client].tokenfailed > 0) {
      clientIPs[client].tokenfailed--;
    }
  }
}, 60000);
module.exports = exportObj;
