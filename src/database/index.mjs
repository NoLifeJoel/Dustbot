import mysqlx from '@mysql/xdevapi';
import config from './../../config.json' with { type: 'json' };

let session = await mysqlx.getSession({
	"host": config.mysql.host,
	"user": config.mysql.user,
	"password": config.mysql.password,
	"schema": config.mysql.schema
});

await session.sql(`CREATE TABLE IF NOT EXISTS replays(
	dustkidID INT PRIMARY KEY,
	hitboxID INT DEFAULT 0,
	completion TINYINT NOT NULL,
	finesse TINYINT NOT NULL,
	user INT NOT NULL,
	levelName VARCHAR(64) NOT NULL,
	levelID INT NOT NULL,
	characterID TINYINT NOT NULL,
	timestamp INT NOT NULL,
	validated TINYINT NOT NULL,
	dustkid TINYINT DEFAULT 1,
	pluginID SMALLINT,
	input_jumps MEDIUMINT NOT NULL,
	input_dashes MEDIUMINT NOT NULL,
	input_lights MEDIUMINT NOT NULL,
	input_heavies MEDIUMINT NOT NULL,
	input_super MEDIUMINT NOT NULL,
	input_directions MEDIUMINT NOT NULL,
	num_players TINYINT NOT NULL,
	pb TINYINT(1) DEFAULT 0,
	UNIQUE (hitboxID)
)`).execute();

await session.sql(`CREATE TABLE IF NOT EXISTS levels(
	id INT PRIMARY KEY,
	name VARCHAR(64),
	clean_name VARCHAR(64),
	hxID INT
)`).execute();

await session.sql(`CREATE TABLE IF NOT EXISTS users(
	id INT PRIMARY KEY,
	name VARCHAR(64)
)`).execute();

export default session;
