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

client.login(config.discord.token);
