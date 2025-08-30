const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("countdown")
    .setDescription("Count down timer to start races - ends with a \"GO!\" message.")
    .addIntegerOption(option => option.setName("seconds")
      .setMinValue(3)
      .setMaxValue(10)
      .setDescription("Default is 3 seconds - min. 3, max. 10")),

  async execute(interaction) {
    const { channel, options } = interaction;

    const seconds = options.getInteger("seconds") || 3;

    const sleep = ms => new Promise(resolve => setTimeout(() => resolve(), ms));

    await interaction.reply("Countdown initiated... Race starts on \"GO!\"");
    channel.sendTyping();

    await sleep(2000);

    for (let i = seconds; i >= 0; i--) {
      if (i > 0) {
        await channel.send(`${i}`);
        await sleep(1000);
      }
      else {
        await channel.send("GO!");
      }
    }
  },

  channels: ["races", "rma-bracket"],
};
