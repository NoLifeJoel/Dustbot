/*
  Requirements for running this:
    A file named tokens.js in the parent directory of this file with the following content:
      module.exports = {
        "twitch-client-id": 'client-id', // Client ID from the twitch website in the developers section.
        "discord": 'token', // Client token from the discord website in the developers section.
        "api-client": 'token' // Set this to something random for incoming websocket connections that should be allowed to send messages through your discord bot.
      }
      // I do this so that I don't accidentally do something dumb like commit a token to github.
    Dependencies from npm:
      discord.js,
      ws,
      twitch-helix-api
    Highly recommended:
      Proxy the websocket server with SSL (nginx works well for me), or at the very least google the ws library and figure out how to implement SSL.
*/
const discordjs = require('discord.js');
const discord = new discordjs.Client();
const token = require('./../tokens')["discord"];
const wsAPI = require('./websocket-api');
const twitch = require('./twitch-helix');
wsAPI.getStreams = twitch.getStreams;
const generalChannel = {
  "id": '423903301093031966',
  "send": (msg) => {
    return new Promise ((resolve, reject) => {
      if (discord.ws.connection !== null && discord.status === 0) {
        let channel = discord.channels.get(generalChannel.id);
        if (typeof channel !== 'undefined') {
          resolve(channel.send(msg));
        } else {
          reject('Discord connection open, but general channel wasn\'t found.');
        }
      } else {
        reject('Discord connection not open. (Tried to send message to general channel)');
      }
    });
  }
};
setTimeout(() => {
  discord.login(token);
}, 5000);
twitch.on('stream', (stream) => {
  generalChannel.send('<' + stream.url + '> went live: ' + stream.title).then((message) => {
    //console.log(message);
  }).catch((e) => {
    //
  });
  wsAPI.pushEvent('streamAdded', stream);
});
twitch.on('streamDeleted', (stream) => {
  wsAPI.pushEvent('streamDeleted', stream);
});
discord.on('ready', () => {
  discord.user.setPresence({
    "status": 'online',
    "game": {
      "name": 'Dustforce'
    }
  });
});
discord.on('message', (message) => {
  if (message.channel.id === generalChannel.id && (message.content === '.streams' || message.content === '!streams')) {
    let streams = twitch.getStreams();
    if (Object.keys(streams).length === 0) {
      message.channel.send('Nobody is streaming.');
    } else {
      let streamsString = '';
      for (let stream of Object.keys(streams)) {
        if (typeof streams[stream]["url"] !== 'undefined') {
          streamsString += '<' + streams[stream]["url"] + '> - ' + streams[stream]["title"] + '\n';
        }
      }
      if (streamsString === '') {
        message.channel.send('At least 1 person is streaming. I\'ll push notification(s) after I finish gathering data.');
      } else {
        streamsString = streamsString.slice(0, -1);
        message.channel.send(streamsString);
      }
    }
  }
  wsAPI.pushEvent('messageAdd', {
    "channel": {
      "id": message.channel.id,
      "name": message.channel.name,
      "type": message.channel.type
    },
    "message": {
      "id": message.id,
      "content": message.content,
      "createdTimestamp": message.createdTimestamp,
      "system": message.system,
      "author": {
        "id": message.author.id,
        "username": message.author.username,
        "discriminator": message.author.discriminator,
        "bot": message.author.bot
      }
    }
  });
});
discord.on('messageDelete', (message) => {
  wsAPI.pushEvent('messageDelete', {
    "channel": {
      "id": message.channel.id,
      "name": message.channel.name,
      "type": message.channel.type
    },
    "message": {
      "id": message.id,
      "content": message.content,
      "createdTimestamp": message.createdTimestamp,
      "system": message.system,
      "author": {
        "id": message.author.id,
        "username": message.author.username,
        "discriminator": message.author.discriminator,
        "bot": message.author.bot
      }
    }
  });
});
discord.on('messageReactionAdd', (reaction, user) => {
  if (reaction.message.channel.type === 'text') {
    wsAPI.pushEvent('reactionAdd', {
      "message": {
        "id": reaction.message.id,
        "content": reaction.message.content,
        "createdTimestamp": reaction.message.createdTimestamp,
        "system": reaction.message.system,
        "author": {
          "id": reaction.message.author.id,
          "discriminator": reaction.message.author.discriminator,
          "username": reaction.message.author.username,
          "bot": reaction.message.author.bot
        }
      },
      "emoji": {
        "name": reaction._emoji.name,
        "id": reaction._emoji.id
      },
      "channel": {
        "name": reaction.message.channel.name,
        "id": reaction.message.channel.id,
        "type": reaction.message.channel.type
      }
    });
    wsAPI.pushEvent('reactionRemove', {
      "message": {
        "id": reaction.message.id,
        "content": reaction.message.content,
        "createdTimestamp": reaction.message.createdTimestamp,
        "system": reaction.message.system,
        "author": {
          "id": reaction.message.author.id,
          "discriminator": reaction.message.author.discriminator,
          "username": reaction.message.author.username,
          "bot": reaction.message.author.bot
        }
      },
      "emoji": {
        "name": reaction._emoji.name,
        "id": reaction._emoji.id
      },
      "channel": {
        "name": reaction.message.channel.name,
        "id": reaction.message.channel.id
      }
    });
  }
});
wsAPI.discord.send = (msg) => {
  return generalChannel.send(msg);
}
