/*
  Requirements for running this:
    Copy `config.example.json` -> `config.json`, and update the values within.
      
    Dependencies from npm:
      discord.js, twit
*/
const { Client, Intents } = require('discord.js');
const client = new Client({
  "intents": [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES
  ]
});
const config = require('./config.json');
const auto_verify = config.auto_verify;
const twitter_credentials = config.twitter;
const twitch = require('./twitch-helix');
const replays = require('./replays');
const replayTools = require('./replayTools');
const request = require('./request');
const querystring = require('querystring');
const Twit = require('twit');
const twitter = new Twit(twitter_credentials);
class DiscordChannel {
  constructor (id) {
    this.id = id;
  }
  send (msg) {
    return new Promise ((resolve, reject) => {
      if (client.ws.connection !== null && client.ws.status === 0) {
        let channel = client.channels.cache.get(this.id);
        if (typeof channel !== 'undefined') {
          resolve(channel.send(msg));
        } else {
          reject('Discord connection open, but ' + this.id + ' channel wasn\'t found.');
        }
      } else {
        reject('Discord connection not open. (Tried to send message to ' + this.id + ' channel)');
      }
    });
  }
  sendTyping () {
    if (client.ws.connection !== null && client.ws.status === 0) {
      let channel = client.channels.cache.get(this.id);
      if (typeof channel !== 'undefined') {
        channel.sendTyping();
      } else {
        //console.log('Discord connection open, but ' + this.id + ' channel wasn\'t found.');
      }
    } else {
      //console.log('Discord connection not open. (Tried to send typing to ' + this.id + ' channel)');
    }
  }
}
const dustforceChannel = new DiscordChannel(config.channels.dustforce);
const leaderboardUpdatesChannel = new DiscordChannel(config.channels.leaderboardUpdates);
const holdingChannel = new DiscordChannel(config.channels.holding);
const mapmakingChannel = new DiscordChannel(config.channels.mapmaking);
const tasforceChannel = new DiscordChannel(config.channels.tasforce);
const racesChannel = new DiscordChannel(config.channels.races);
const modChannel = new DiscordChannel(config.channels.modChannel);
const rulesInfoChannel = new DiscordChannel(config.channels["rules-info"]);
setTimeout(() => {
  client.login(config.discord.token);
}, 5000);
twitch.on('dustforceStream', (stream) => {
  dustforceChannel.sendTyping();
  dustforceChannel.send('<' + stream.url + '> just went live: ' + stream.title).then((message) => {
    //console.log(message);
  }).catch((e) => {
    console.error(e);
  });
});
client.on('ready', () => {
  client.user.setPresence({
    "status": 'online',
    "activities": [{
      "type": 'PLAYING',
      "name": 'Dustforce'
    }]
  });
});
function uwu (str) {
  str = str.replace(/r|l/gi, (match) => {
    if (match === 'r' || match === 'l') return 'w';
    if (match === 'R' || match === 'L') return 'W';
  });
  if (Math.round(Math.random())) {
    str = str + ' owo';
  } else {
    str = str + ' uwu';
  }
  return str;
}
function toWeirdCase (pattern, str) {
  const length = pattern.length;
  return str.split('').map((v, i) => {
    const offset = 1;
    const character = pattern[(i % (length - offset)) + offset];
    if (character === character.toLowerCase()) {
      return v.toLowerCase();
    }
    return v.toUpperCase();
  }).join('');
}
function toStrimFormat(message) {
  return message.replace(/st(r|w)eam/i, "st$1im").replace(/st(r|w)iming/i, "st$1imming");
}
let holdingRole = null;
client.on('guildMemberAdd', (member) => {
  if (member.guild.id === '83037671227658240') {
    if (holdingRole === null) {
      holdingRole = member.guild.roles.cache.find((role) => role.name === 'holding');
    }
    if (auto_verify.indexOf(member.id) === -1) {
      member.roles.add(holdingRole);
      holdingChannel.send('<@' + member.id + '> type !verify to see the other channels. This is an anti-bot measure.');
    }
  }
});
client.on('messageCreate', (message) => {
  let streamCommandRegex = /^(\.|!)(st(r|w)(ea|i)ms)$/i;
  let stweamCommandRegex = /^(\.|!)(stw(ea|i)ms)$/i;
  let strimCommandRegex = /^(\.|!)(st(r|w)ims)$/i;
  let streamNotCased = /^(\.|!)(st(r|w)(ea|i)ms)$/;
  if (message.channel.id === holdingChannel.id) {
    if (holdingRole === null) {
      holdingRole = message.member.guild.roles.cache.find((role) => role.name === 'holding');
    }
    if (message.content === '!verify' && message.member.roles.cache.has(holdingRole.id)) {
      message.member.roles.remove(holdingRole);
    }
  }
  if (message.channel.id === dustforceChannel.id) {
    if (streamCommandRegex.test(message.content)) {
      message.channel.sendTyping();
      let applyWeirdCase = !streamNotCased.test(message.content);
      let applyStrimFormat = strimCommandRegex.test(message.content);
      let streams = twitch.getStreams();
      let nobodyStreaming = 'Nobody is streaming.';
      let unknownStreaming = 'At least 1 person is streaming. I\'ll push notification(s) after I finish gathering data.';
      if (Object.keys(streams).length === 0) {
        if (stweamCommandRegex.test(message.content)) {
          nobodyStreaming = uwu(nobodyStreaming);
        }
        if (applyStrimFormat) {
          nobodyStreaming = toStrimFormat(nobodyStreaming);
        }
        if (applyWeirdCase) {
          nobodyStreaming = toWeirdCase(message.content, nobodyStreaming);
        }
        message.channel.send(nobodyStreaming);
      } else {
        let streamsString = '';
        for (let stream of Object.keys(streams)) {
          let streamTitle = streams[stream]["title"];
          if (stweamCommandRegex.test(message.content)) {
            streamTitle = uwu(streamTitle);
          }
          if (applyStrimFormat) {
            streamTitle = toStrimFormat(streamTitle);
          }
          if (applyWeirdCase) {
            streamTitle = toWeirdCase(message.content, streamTitle);
          }
          if (typeof streams[stream]["login"] !== 'undefined') {
            streamTitle = streamTitle.replace(/\\(\*|@|<|>|:|_|`|~|\\)/g, '$1').replace(/(\*|@|<|>|:|_|`|~|\\)/g, '\\$1');
            streamsString += '<' + streams[stream]["url"] + '> - ' + streamTitle + '\n';
          }
        }
        if (streamsString === '') {
          if (stweamCommandRegex.test(message.content)) {
            unknownStreaming = uwu(unknownStreaming);
          }
          if (applyStrimFormat) {
            unknownStreaming = toStrimFormat(unknownStreaming);
          }
          if (applyWeirdCase) {
            unknownStreaming = toWeirdCase(message.content, unknownStreaming);
          }
          message.channel.send(unknownStreaming);
        } else {
          streamsString = streamsString.slice(0, -1);
          message.channel.send(streamsString);
        }
      }
    }
  }
  if (message.channel.id === modChannel.id) {
    if (message.content.indexOf('!twitchban ') === 0) {
      let username = message.content.substring(11).replace(/[^0-9a-z]/gi, '');
      if (username !== '') {
        twitch.banStream(username);
      }
    }
    if (message.content === '!bannedStreams') {
      message.channel.send(JSON.stringify(twitch.getBannedStreams(), null, 2));
    }
    if (message.content.indexOf('!rulesMessage\n') === 0) {
      let messageContent = message.content.substring(14);
      if (messageContent.length > 5) {
        rulesInfoChannel.send(messageContent);
      }
    }
  }
  if (message.channel.id === dustforceChannel.id || message.channel.id === racesChannel.id || message.channel.id === tasforceChannel.id || message.channel.id === mapmakingChannel.id) {
    let noThumbnailRegex = /^(\.|!)(nt)$/i;
    if (message.content.indexOf('dustkid.com/replay/') !== -1 && !noThumbnailRegex.test(message.content.split(/ |\n/)[0])) {
      let replay_id = Number(message.content.split('dustkid.com/replay/')[1].split(/ |\n/)[0].replace(/[^0-9\-]/g, ''));
      if (typeof replay_id === 'number' && !isNaN(replay_id)) {
        let responseCounter = 0;
        message.channel.sendTyping();
        request({
          "host": 'dustkid.com',
          "path": '/replayviewer.php?' + querystring.stringify({
            "replay_id": replay_id,
            "json": true,
            "metaonly": true
          })
        }).then((response) => {
          if (responseCounter > 0) {
            console.log('Multiple response counter: ' + responseCounter);
            return;
          }
          responseCounter++;
          let replay = JSON.parse(response.data);
          if (!replay) {
            return;
          }
          let tags = '';
          if (!Array.isArray(replay.tag)) {
            if (typeof replay.tag.version === 'string') {
              //tags = '\nDustmod version: ' + replay.tag.version;
            }
            if (typeof replay.tag.mode === 'string' && replay.tag.mode !== '') {
              tags = '\nMode: ' + replay.tag.mode;
            }
          }
          const usernameWrapper = '**[' + replay.username + '](http://dustkid.com/profile/' + replay.user + '/)**';
          const camera = '[<:camera:401772771908255755>](http://dustkid.com/replay/' + replay.replay_id + ')';
          let tas = '';
          let ranks = '';
          if (replay.validated === -5) {
            tas = ' - [TAS]'
          } else if (replay.rank_all_time !== false && replay.rank_all_score !== false) {
            let time_ties = '';
            let score_ties = '';
            if (replay.rank_all_score_ties > 0) {
              score_ties = ' (' + (replay.rank_all_score_ties + 1) + '-way tie)';
            }
            if (replay.rank_all_time_ties > 0) {
              time_ties = ' (' + (replay.rank_all_time_ties + 1) + '-way tie)';
            }
            ranks = 'Score Rank: ' + replayTools.rankToStr(replay.rank_all_score + 1) + score_ties + '\n' +
                    'Time Rank: '  + replayTools.rankToStr(replay.rank_all_time  + 1) + time_ties  + '\n';
          }
          let replayMessage = {
            "author": {
              "name": replay.levelname,
              "url": 'http://dustkid.com/level/' + encodeURIComponent(replay.level),
              "icon_url": 'https://cdn.discordapp.com/emojis/' + replayTools.characterIcons(replay.character) + '.png'
            },
            "description": camera + ' ' + usernameWrapper + tas + '\n' +
              'Score: ' + replayTools.scoreToIcon(replay.score_completion) + replayTools.scoreToIcon(replay.score_finesse) + '\n' +
              'Time: ' + replayTools.parseTime(replay.time) + '\n' + ranks +
              '<:apple:230164613424087041> ' + replay.apples + tags,
            "footer": {
              "text": 'Date'
            },
            "timestamp": new Date(Number(replay.timestamp) * 1000)
          };
          let messageSendCounter = 0;
          message.channel.send({"embeds":[replayMessage]}).then((message) => {
            if (messageSendCounter > 0) {
              console.log('messageSendCounter: ' + messageSendCounter);
              messageSendCounter++;
            }
            return;
          }).catch((e) => {
            console.error(e);
            return;
          });
        }).catch((e) => {
          console.error(e);
        });
      }
    }
  }
});
client.on('messageDelete', (message) => {
  //
});
client.on('messageReactionAdd', (reaction, user) => {
  //
});
replays.on('replay', (replay) => {
  console.log(replay.replay_id);
  replay.character = Number(replay.character);
  if (typeof replayTools["level_thumbnails"][replay.level_name] !== 'undefined') {
    if ((replay.level_name === 'yottadifficult' || replay.level_name === 'exec func ruin user') && (typeof replay["previous_score_pb"] === 'undefined' || Number(replay["previous_score_pb"].score) !== 1285) && Number(replay.score) === 1285) {
      let previous = '';
      if (typeof replay["previous_score_pb"] !== 'undefined') {
        previous = replay["previous_score_pb"];
      }
      leaderboardUpdatesChannel.sendTyping();
      createReplayMessage(replay, "Score", previous, true);
    }
    if (replay.score_rank_pb && replay.score_tied_with < 11) {
      let previous = '';
      if (typeof replay["previous_score_pb"] !== 'undefined') {
        previous = replay["previous_score_pb"];
      }
      leaderboardUpdatesChannel.sendTyping();
      createReplayMessage(replay, "Score", previous, false);
    }
    if (replay.time_rank_pb && replay.time_tied_with < 11) {
      let previous = '';
      if (typeof replay["previous_time_pb"] !== 'undefined') {
        previous = replay["previous_time_pb"];
      }
      leaderboardUpdatesChannel.sendTyping();
      createReplayMessage(replay, "Time", previous, false);
    }
  }
});
function createReplayMessage (replay, type, previous, firstSS) {
  if (Number(replay.user_id) === 0 || Number(replay.user_id) === 1 || Number(replay.user_id) === 19998) return; // [not logged in], Anonymous, guest
  const lowercaseType = type.toLowerCase();
  const colors = [ 8493779, 12147535, 11829461, 9874791 ];
  const characterIcons = [ '401402235004911616', '401402216272887808', '401402223357329418', '401402248040546315' ];
  const camera = '[<:camera:401772771908255755>](http://dustkid.com/replay/' + replay.replay_id + ')';
  const usernameWrapper = '**[' + replay.username + '](http://dustkid.com/profile/' + replay.user_id + '/)**';
  const spaces = '       ';
  let x_way_tie = '';
  if (replay[lowercaseType + "_rank"] !== replay[lowercaseType + "_tied_with"]) {
    x_way_tie = (replay[lowercaseType + "_rank"] - replay[lowercaseType + "_tied_with"] + 1);
    x_way_tie = ' (' + x_way_tie.toString() + '-way tie)';
  }
  let previousTime = '';
  let previousRank = '';
  if (typeof previous === 'object') {
    previousRank = ' _' + replayTools.rankToStr(previous[lowercaseType + "_rank"]) + '_  ->';
    previousTime = ' _' + replayTools.parseTime(previous["time"]) + '_  ->';
  }
  if (x_way_tie === '' && Number(replay[lowercaseType + "_tied_with"]) === 1) {
    request({
      "host": 'df.hitboxteam.com',
      "path": '/backend6/scores.php?' + querystring.stringify({
        "level": replay.level_name,
        "max": 1,
        "offset": 1
      })
    }).then((response) => {
      let second_place = JSON.parse(response.data)["best_" + lowercaseType + "s"][0];
      let previous_second = second_place;
      second_place.finesse = replayTools.letterToScore(second_place.score_finesse);
      second_place.completion = replayTools.letterToScore(second_place.score_thoroughness);
      let second_place_score = second_place.finesse + second_place.completion;
      let previous_score = previous.finesse + previous.completion;
      if (typeof previous === 'object') {
        if (lowercaseType === 'time') {
          if ((Number(previous["time"]) < Number(second_place["time"])) ||
            (Number(previous["time"]) === Number(second_place["time"]) && previous_score < second_place_score) ||
            (Number(previous["time"]) === Number(second_place["time"]) && previous_score === second_place_score && Number(previous["timestamp"]) < Number(second_place["timestamp"]))
          ) {
            previous_second = previous;
          }
        }
        if (lowercaseType === 'score') {
          if (previous_score < second_place_score || 
            (previous_score === second_place_score && Number(previous["time"]) < Number(previous_second["time"])) || 
            (previous_score === second_place_score && Number(previous["time"]) === Number(previous_second["time"]) && Number(previous["timestamp"]) < Number(second_place["timestamp"]))
          ) {
            previous_second = previous;
          }
        }
      }
      let improvedBy = Number(previous_second["time"]) - Number(replay["time"]);
      let message = '';
      let date = new Date(Number(replay.timestamp) * 1000);
      date = date.toDateString();
      if (Number(previous_second["user_id"]) === Number(replay["user_id"])) {
        if (Number(replay["time"]) < Number(previous_second["time"])) {
          message = replay.username + ' improved ' + replay.level_clean_name + ' (' + type + ') by ' + replayTools.parseTime(improvedBy) +
            ' seconds with a time of ' + replayTools.parseTime(replay.time) + ', score ' + replayTools.scoreToLetter(replay.completion) + replayTools.scoreToLetter(replay.finesse) +
            ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
        } else {
          message = replay.username + ' improved ' + replay.level_clean_name + ' (' + type + ') by getting a higher score with a time of ' + replayTools.parseTime(replay.time) +
            ', score ' + replayTools.scoreToLetter(replay.completion) + replayTools.scoreToLetter(replay.finesse) + ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
        }
      } else {
        if (Number(replay["time"]) < Number(previous_second["time"])) {
          message = replay.username + ' beat ' + previous_second.name + ' on ' + replay.level_clean_name + ' (' + type + ') by ' + replayTools.parseTime(improvedBy) + ' seconds with a time of ' +
            replayTools.parseTime(replay.time) + ', score ' + replayTools.scoreToLetter(replay.completion) + replayTools.scoreToLetter(replay.finesse) + ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
        } else {
          message = replay.username + ' beat ' + previous_second.name + ' on ' + replay.level_clean_name + ' (' + type + ') by getting a higher score with a time of ' + replayTools.parseTime(replay.time) + ', score ' + 
            replayTools.scoreToLetter(replay.completion) + replayTools.scoreToLetter(replay.finesse) + ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
        }
      }
      twitter.post('statuses/update', { "status": message }, (err, data, response) => {
        if (err) {
          console.error(err);
        }
      });
    }).catch((err) => {
      console.error(err);
    });
  }
  if (firstSS) {
    type = 'First SS';
  }
  let replayMessage = {
    "color": colors[replay.character],
    "author": {
      "name": replay.level_clean_name + ' - ' + type,
      "url": 'http://dustkid.com/level/' + encodeURIComponent(replay.level_name),
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
  };
  leaderboardUpdatesChannel.send({"embeds": [replayMessage]}).then((message) => {
    return;
  }).catch((err) => {
    console.error(err);
    return;
  });
}
