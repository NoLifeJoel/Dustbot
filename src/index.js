const path = require("path");

global.__root = path.join(__dirname, "..");

// require the Discord index.js first, as it sets up the client
require("./discord/index.js");

require("./replays/index.js");
require("./twitch/index.js");
require("./new-map-releases/index.js");
