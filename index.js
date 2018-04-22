/*
  Requirements for running this:
    A file named tokens.js in the parent directory of this file with the following content:
      module.exports = {
        "twitch-client-id": 'client-id', // Client ID from the twitch website in the developers section.
        "discord": 'token', // Client token from the discord website in the developers section.
        "api-client": 'token' // Set this to something random for incoming websocket connections that should be allowed to send messages through your discord bot.
      }
    Dependencies from npm:
      discord.js,
      ws,
      twitch-helix-api
    Highly recommended:
      Proxy the websocket server with SSL (nginx works well for me), or at the very least google the ws library and figure out how to implement SSL.
*/
const Discord = require('discord.js');
const dustforceDiscord = new Discord.Client();
const token = require('./../tokens')["dustforce-discord"];
const wsAPI = require('./websocket-api');
const twitch = require('./twitch-helix');
const replays = require('./replays');
const replayTools = require('./replayTools');
wsAPI.getStreams = twitch.getStreams;
class DustforceDiscordChannel {
  constructor (id, name) {
    this.id = id;
    this.name = name;
  }
  send (msg) {
    return new Promise ((resolve, reject) => {
      if (dustforceDiscord.ws.connection !== null && dustforceDiscord.status === 0) {
        let channel = dustforceDiscord.channels.get(this.id);
        if (typeof channel !== 'undefined') {
          resolve(channel.send(msg));
        } else {
          reject('Discord connection open, but ' + this.name + ' channel wasn\'t found.');
        }
      } else {
        reject('Discord connection not open. (Tried to send message to ' + this.name + ' channel)');
      }
    });
  }
}
const dustforceGeneralChannel = new DustforceDiscordChannel('276106941875355658', 'general');
const dustforceLeaderboardsChannel = new DustforceDiscordChannel('204159286966747136', 'leaderboard-updates');
setTimeout(() => {
  dustforceDiscord.login(token);
}, 5000);
twitch.on('dustforceStream', (stream) => {
  dustforceGeneralChannel.send('<' + stream.url + '> just went live: ' + stream.title).then((message) => {
    //console.log(message);
  }).catch((e) => {
    console.error(e);
  });
  wsAPI.pushEvent('streamAdded', stream);
});
twitch.on('dustforceStreamDeleted', (stream) => {
  wsAPI.pushEvent('dustforceStreamDeleted', stream);
});
dustforceDiscord.on('ready', () => {
  dustforceDiscord.user.setPresence({
    "status": 'online',
    "game": {
      "name": 'Dustforce'
    }
  });
});
function toWeirdCase (str) {
  return str.split('').map((v,i) => i % 2 ? v.toLowerCase() : v.toUpperCase()).join('');
}
dustforceDiscord.on('message', (message) => {
  if (message.channel.id === dustforceGeneralChannel.id && (message.content.toLowerCase() === '.streams' || message.content.toLowerCase() === '!streams')) {
    let streams = twitch.getStreams();
    let nobodyStreaming = 'Nobody is streaming.';
    let unknownStreaming = 'At least 1 person is streaming. I\'ll push notification(s) after I finish gathering data.';
    switch (message.content) {
      case '.STREAMS':
      case '!STREAMS':
        nobodyStreaming = 'NOBODY IS STREAMING!';
        unknownStreaming = unknownStreaming.toUpperCase();
      break;
      case '.sTrEaMs':
      case '!sTrEaMs':
      case '.StReAmS':
      case '!StReAmS':
        nobodyStreaming = toWeirdCase(nobodyStreaming);
        unknownStreaming = toWeirdCase(unknownStreaming);
      break;
      default:
        nobodyStreaming = 'Nobody is streaming.';
      break;
    }
    if (Object.keys(streams).length === 0) {
      message.channel.send(nobodyStreaming);
    } else {
      let streamsString = '';
      for (let stream of Object.keys(streams)) {
        let streamTitle = streams[stream]["title"];
        switch (message.content) {
          case '.STREAMS':
          case '!STREAMS':
            streamTitle = streams[stream]["title"].toUpperCase();
          break;
          case '.sTrEaMs':
          case '!sTrEaMs':
          case '.StReAmS':
          case '!StReAmS':
            streamTitle = toWeirdCase(streams[stream]["title"]);
          break;
          default:
            streamTitle = streams[stream]["title"];
          break;
        }
        if (typeof streams[stream]["login"] !== 'undefined') {
          streamsString += '<' + streams[stream]["url"] + '> - ' + streamTitle + '\n';
        }
      }
      if (streamsString === '') {
        message.channel.send(unknownStreaming);
      } else {
        streamsString = streamsString.slice(0, -1);
        message.channel.send(streamsString);
      }
    }
  }
  wsAPI.pushEvent('dustforceDiscordMessageAdd', {
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
dustforceDiscord.on('messageDelete', (message) => {
  wsAPI.pushEvent('dustforceDiscordMessageDelete', {
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
dustforceDiscord.on('messageReactionAdd', (reaction, user) => {
  if (reaction.message.channel.type === 'text') {
    wsAPI.pushEvent('dustforceDiscordReactionAdd', {
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
    wsAPI.pushEvent('dustforceDiscordReactionRemove', {
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
wsAPI.dustforceDiscord.generalSend = (msg) => {
  return dustforceGeneralChannel.send(msg);
}
replays.on('replay', (replay) => {
  wsAPI.pushEvent('dustforceReplay', replay);
  replay.character = Number(replay.character);
  if (typeof replayTools["level_thumbnails"][replay.level_name] !== 'undefined') {
    if (replay.score_rank_pb && replay.score_tied_with < 11) {
      let previous = '';
      if (typeof replay["previous_score_pb"] !== 'undefined') {
        previous = replay["previous_score_pb"];
      }
      createReplayMessage(replay, "Score", previous);
    }
    if (replay.time_rank_pb && replay.time_tied_with < 11) {
      let previous = '';
      if (typeof replay["previous_time_pb"] !== 'undefined') {
        previous = replay["previous_time_pb"];
      }
      createReplayMessage(replay, "Time", previous);
    }
  }
});
function createReplayMessage (replay, type, previous) {
  const lowercaseType = type.toLowerCase();
  const colors = [ 8493779, 12147535, 11829461, 9874791 ];
  const characterIcons = [ '401402235004911616', '401402216272887808', '401402223357329418', '401402248040546315' ];
  const camera = '[<:camera:401772771908255755>](http://dustkid.com/replay/' + replay.replay_id + ')';
  const usernameWrapper = '**[' + replay.username + '](http://dustkid.com/profile/' + replay.user_id + '/)**';
  const spaces = '       ';
  let x_way_tie = '';
  if (replay[lowercaseType + "_rank"] !== replay[lowercaseType + "_tied_with"]) {
    x_way_tie = (replay[lowercaseType + "_rank"] - replay[lowercaseType + "_tied_with"] + 1);
    x_way_tie = ' (' + way_tie.toString() + '-way tie)';
  }
  let previousTime = '';
  let previousRank = '';
  if (typeof previous === 'object') {
    //if (previous[lowercaseType + "_rank"] !== replay[lowercaseType + "_rank"]) {
      previousRank = ' _' + replayTools.rankToStr(previous[lowercaseType + "_rank"]) + '_  ->';
    //}
    //if (previous["time"] !== replay["time"]) {
      previousTime = ' _' + replayTools.parseTime(previous["time"]) + '_  ->';
    //}
  }
  let replayMessage = {
    "embed": {
      "color": colors[replay.character],
      "author": {
        "name": replay.level_clean_name + ' - ' + type,
        "url": 'http://dustkid.com/level/' + replay.level_name,
        "icon_url": "https://cdn.discordapp.com/emojis/" + characterIcons[replay.character] + ".png"
      },
      "thumbnail": {
        "url": "https://i.imgur.com/" + replayTools["level_thumbnails"][replay.level_name] + ".png"
      },
      "description": camera + ' ' + usernameWrapper + '\n' +
        spaces + replayTools.scoreToIcon(replay.completion) + previousRank + ' _' + replayTools.rankToStr(replay[lowercaseType + "_tied_with"]) + '_' + x_way_tie + '\n' +
        spaces + replayTools.scoreToIcon(replay.finesse) + previousTime + ' _' + replayTools.parseTime(replay.time) + '_',
      "footer": {
        "text": 'Date'
      },
      "timestamp": new Date(Number(replay.timestamp) * 1000)
    }
  };
  dustforceGeneralChannel.send(replayMessage);
}
