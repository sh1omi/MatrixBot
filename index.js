'use strict';
const sdk = require("matrix-js-sdk");
const dateformat = require("dateformat");
const fs = require("fs");

let config = require('./config.js');

require('request')({
    url: "http://matrix.org/_matrix/client/r0/login",
    method: "POST",
    json: {
        'type': 'm.login.password',
        'user': config.user,
        'password': config.pass,
    }
},
    (error, response, body) => {
        CreateClient(body.access_token);
    }
);
let cmd = {}, permissions = {};

let CreateClient = (token) => {
    let matrixClient = sdk.createClient({
        baseUrl: config.url,
        accessToken: token,
        userId: config.userid,
        timelineSupport: true
    });

    LoadModules();

    matrixClient.on("RoomMember.membership", (event, member) => {
        if (member.membership === "invite" && member.userId === config.userid) {
            matrixClient.joinRoom(member.roomId).done(() => {
                console.log("Auto-joined %s", member.roomId);
            });
        }
    });

    matrixClient.on("Room.timeline", (event, room, toStartOfTimeline, removed) => {
        if (toStartOfTimeline) return;
        if (event.getType() !== "m.room.message") return;
        if (event.getSender() == config.userid) return;
        if (event.event.unsigned.age > 10000) return;
        if (event.event.content.body.charAt(0) == '!') {
            console.log("[" + dateformat(event.event.origin_server_ts, "HH:MM:ss") + " / " + room.name + " / "+ event.event.unsigned.age +"] " + event.event.sender + ": " + event.event.content.body);
            let data = { 
                id: room.roomId,
                sender: event.event.sender
            };
            data.params = event.event.content.body.split(" ");
            data.cmd = data.params[0].toLowerCase();
            let command = data.cmd.substr(1);
            data.params.shift();
            if (typeof cmd[command] != "undefined") {
                let level = 1;
                if (typeof permissions[event.event.sender] != "undefined") level = permissions[event.event.sender];
                if (typeof cmd[command][0] == "function") {
                    if (level >= cmd[command][1]) cmd[command][0](matrixClient, data);
                    else matrixClient.sendTextMessage(room.roomId, "You dont have enough power to do the command: " + command);
                } else {
                    if (level >= cmd[cmd[command]][1]) cmd[cmd[command]][0](matrixClient, data);
                    else matrixClient.sendTextMessage(room.roomId, "You dont have enough power to do the command: " + command);
                }
            } else matrixClient.sendTextMessage(room.roomId, "Hmm, you need help? type !help :)");
        }
    });

    matrixClient.startClient();
}

let LoadModules = () => {
    let help = "";
    cmd = {};
    fs.readdirSync(require("path").join(__dirname, "commands")).forEach((file) => {
        delete require.cache[require.resolve("./commands/" + file)];
        let command = require("./commands/" + file);
        console.log(file + " loaded.");
        for (let i = 0; i < command.length; i++) {
            cmd[command[i].alias[0]] = [];
            cmd[command[i].alias[0]][0] = command[i].action;
            cmd[command[i].alias[0]][1] = command[i].level;
            help += "!" + command[i].alias[0];
            if (command[i].alias.length != 1) {
                help += "(";
                for (let y = 1; y < command[i].alias.length; y++) {
                    cmd[command[i].alias[y]] = command[i].alias[0];
                    help += "!" + command[i].alias[y] + ", ";
                }
                help = help.substring(0, help.length - 2) + ")";
            }
            help += ", ";
        }
    });
    help += " !level, !reload";

    /* Extra Commands */
    cmd['help'] = [];
    cmd['help'][0] = (client, data) => {
        client.sendTextMessage(data.id, help);
    };
    cmd['help'][1] = 1;

    cmd['level'] = [];
    cmd['level'][0] = (client, data) => {
        let params = data.args[1].split(' ');
        if (data.params.length != 3) client.sendTextMessage(data.id, params[0] + " [host] [level]");
        else {
            if (isNaN(data.params[2])) return client.sendTextMessage(data.id, params[0] + " [host] [Must be a number]");
            let levels;
            levels = JSON.parse(fs.readFileSync('data/permissions.json', 'utf8'));
            levels[data.params[1]] = parseInt(data.params[2]);
            fs.writeFile('data/permissions.json', JSON.stringify(levels), function (err) {
                if (err) return console.log(err);
                client.sendTextMessage(data.id, data.params[1] + " is now level " + data.params[2]);
            });
            permissions = levels;
        }
    };
    cmd['level'][1] = 10;

    cmd['reload'] = [];
    cmd['reload'][0] = (client, data) => {
        LoadModules();
        client.sendTextMessage(data.id, Object.keys(cmd).length + " commands loaded");
    };
    cmd['reload'][1] = 10;

    fs.writeFile("data/help.json", help, function (err) {
        if (err) return console.log(err);
    });
}

fs.readFile("data/permissions.json", "utf8", function (err, data) {
    if (err) return console.log(err);
    permissions = JSON.parse(data);
});
