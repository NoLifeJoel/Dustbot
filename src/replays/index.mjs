import db from './../database/index.mjs';
import config from './../../config.json' with { type: 'json' };

export async function getReplay (replayID) {
	if (replayID === 0) return;
	let replaysTable = db.getSchema(config.mysql.schema).getTable('replays');
	let searchID = (replayID > 0) ? 'hitboxID' : 'dustkidID';
	replaysTable.select([
		'hitboxID',
		'dustkidID',
		'completion',
		'finesse',
		'user',
		'levelName',
		'characterID',
		'timestamp',
		'validated',
		'pluginID'
	]).where(`${searchID} = :num`)
		.limit(1)
		.bind('num', replayID)
		.execute()
	.then((result) => {
		result = result.fetchOne();
		if (typeof result === "undefined") {
			if (config.production) {
				return fetch(`https://dustkid.com/json/replay/${replayID}`, {
					"method": 'GET',
					"headers": {
						'User-Agent': `${config.userAgent}`
					}
				}).then((response) => {
					return response.json();
				}).then((replay) => {
					replay = replay.meta;
					return replay;
				});
			}
			if ([20].includes(replayID)) {
				//
			}
		}
	}).then((replay) => {
		console.log(replay);
	}).catch((error) => {
		console.error(error);
	});
}

getReplay(20);
