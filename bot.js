const timeout = function(ms) {
    return new Promise(r => {
        setTimeout(r, ms);
    });
}


require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const Collection = require('@discordjs/collection');
const ytdl = require('ytdl-core-discord');

client.on('ready', () => {
    console.log('Logged in as ' + client.user.tag);
});

client.on('message', msg => {
    if (msg.author.bot) {
        return;
    } else if (msg.channel.type == "dm") {
        return;
    } else if (msg.content == '!test') {
        msg.react('🤔');        
        (async () => {
            messages = msg.channel.messages;
            let allMessages = new Collection();
            let lastMessage = null;
            do {
                m = await messages.fetch({before: lastMessage, limit: 100});
                lastMessage = m.last().id;
                allMessages = allMessages.concat(m);
            } while (m.size == 100);

            allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            counter = 0;
            allMessages.map((message) => {
                console.log(++counter, new Date(message.createdTimestamp).toLocaleDateString(), message.content)
            });
            msg.delete();            
        })();
    } else if (msg.content.startsWith('!play')) {
        msg.react('🏎️');
        (async () => {
            const url = msg.content.split(' ')[1];
            const voice = msg.guild.channels.cache.find(c => c.type === 'voice');
            const connection = await voice.join();
            const stream = await ytdl(url, {highWaterMark: 1<<25});
            const dispatcher = connection.play(stream, {type: 'opus', volume: false, highWaterMark: 512});
            dispatcher.on('finish', () =>  {
                console.log('end');
                voice.leave();
            });
            dispatcher.on('error', () => {
                console.log('error');
                voice.leave();
            });
            msg.react('🤔');
        })();

    } else if (msg.content == '!mp3') {
        (async () => {
            const voice = msg.guild.channels.cache.find(c => c.type === 'voice');
            const connection = await voice.join();
            try {
                const dispatcher = connection.play('https://media.discordapp.net/attachments/716572478851252336/717333373235757076/blop_01.mp3');
                dispatcher.on('finish', () =>  {
                    console.log('end');
                    voice.leave();
                });
                dispatcher.on('error', () => {
                    console.log('error');
                    voice.leave();
                });
            } catch (e) {
                console.log(e);
            }

            msg.react('🤔');
        })();
    } else if (msg.content == '!stop') {
        msg.react('🏎️');

        let connection = client.guilds.resolve(msg.guild.id).voice.connection;
        if (connection) {
            connection.disconnect();
        }
    } else {
        console.log(msg)
    }
});

client.login(process.env.TOKEN);