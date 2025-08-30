const path = require("path");

global.__root = path.join(__dirname, "..");

// require the Discord index.cjs first, as it sets up the client
require("./discord/index.cjs");

require("./replays/index.cjs");
require("./twitch/index.cjs");
require("./new-map-releases/index.cjs");
