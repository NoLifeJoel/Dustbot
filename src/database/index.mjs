import mysqlx from '@mysql/xdevapi';
import config from './../../config.json' with { type: 'json' };

let session = await mysqlx.getSession({
	"host": config.mysql.host,
	"user": config.mysql.user,
	"password": config.mysql.password
});

await session.sql(`CREATE TABLE IF NOT EXISTS dustbot.replays(
	dustkidID INT PRIMARY KEY,
	hitboxID INT,
	completion TINYINT,
	finesse TINYINT,
	user INT,
	levelName VARCHAR(64),
	characterID TINYINT,
	timestamp INT,
	validated TINYINT,
	dustkid TINYINT,
	pluginID SMALLINT,
	input_jumps MEDIUMINT,
	input_dashes MEDIUMINT,
	input_lights MEDIUMINT,
	input_heavies MEDIUMINT,
	input_super MEDIUMINT,
	input_directions MEDIUMINT,
	num_players TINYINT,
	pb TINYINT(1)
)`).execute();

await session.sql(`CREATE TABLE IF NOT EXISTS dustbot.levels(
	id INT PRIMARY KEY,
	name VARCHAR(64),
	clean_name VARCHAR(64)
)`).execute();

await session.sql(`CREATE TABLE IF NOT EXISTS dustbot.users(
	id INT PRIMARY KEY,
	name VARCHAR(64)
)`).execute();

export default session;
