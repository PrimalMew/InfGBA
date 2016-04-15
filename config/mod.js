var config = require("./config.json");
var games = require("./games.json").games;
var version = require("../package.json").version;
var colors = require("./styles.js");

var confirmCodes = []; //stuff for announce
var announceMessages = [];

/*======
PrimalFunctions
========*/

function correctUsage(cmd) {
	return (commands.hasOwnProperty(cmd)) ? "Usage: `" + config.mod_command_prefix + "" + cmd + " " + commands[cmd].usage + "`": "The usage should be displayed, however, PrimalMew has made a mistake. Please let him know.";
}

/*======
Commands
=======*/

var aliases = {
	"h": "help", "commands": "help",
	"s": "stats", "stat": "stats", "status": "stats",
	"c": "clean",
	"l": "leave", "leaves": "leave",
	"change": "changelog", "logs": "changelog", "changelogs": "changelog",
	"rolec": "color", "rolecolor": "color",
};

var commands = {
	"help": {
		desc: "Sends a DM containing all of the commands. If a command is specified gives info on that command.",
		usage: "[command]", deleteCommand: true, shouldDisplay: false,
		process: function(bot, msg, suffix) {
			var toSend = [];
			if (!suffix) {
				toSend.push("Use -help [command] to get info on a specific command.");
				toSend.push("");
				toSend.push("**|Commands|**\n");
				Object.keys(commands).forEach(function(cmd) {
					if (commands[cmd].hasOwnProperty("shouldDisplay")) {
						if (commands[cmd].shouldDisplay) { toSend.push("`" + config.mod_command_prefix + cmd + " " + commands[cmd].usage + "`\n        " + commands[cmd].desc); }
					} else { toSend.push("`" + config.mod_command_prefix + cmd + " " + commands[cmd].usage + "`\n        " + commands[cmd].desc); }
				});
				bot.sendMessage(msg.author, toSend);
			} else { //if user wants info on a command
				if (commands.hasOwnProperty(suffix)) {
					toSend.push("**" + config.mod_command_prefix + "" + suffix + ": **" + commands[suffix].desc);
					if (commands[suffix].hasOwnProperty("usage")) { toSend.push("**Usage:** `" + config.mod_command_prefix + "" + suffix + " " + commands[suffix].usage + "`"); }
					if (commands[suffix].hasOwnProperty("cooldown")) { toSend.push("**Cooldown:** " + commands[suffix].cooldown + " seconds"); }
					if (commands[suffix].hasOwnProperty("deleteCommand")) { toSend.push("*This command will delete the message that activates it*"); }
					bot.sendMessage(msg, toSend);
				} else { bot.sendMessage(msg, "Command `" + suffix + "` not found.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); }
			}
		}
	},
	"stats": {
		desc: "Get the stats of InfGBA.",
		usage: "", cooldown: 30, deleteCommand: true,
		process: function(bot, msg, suffix) {
			if (msg.author.id == config.admin_id || msg.channel.isPrivate || msg.channel.permissionsOf(msg.author).hasPermission("manageChannel")) {
				var toSend = [];
				toSend.push("```");
				toSend.push("Uptime (may be inaccurate): " + (Math.round(bot.uptime / (1000 * 60 * 60))) + " hours, " + (Math.round(bot.uptime / (1000 * 60)) % 60) + " minutes, and " + (Math.round(bot.uptime / 1000) % 60) + " seconds.");
				toSend.push("Connected to " + bot.servers.length + " servers, " + bot.channels.length + " channels, and " + bot.users.length + " users.");
				toSend.push("Memory Usage: " + Math.round(process.memoryUsage().rss / 1024 / 1000) + "MB");
				toSend.push("Running InfGBA v" + version);
				toSend.push("Commands processed this session: " + commandsProcessed + " + " + talkedToTimes + " cleverbot");
				toSend.push("```");
				bot.sendMessage(msg, toSend);
			} else { bot.sendMessage(msg, "Only Moderators can do this.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); }
		}
	},
	"clean": {
		desc: "Cleans the specified number of bot messages from the channel.",
		usage: "[number of InfGBA messages 1-100]",
		cooldown: 10, deleteCommand: true,
		process: function(bot, msg, suffix) {
			if (suffix && /^\d+$/.test(suffix)) { //if suffix has digits
				if (msg.channel.isPrivate || msg.channel.permissionsOf(msg.author).hasPermission("manageMessages") || msg.author.id == config.admin_id) {
					bot.getChannelLogs(msg.channel, 100, (error, messages) => {
						if (error) { console.log(colors.cWarn(" WARN ") + "Something went wrong while fetching logs."); return; }
						if (config.debug) { console.log(colors.cDebug(" DEBUG ") + "Cleaning bot messages..."); }
						var todo = parseInt(suffix),
						delcount = 0;
						for (var i = 0; i < 100; i++) {
							if (todo <= 0 || i == 99) {
								bot.sendMessage(msg, "Successfully cleaned up and deleted " + delcount + " messages.", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
								if (config.debug) { console.log(colors.cDebug(" DEBUG ") + "COMPLETE! Deleted " + delcount + " messages."); }
								return;
							}
							if (messages[i].author == bot.user) {
								bot.deleteMessage(messages[i]);
								delcount++;
								todo--;
							}
						}
					});
				} else { bot.sendMessage(msg, "*You don't have permission to do this.*", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); }
			} else { bot.sendMessage(msg, correctUsage("clean"), function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); }
		}
	},
	"kick": {
		desc: "Kick a user with a message",
		usage: "[user] [reason]",
		deleteCommand: true,
		cooldown: 3,
		process: function(bot, msg, suffix) {
			if (!msg.channel.permissionsOf(msg.author).hasPermission("kickMembers") && msg.author.id != config.admin_id) { bot.sendMessage(msg, "⚠ You don't have permission to do that. ⚠", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
			} else if (!msg.channel.permissionsOf(bot.user).hasPermission("kickMembers")) { bot.sendMessage(msg, "⚠ InfGBA can't kick members. Give it's role the right permissions to do so. ⚠", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
			} else if (suffix && msg.mentions.length > 0) {
				var kickMessage = suffix.replace(/<@\d+>/g, "").trim();
				msg.mentions.map((unlucky) => {
					msg.channel.server.kickMember(unlucky);
					if (kickMessage) { bot.sendMessage(unlucky, kickMessage); }
				});
				bot.sendMessage(msg, "Okay, " + msg.sender + ", They've been kicked from the server!", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
			} else { bot.sendMessage(msg, correctUsage("kick"), (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); }); }
		}
	},
	"ban": {
		desc: "Ban a user with the reason.",
		usage: "[user] [reason]",
		deleteCommand: true,
		cooldown: 3,
		process: function(bot, msg, suffix) {
			if (!msg.channel.permissionsOf(msg.author).hasPermission("banMembers") && msg.author.id != config.admin_id) { bot.sendMessage(msg, "⚠ You don't have permission to do that. ⚠", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
			} else if (!msg.channel.permissionsOf(bot.user).hasPermission("banMembers")) { bot.sendMessage(msg, "⚠ InfGBA can't kick members. Give it's role the right permissions to do so. ⚠", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
			} else if (suffix && msg.mentions.length > 0) {
				var banMessage = suffix.replace(/<@\d+>/g, "").trim();
				msg.mentions.map((unlucky) => {
					msg.channel.server.banMember(unlucky, 1);
					if (banMessage) { bot.sendMessage(unlucky, banMessage); }
				});
				bot.sendMessage(msg, "Okay, " + msg.sender + ", he is banished from ever returning.", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
			} else { bot.sendMessage(msg, correctUsage("ban"), (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); }); }
		}
	},
	"leave": {
		desc: "InfGBA will leave the server.",
		usage: "", deleteCommand: true,
		process: function(bot, msg, suffix) {
			if (msg.channel.server) {
				if (msg.channel.permissionsOf(msg.author).hasPermission("kickMembers") || msg.author.id == config.admin_id) {
					bot.sendMessage(msg, "What?! But, " + msg.sender + "!? This must be a mistake! I love SleepyTown!").then(
					msg.channel.server.leave());
					console.log(colors.cYellow("Just left server by request of " + msg.sender.username + ". ") + "Currently in only " + bot.servers.length + " servers.");
				} else {
					bot.sendMessage(msg, "Uh, " + msg.sender + ", How about no... **(Dude, you can't kick people...)**");
					console.log(colors.cYellow("Non-privileged user: " + msg.sender.username) + " tried to make me leave the server.");
				}
			} else { bot.sendMessage(msg, "⚠ I, like, can't leave a Direct Message, so... ⚠", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); }); }
		}
	},
	"changelog": {
		desc: "See recent changes to InfGBA.",
		deleteCommand: true, usage: "", cooldown: 30,
		process: function(bot, msg, suffix) {
			var chanelogChannel = bot.channels.get("id", "168205681718067202");
			if (!chanelogChannel) { bot.sendMessage(msg, "Changelog can only be shown in InfGBA's Official Server.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 8000}); });
			} else {
				bot.getChannelLogs(chanelogChannel, 2, function(err, messages) {
					if (err) { bot.sendMessage(msg, "There is an error getting the changelogs. Perhaps the Channel ID isn't defined? Ask PrimalMew. ERROR CODE: " + err); return; }
					var toSend = ["**|Changelogs|**"];
					toSend.push("|━━━━━━━━━━━━━━━━|");
					toSend.push(messages[1]);
					toSend.push("|━━━━━━━━━━━━━━━━|");
					toSend.push(messages[0]);
					bot.sendMessage(msg, toSend);
				});
			}
		}
	},
	"color": {
		desc: "Change a role's color",
		usage: "[role name] [color in hex]",
		deleteCommand: true, cooldown: 5,
		process: function(bot, msg, suffix) {
			if (/^(.*) #?[A-F0-9]{6}$/i.test(suffix)) {
				if (msg.channel.isPrivate) { bot.sendMessage(msg, "Can only be done in a server! Command not available in PMs.",function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 10000}); }); return; }
				if (!msg.channel.permissionsOf(msg.author).hasPermission("manageRoles") && msg.author.id != config.admin_id) { bot.sendMessage(msg, "You don't have permission to do that. You can't edit roles.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 10000}); }); return; }
				if (!msg.channel.permissionsOf(bot.user).hasPermission("manageRoles")) { bot.sendMessage(msg, "InfGBA doesn't have the permissions to edit roles.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 10000}); }); return; }
				var role = msg.channel.server.roles.get("name", suffix.replace(/ #?[a-f0-9]{6}/i, ""));
				if (role) { bot.updateRole(role, {color: parseInt(suffix.replace(/(.*) #?/, ""), 16)}); bot.sendMessage(msg, msg.author.username + " 👍 Role color changed successfully.", (erro, wMessage) => { bot.deleteMessage(wMessage, {"wait": 10000}); });
				} else { bot.sendMessage(msg, "The role \"" + suffix.replace(/ #?[a-f0-9]{6}/i, "") + "\" is not found.", function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 10000}); }); }
			} else { bot.sendMessage(msg, correctUsage("color"),function(erro, wMessage) { bot.deleteMessage(wMessage, {"wait": 10000}); }); }
		}
	}
}

exports.commands = commands;
exports.aliases = aliases;
