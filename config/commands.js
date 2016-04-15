var config = require("./config.json");
var games = require("./games.json").games;
var version = require("../package.json").version;
var colors = require("./styles.js");
var request = require("request");
var xml2js = require("xml2js");
var osuapi = require("osu-api");
var ent = require("entities");
var waifus = require("./waifus.json");
var gbagames = require("./gbagames.json").gbagames;

var VoteDB = {}
	,LottoDB = {}
	,Ratings = {};
const IMGUR_CLIENT_ID = (config.use_env) ? process.env.IMGUR_CLIENT_ID: config.imgur_client_id;
const OSU_API_KEY = (config.use_env) ? process.env.osu_api_key : config.osu_api_key;
const OWM_API_KEY = (config.use_env) ? process.env.weather_api_key : config.weather_api_key;
const MAL_USER = (config.use_env) ? process.env.mal_user : config.mal_user;
const MAL_PASS = (config.use_env) ? process.env.mal_pass : config.mal_pass;

/*====================
Functions
====================*/

function correctUsage(cmd) {
	return (commands.hasOwnProperty(cmd)) ? "Usage: `" + config.command_prefix + "" + cmd + " " + commands[cmd].usage + "`": "This should display the correct usage but the bot maker made a mistake";
}

function findUser(members, query) {
	var usr = members.find((member) => { return (member === undefined || member.username == undefined) ? false : member.username.toLowerCase() == query.toLowerCase() });
	if (!usr) { usr = members.find((member) => { return (member === undefined || member.username == undefined) ? false : member.username.toLowerCase().indexOf(query.toLowerCase()) == 0 }); }
	if (!usr) { usr = members.find((member) => { return (member === undefined || member.username == undefined) ? false : member.username.toLowerCase().indexOf(query.toLowerCase()) > -1 }); }
	return usr || false;
}

function autoEndVote(bot, msg) {
	setTimeout(() => {
		if (VoteDB.hasOwnProperty(msg.channel.id)) { commands["vote"].process(bot, msg, "end"); }
	}, 600000); //10 minutes = 600,000
}

function autoEndLotto(bot, msg) {
	setTimeout(() => {
		if (LottoDB.hasOwnProperty(msg.channel.id)) { commands["lotto"].process(bot, msg, "end"); }
	}, 600000);
}

function generateRandomRating(fullName, storeRating) {
	var weightedNumber = Math.floor((Math.random() * 20) + 1); //between 1 and 20
	var score, moreRandom = Math.floor(Math.random() * 4);
	if (weightedNumber < 5) { score = Math.floor((Math.random() * 3) + 1); } //between 1 and 3
	else if (weightedNumber > 4 && weightedNumber < 16) { score = Math.floor((Math.random() * 4) + 4); } //between 4 and 7
	else if (weightedNumber > 15) { score = Math.floor((Math.random() * 3) + 8); } //between 8 and 10
	if (moreRandom === 0 && score !== 1) { score -= 1;
	} else if (moreRandom == 3 && score != 10) { score += 1; }
	if (storeRating) { Ratings[fullName.toLowerCase()] = score; }
	return score;
}

function generateUserRating(bot, msg, fullName) {
	var user = msg.channel.server.members.get("username", fullName);
	if (user === undefined) { return generateRandomRating(); }
	var score = generateRandomRating() - 1;
	try {
		var joined = new Date(msg.channel.server.detailsOfUser(user).joinedAt), now = new Date();
		if (now.valueOf() - joined.valueOf() >= 2592000000) { score += 1; } //if user has been on the server for at least one month +1
	} catch (e) { console.log(colors.cError(" ERROR ") + e.stack); }
	if (msg.channel.permissionsOf(user).hasPermission("manageServer")) { score += 1; } //admins get +1 ;)
	var count = 0;
	bot.servers.map((server) => { if (server.members.get("id", user.id)) { count += 1; } }); //how many servers does the bot share with them
	if (count > 2) { score += 1; } //if we share at least 3 servers
	if (!user.avatarURL) { score -= 1; } //gotta have an avatar
	if (user.username.length > 22) { score -= 1; } //long usernames are hard to type so -1
	if (score > 10) { score = 10; } else if (score < 1) { score = 1; } //keep it within 1-10
	Ratings[fullName.toLowerCase()] = score;
	return score;
}

function generateJSONRating(fullName) {
	var ranking = waifus[fullName];
	var ranges = {
		"1": "1-4", "2": "2-4",
		"3": "4-8", "4": "4-8",
		"5": "5-8", "6": "6-9",
		"7": "7-10", "8": "8-10",
		"9": "10-10",
	};
	var score = Math.floor((Math.random() * ((parseInt(ranges[ranking].split("-")[1], 10) + 1 - parseInt(ranges[ranking].split("-")[0], 10)))) + parseInt(ranges[ranking].split("-")[0], 10))
	var moreRandom = Math.floor(Math.random() * 4); //0-3
	if (score > 1 && moreRandom === 0) { score -= 1; } else if (score < 10 && moreRandom == 3) { score += 1; }
	Ratings[fullName.toLowerCase()] = score;
	return score;
}

/*====================
Commands
====================*/

var aliases = {
	"h": "help", "commands": "help",
	"server": "botserver",
	"j": "join", "joins": "join",
	"coin": "coinflip", "flip": "coinflip",
	"gba": "game", "gbagame": "game", "games": "game"
};

var commands = {
	"help": {
		desc: "Sends a DM containing all of the commands. If a command is specified gives info on that command.",
		usage: "[command]",
		deleteCommand: true, shouldDisplay: false, cooldown: 1,
		process: function(bot, msg, suffix) {
			var toSend = [];
			if (!suffix) {
				toSend.push("Use *help [command] to get info on a specific command.");
				toSend.push("Mod commands can be found with -**help [command].");
				toSend.push("**|Commands|**\n");
				toSend.push("`@" + bot.user.username + " text`\n		Talk to InfGBA!");
				Object.keys(commands).forEach(function(cmd) {
					if (commands[cmd].hasOwnProperty("shouldDisplay")) {
						if (commands[cmd].shouldDisplay) { toSend.push("`" + config.command_prefix + cmd + " " + commands[cmd].usage + "`\n		" + commands[cmd].desc); }
					} else { toSend.push("`" + config.command_prefix + cmd + " " + commands[cmd].usage + "`\n		" + commands[cmd].desc); }
				});
				var helpMessage = toSend.join("\n");
				var helpPart2 = helpMessage.substring(helpMessage.indexOf("`]lotto`"));
				var helpPart1 = helpMessage.substring(0, helpMessage.indexOf("`]lotto`") - 1);
				bot.sendMessage(msg.author, helpPart1);
				bot.sendMessage(msg.author, helpPart2);
			} else {
				if (commands.hasOwnProperty(suffix)) {
					toSend.push("**" + config.command_prefix + "" + suffix + ":** " + commands[suffix].desc);
					if (commands[suffix].hasOwnProperty("usage")) { toSend.push("**Usage:** `" + config.command_prefix + "" + suffix + " " + commands[suffix].usage + "`"); }
					if (commands[suffix].hasOwnProperty("cooldown")) { toSend.push("**Cooldown:** " + commands[suffix].cooldown + " seconds"); }
					if (commands[suffix].hasOwnProperty("deleteCommand")) { toSend.push("*Delete Command: true*"); }
					bot.sendMessage(msg, toSend);
				} else { bot.sendMessage(msg, "Command `" + suffix + "` not found.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); }
			}
		}
	},
	"botserver": {
		desc: "Get a link to InfGBA's Official Server.",
		cooldown: 10, usage: "",
		process: function(bot, msg, suffix) {
			bot.sendMessage(msg, "An invite to my official server: *https://discord.gg/0wFUUOhNqQiY9pt3*");
		}
	},
	"join": {
		desc: "Joins the specified server.",
		usage: "[invite link]",
		deleteCommand: true,
		process: function(bot, msg, suffix) {
			if (suffix) {
				var invites = suffix.split(" ");
				invites.map(function(invite) {
					if (/https?:\/\/discord\.gg\/[A-Za-z0-9]+/.test(invite)) {
						var cServers = [];
						bot.servers.map(function(srvr) { cServers.push(srvr.id); });
						bot.joinServer(invite, function(err, server) {
							if (err) {
								bot.sendMessage(msg, "⚠ Failed to join: " + err);
								console.log(colors.cWarn(" WARN ") + err);
							} else if (cServers.indexOf(server.id) > -1) {
								console.log("Already in server");
								bot.sendMessage(msg, "I'm already there!");
							} else {
								if (config.use_env) {
									if (process.env.banned_server_ids && process.env.banned_server_ids.indexOf(server.id) > -1) {
										console.log(colors.cRed("Joined server but it was on the ban list") + ": " + server.name);
										bot.sendMessage(msg, "Can't join this server. PrimalMew doesn't allow it...");
										bot.leaveServer(server);
										return;
									}
								} else {
									if (config.banned_server_ids && config.banned_server_ids.indexOf(server.id) > -1) {
										console.log(colors.cRed("Joined server but it was on the ban list") + ": " + server.name);
										bot.sendMessage(msg, "Can't join this server. PrimalMew doesn't allow it...");
										bot.leaveServer(server);
										return;
									}
								}
								console.log(colors.cGreen("Joined server: ") + server.name);
								bot.sendMessage(msg, "InfGBA has successfully joined ***" + server.name + "***");
								if (suffix.indexOf("-a") != -1) {
									var toSend = [];
									toSend.push("Greetings! I'm **" + bot.user.username + "**. " + msg.author + " invited me here.");
									toSend.push("You can use *help to get a list of commands.");
									toSend.push("If you don't want me here, you can use *leave to make me leave.");
									bot.sendMessage(server.defaultChannel, toSend);
								} else { setTimeout(function() { bot.sendMessage(server.defaultChannel, "Hi! I'm " + bot.user.username + "!I have joined on request of *" + msg.author + "*"); }, 2000); }
							}
						});
					}
				});
			} else { bot.sendMessage(msg, correctUsage("join")); }
		}
	},
	"about": {
		desc: "About InfGBA",
		deleteCommand: true, cooldown: 10, usage: "",
		process: function(bot, msg, suffix) {
			bot.sendMessage(msg, "Hi! I'm " + bot.user.username + "! I was created by PrimalMew! I strive to bring you the best information about GBA games. Please, if you have any suggestions for features, use '*botserver' to get a link to my official server and post your suggestions there.");
		}
	},
	"game": {
		desc: "Make InfGBA recite a listed GBA game!",
		deleteCommand: true,
		usage: "[none] or specify [number]",
		cooldown: 3,
		process: function (bot, msg, suffix) {
			if (suffix && /^\d+$/.test(suffix) && gbagames.length >= parseInt(suffix) - 1) {bot.sendMessage(msg, gbagames[suffix - 1]);}
			else {bot.sendMessage(msg, gbagames[Math.floor(Math.random() * (gbagames.length))]);}
		}
	},
	"info": {
		desc: "Gets info on the server or a user if specified.",
		usage: "[username]",
		deleteCommand: true,
		cooldown: 10,
		process: function(bot, msg, suffix) {
			if (!msg.channel.isPrivate) {
				if (suffix) {
					if (msg.mentions.length > 0) {
						if (msg.everyoneMentioned) { bot.sendMessage(msg, "Woah, " + msg.author.username + ", calm down please. You can't get details on everyone at the same time, dude!", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); return; }
						if (msg.mentions.length > 4) { bot.sendMessage(msg, "4 user limit.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); return; }
						msg.mentions.map(function(usr) {
							var toSend = [], count = 0;
							toSend.push("ℹ on " + usr.username + " (" + usr.discriminator + ")");
							toSend.push("**User ID:** " + usr.id);
							if (usr.game && usr.game.name !== undefined && usr.game.name !== null && usr.game.name !== "null") toSend.push("**Status:** " + usr.status + " **last played** " + usr.game.name);
							else toSend.push("**Status:** " + usr.status);
							var detailsOf = msg.channel.server.detailsOfUser(usr);
							if (detailsOf) toSend.push("**Joined on:** " + new Date(msg.channel.server.detailsOfUser(usr).joinedAt).toUTCString());
							else toSend.push("**Joined on:** Error");
							var roles = msg.channel.server.rolesOfUser(usr.id).map((role) => { return role.name; });
							if (roles) {
								roles = roles.join(", ").replace("@", "");
								if (roles && roles !== "")
									if (roles.length <= 1500) { toSend.push("**Roles:** `" + roles + "`"); } else { toSend.push("**Roles:** `" + roles.split(", ").length + "`"); }
								else
									toSend.push("**Roles:** `no roles`");
							} else toSend.push("**Roles:** Error");
							bot.servers.map((server) => { if (server.members.indexOf(usr) > -1) { count += 1; } });
							if (count > 1) { toSend.push("Playing on **" + count + "** other servers."); }
							if (usr.avatarURL != null) { toSend.push("**Avatar:** `" + usr.avatarURL + "`"); }
							bot.sendMessage(msg, toSend);
						});
					} else {
						if (msg.everyoneMentioned) { bot.sendMessage(msg, "Woah, " + msg.author.username + ", calm down dude", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); return; }
						var users = suffix.split(/, ?/);
						if (users.length > 4) { bot.sendMessage(msg, "4 user limit.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); return; }
						users.map(function(user) {
							var usr = findUser(msg.channel.server.members, user);
							if (usr) {
								var toSend = [], count = 0;
								toSend.push("ℹ on " + usr.username + " (" + usr.discriminator + ")");
								toSend.push("**User ID:** " + usr.id);
								if (usr.game && usr.game.name !== undefined && usr.game.name !== null && usr.game.name !== "null") toSend.push("**Status:** " + usr.status + " **last playing** " + usr.game.name);
								else toSend.push("**Status:** " + usr.status);
								var detailsOf = msg.channel.server.detailsOfUser(usr);
								if (detailsOf) toSend.push("**Joined on:** " + new Date(msg.channel.server.detailsOfUser(usr).joinedAt).toUTCString());
								else toSend.push("**Joined on:** Error");
								var roles = msg.channel.server.rolesOfUser(usr.id).map((role) => { return role.name; });
								if (roles) {
									roles = roles.join(", ").replace("@", "");
									if (roles && roles !== "")
										if (roles.length <= 1500) { toSend.push("**Roles:** `" + roles + "`"); } else { toSend.push("**Roles:** `" + roles.split(", ").length + "`"); }
									else
										toSend.push("**Roles:** `none`");
								} else toSend.push("**Roles:** Error");
								bot.servers.map((server) => { if (server.members.indexOf(usr) > -1) { count += 1; } });
								if (count > 1) { toSend.push("Playing on **" + count + "** other servers."); }
								if (usr.avatarURL != null) { toSend.push("**Avatar:** `" + usr.avatarURL + "`"); }
								bot.sendMessage(msg, toSend);
							} else bot.sendMessage(msg, "User \"" + user + "\" not found.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 15000}); });
						});
					}
				} else {
					var toSend = [];
					toSend.push("ℹ **about** " + msg.channel.server.name);
					toSend.push("**Server ID:** " + msg.channel.server.id);
					toSend.push("**Server Owner:** " + msg.channel.server.owner.username + " (**ID:** " + msg.channel.server.owner.id + ")");
					toSend.push("**Server Region:** " + msg.channel.server.region);
					toSend.push("**Current Members:** " + msg.channel.server.members.length + " **Channels:** " + msg.channel.server.channels.length);
					var roles = msg.channel.server.roles.map((role) => { return role.name; });
					roles = roles.join(", ").replace("@", "");
					if (roles.length <= 1500) toSend.push("**Roles:** `" + roles + "`");
					else toSend.push("**Roles:** `" + roles.split(", ").length + "`");
					toSend.push("**Default Channel:** " + msg.channel.server.defaultChannel);
					toSend.push("**Current Channel's ID:** " + msg.channel.id);
					toSend.push("**Server Icon:** `" + msg.channel.server.iconURL + "`");
					bot.sendMessage(msg, toSend);
				}
			} else bot.sendMessage(msg, "Unavailable in Direct Messages...", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 8000}); });
		}
	},
	"coinflip": {
		desc: "Flips a coin!",
		usage: "[none]",
		deleteCommand: true,
		cooldown: 2,
		process: function(bot, msg, suffix) {
			var side = Math.floor(Math.random() * (2));
			if (side == 0) { bot.sendMessage(msg, "**" + msg.author.username + "** has flipped a coin... | It's **Heads**!");
			} else { bot.sendMessage(msg, "**" + msg.author.username + "** has flipped a coin... | It's **Tails**!"); }
		}
	}
};

exports.commands = commands;
exports.aliases = aliases;
