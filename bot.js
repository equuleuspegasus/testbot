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
            const stream = await ytdl(url);
            const dispatcher = connection.play(stream, {type: 'opus'});
            dispatcher.on('end', () => voice.leave());
            msg.react('🤔');
        })();

    }
});

client.login(process.env.TOKEN);