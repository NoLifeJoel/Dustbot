const { SlashCommandBuilder } = require('discord.js');

const { getStreams } = require('../twitch.js');

module.exports = {
  "data": new SlashCommandBuilder()
    .setName('streams')
    .setDescription('Fetches Dustforce streams from twitch.'),
  async execute (interaction) {
    let streams = getStreams();
    if (streams.length === 0) {
      await interaction.reply('Nobody is streaming.');
    } else {
      let streamText = '';
      for (let stream of streams) {
        if (streamText !== '') { streamText += '\n'; }
        streamText += '<' + stream.url + '> - ' + stream.title;
      }
      await interaction.reply(streamText);
    }
  }
}
