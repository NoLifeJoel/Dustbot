const discord = require('./discord');
const { newStream } = require('./twitch');
const config = require('./config.json');
const { getReplay, newReplay } = require('./replays');
const replayTools = require('./replayTools');
const Twit = require('twit');
const twitter = new Twit(config.twitter);

let mainChannel;
let leaderboardUpdatesChannel;

discord.once('ready', () => {
  leaderboardUpdatesChannel = discord.channels.cache.get(config.discord.channels['leaderboard-updates']);
  mainChannel = discord.channels.cache.get(config.discord.channels['dustforce']);
  
  newStream.on('stream', (stream) => {
    mainChannel.sendTyping();
    mainChannel.send('<' + stream.url + '> just went live: ' + stream.title).then((message) => {
      //console.log(message);
    }).catch((e) => {
      console.error(e);
    });
  });

  newReplay.on('replay', (replay) => {
    //console.log(replay.rid);
    for (let [key, value] of Object.entries(replay.dustbot)) {
      switch (key) {
        case 'char_score':
          if ((typeof replay.dustbot['score'] === 'undefined' || replay.dustbot.score.WR === false) && value.WR && replay.rank_char_score_ties === 0)
            createDiscordMessage(replay, 'Score', false, 'char');
        break;
        case 'char_time':
          if ((typeof replay.dustbot['time'] === 'undefined' || replay.dustbot.time.WR === false) && value.WR && replay.rank_char_time_ties === 0)
            createDiscordMessage(replay, 'Time', false, 'char');
        break;
        case 'score':
          if (value.top10) createDiscordMessage(replay, 'Score', false, 'all');
          if (value.firstSS) createDiscordMessage(replay, 'Score', true, 'all');
          if (value.WR && replay['rank_all_score_ties'] === 0) createTwitterMessage(replay, 'Score');
        break;
        case 'time':
          if (value.top10) createDiscordMessage(replay, 'Time', false, 'all');
          if (value.WR && replay['rank_all_time_ties'] === 0) createTwitterMessage(replay, 'Time');
        break;
      }
    }
  });
});

function createDiscordMessage (replay, type, firstSS, char) {
  const lowercaseType = type.toLowerCase();
  const colors = [ 8493779, 12147535, 11829461, 9874791 ];
  const camera = '[<:camera:401772771908255755>](https://dustkid.com/replay/' + replay.replay_id + ')';
  const characterIcons = [ '401402235004911616', '401402216272887808', '401402223357329418', '401402248040546315' ];
  const usernameWrapper = '**[' + replay.username + '](https://dustkid.com/profile/' + replay.user + '/)**';
  const spacing = '\n       ';
  let x_way_tie = '';
  let previousTime = '';
  let previousRank = '';
  if (typeof replay.dustbot[(char === 'char' ? 'char_' : '') + lowercaseType] === 'object') {
    previousRank = ' _' + replayTools.rankToStr(replay.dustbot[(char === 'char' ? 'char_' : '') + lowercaseType].previous_rank - 1) + '_  ->';
    previousTime = ' _' + replayTools.parseTime(replay.dustbot[(char === 'char' ? 'char_' : '') + lowercaseType].previous_time) + '_  ->';
  }
  if (replay['rank_' + char + '_' + lowercaseType + '_ties'] !== 0)
    x_way_tie = ' (' + (replay['rank_' + char + '_' + lowercaseType + '_ties'] + 1).toString() + '-way tie)';
  if (firstSS) type = 'First SS';
  let replayMessage = {
    "color": colors[replay.character], // The color of the left of the embed.
    "author": {
      "name": replay.levelname + ' - ' + (char === 'char' ? 'Char ' : '') + type, // Ex. Downhill - Char Score
      "url": 'https://dustkid.com/level/' + encodeURIComponent(replay.level), // Level link
      "icon_url": "https://cdn.discordapp.com/emojis/" + characterIcons[replay.character] + ".png" // Character icon
    },
    "thumbnail": {
      "url": "https://i.imgur.com/" + replayTools["level_thumbnails"][replay.level] + ".png" // Level thumbnail
    },
    "description": camera + ' ' + usernameWrapper + spacing + // [Camera icon] Username
      replayTools.scoreToIcon(replay.score_completion) + previousRank + ' _' + replayTools.rankToStr(replay['rank_' + char + '_' + lowercaseType] + 1) + '_' + x_way_tie + spacing + // [S] Previous rank -> New rank
      replayTools.scoreToIcon(replay.score_finesse) + previousTime + ' _' + replayTools.parseTime(replay.time) + '_', // [S] Previous time -> New time
    "footer": {
      "text": 'Date'
    },
    "timestamp": new Date(Number(replay.timestamp) * 1000)
  };
  leaderboardUpdatesChannel.sendTyping();
  leaderboardUpdatesChannel.send({"embeds": [replayMessage]}).then((message) => {
    return;
  }).catch((err) => {
    console.error(err);
    console.error(replay);
    return;
  });
}

function createTwitterMessage (replay, type) {
  let previous_second = replay.dustbot[type.toLowerCase()].previous_wr;
  let improvedBy = Number(previous_second["time"]) - Number(replay["time"]);
  let message = '';
  let date = new Date(Number(replay.timestamp) * 1000);
  date = date.toDateString();
  if (previous_second.user === replay.user) {
    if (Number(replay["time"]) < Number(previous_second["time"])) {
      message = replay.username + ' improved ' + replay.levelname + ' (' + type + ') by ' + replayTools.parseTime(improvedBy) +
        ' seconds with a time of ' + replayTools.parseTime(replay.time) + ', score ' + replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    } else {
      message = replay.username + ' improved ' + replay.levelname + ' (' + type + ') by getting a higher score with a time of ' + replayTools.parseTime(replay.time) +
        ', score ' + replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) + 
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    }
  } else {
    if (Number(replay["time"]) < Number(previous_second["time"])) {
      message = replay.username + ' beat ' + previous_second.username + ' on ' + replay.levelname + ' (' + type + ') by ' + replayTools.parseTime(improvedBy) + ' seconds with a time of ' +
        replayTools.parseTime(replay.time) + ', score ' + replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    } else {
      message = replay.username + ' beat ' + previous_second.username + ' on ' + replay.levelname + ' (' + type + ') by getting a higher score with a time of ' + replayTools.parseTime(replay.time) + ', score ' + 
        replayTools.scoreToLetter(replay.score_completion) + replayTools.scoreToLetter(replay.score_finesse) +
        ' as ' + replayTools.characterToString(replay.character) + ' / ' + date + ' #Dustforce';
    }
  }
  twitter.post('statuses/update', { "status": message }, (err, data, response) => {
    if (err) {
      console.error(err);
    }
  });
}
