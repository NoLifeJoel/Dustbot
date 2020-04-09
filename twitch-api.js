const request = require('./request');
const querystring = require('querystring');
const fs = require('./filesystem');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8')).twitch;
let token_timer = 0;
let token_valid = false;
function writeToken (newToken) {
	console.log('Writing new token to config.');
	config.client_token = newToken;
	fs.readFile('config.js', 'utf-8').then((data) => {
		data = JSON.parse(data);
		if (typeof data === 'object') {
			data.twitch.client_token = newToken;
			JSON.stringify(data, null, 2);
			fs.writeFile('config.json', data, 'utf-8').catch((e) => {
				console.error(e);
			});
		}
	})
}
function apiRequest (path, query) {
	query = querystring.stringify(query);
	return request({
		"host": 'api.twitch.tv',
		"path": '/helix/' + path + '?' + query,
		"method": 'GET',
		"headers": {
			"Authorization": 'Bearer ' + config.client_token
		},
		"special": {
			"https": true
		}
	});
}
function getToken () {
	return request({
		"host": 'id.twitch.tv',
		"method": 'POST',
		"path": '/oauth2/token?' + querystring.stringify({
			"client_id": config.client_id,
			"client_secret": config.client_secret,
			"grant_type": 'client_credentials'
		}),
		"special": {
			"https": true
		}
	}).then((response) => {
		let res = JSON.parse(response.data);
		token_timer = res.expires_in;
		console.log('A new token has been fetched, it expires in ' + res.expires_in + ' seconds.');
		token_valid = true;
		return res.access_token;
	});
}
function validateToken (token) {
	return request({
		"host": 'id.twitch.tv',
		"path": '/oauth2/validate',
		"special": {
			"https": true
		},
		"headers": {
			"Authorization": 'OAuth ' + config.client_token
		}
	}).then((response) => {
		let res = JSON.parse(response.data);
		if ((res.hasOwnProperty('status') && res.status === 401) || res.expires_in < 1800) {
			console.log('Token invalid or about to expire, fetching a new one...');
			token_valid = false;
			return true;
		} else {
			console.log('Current token passed validation check.');
			token_valid = true;
			token_timer = res.expires_in;
		}
	}).then((fetchToken) => {
		if (fetchToken === true) {
			return getToken();
		}
	});
}
function tokenLoop () {
	if (typeof config.client_token !== 'string') {
		console.log('twitch.client_token in config.js is not a string, fetching a new one...');
		getToken().then(() => {
			setTimeout(tokenLoop, 1200000);
		});
	} else {
		validateToken(config.client_token).then(() => {
			setTimeout(tokenLoop, 1200000);
		});
	}
}
setTimeout(tokenLoop, 5000);
function getUsers (data) {
	return new Promise((resolve, reject) => {
		if (typeof data === 'undefined' || (typeof data.id === 'undefined' && typeof data.login === 'undefined')) {
			reject('You must specify user id(s) or username(s) as a string or an array.');
		} else if ((Array.isArray(data.id) && data.id.length > 100) || (Array.isArray(data.login) && data.login.length > 100)) {
			reject('You specified too many user ids or usernames.');
		} else {
			let query = { };
			if (typeof data.login !== 'undefined') query.login = data.login;
			if (typeof data.id !== 'undefined') query.id = data.id;
			apiRequest('users', query).then((response) => {
				resolve(JSON.parse(response.data));
			});
		}
	});
}
function getStreams (data) {
	return new Promise((resolve, reject) => {
		if (typeof data === 'undefined' || (typeof data.game_id === 'undefined' && typeof data.user_id === 'undefined')) {
			reject('You must specify game id(s) or user id(s) as a string or an array.');
		} else if ((Array.isArray(data.game_id) && data.game_id.length > 100) || (Array.isArray(data.user_id) && data.user_id.length > 100)) {
			reject('You specified too many game ids or user ids.');
		} else {
			let query = { };
			if (typeof data.game_id !== 'undefined') query.game_id = data.game_id;
			if (typeof data.user_id !== 'undefined') query.user_id = data.user_id;
			if (typeof data.type !== 'undefined') query.type = data.type;
			apiRequest('streams', query).then((response) => {
				resolve(JSON.parse(response.data));
			});
		}
	});
}
module.exports = {
	"users": {
		"getUsers": getUsers
	},
	"streams": {
		"getStreams": getStreams
	}
}
