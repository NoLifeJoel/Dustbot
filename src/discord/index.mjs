import { Client, Events, GatewayIntentBits, ActivityType } from 'discord.js';

import config from './../../config.json' with { type: 'json' };

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

client.on(Events.ClientReady, (readyClient) => {
	readyClient.user.setPresence({
		"status": "online",
		"activities": [{
			"type": ActivityType.Playing,
			"name": "Dustforce"
		}],
	});
});

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;
	if (message.content.indexOf("dustkid.com/replay/") !== -1) {
		const replayId = Number(message.content.split("dustkid.com/replay/")[1].split(/ |\n/)[0].replace(/[^0-9-]/g, ""));
		if (typeof replayId === "number" && !isNaN(replayId)) {
			// TODO: Check if replay exists in DB, and if so don't fetch from Dustkid.
			// Ideally all the logic for fetching a replay from db/dustkid should be in a replays module.
		}
	}
});

client.login(config.discord.token);
