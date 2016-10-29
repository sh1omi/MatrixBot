'use strict';
module.exports = [
  {
    alias:['example'],
    level: 1,
    action: (client,data) => {
      client.sendTextMessage(data.id,"Your Text Message");
    }
  },
  {
    alias:['ping'],
    level: 1,
    action: (client,data) => {
      client.sendTextMessage(data.id,"pong");
    }
  }
];
