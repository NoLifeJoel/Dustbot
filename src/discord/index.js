const fs = require("fs");

const { Collection, Routes, REST, InteractionType, ActivityType } = require("discord.js");

const config = require(`${global.__root}/config.json`);
const { discord: { token, clientId, channels }, autoVerify } = config;

const client = require("./client.js");

// set the bot's status to online, and the game it's playing to Dustforce
client.once("ready", function setPlaying() {
  client.user.setPresence({
    "status": "online",
    "activities": [{
      "type": ActivityType.Playing,
      "name": "Dustforce",
    }],
  });
  setTimeout(setPlaying, 5 * 60 * 1000);
});

// initialize commands
const commands = [];
client.commands = new Collection();
const commandFiles = fs.readdirSync(`${__dirname}/commands`).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(clientId),
      { "body": commands },
    );
  }
  catch (error) {
    console.error(error);
  }
})();

// listen to slash commands (i.e. Discord "interactions")
client.on("interactionCreate", async (interaction) => {
  if (!interaction.type === InteractionType.ApplicationCommand) {
    return;
  }

  const { commandName: command } = interaction;
  if (!client.commands.has(command)) {
    return;
  }

  if (interaction.channelId !== channels["bot"] && interaction.channelId !== channels["bot-testing"]) {
    return;
  }

  try {
    await client.commands.get(command).execute(interaction);
  }
  catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

// put new server members into the "holding" channel, and require them to type
// "!verify", as an anti-bot measure
client.on("guildMemberAdd", async (member) => {
  if (member.guild.id === "83037671227658240") {
    const holdingRole = member.guild.roles.cache.find((role) => role.name === "holding");
    if (autoVerify.indexOf(member.id) === -1) {
      const holdingChannel = member.guild.channels.cache.get(channels["holding"]);
      member.roles.add(holdingRole);
      holdingChannel.send(`<@${member.id}> type !verify to see the other channels. This is an anti-bot measure.`);
    }
  }
});

client.login(token);

require("./messages.js");
