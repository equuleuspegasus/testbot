

require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();

const timeout = require('./src/timeout');
const Playback = require('./src/playback');
const Playlist = require('./src/playlist');

client.on('ready', () => {
    console.log('Logged in as ' + client.user.tag);
});

const playlist = new Playlist(client);

client.on('message', msg => {
    if (msg.author.bot) {
        return;
    } else if (msg.channel.type == "dm") {
        return;
    } else if (msg.content.startsWith('!yt')) {
        msg.react('🏎️');
        (async () => {
            const url = msg.content.split(' ')[1];
            const voice = msg.guild.channels.cache.find(c => c.type === 'voice');
            const connection = await voice.join();
            await new Playback(connection).youtube(url);
            msg.react('🤔');
        })();

    } else if (msg.content == '!mp3') {
        (async () => {
            const voice = msg.guild.channels.cache.find(c => c.type === 'voice');
            const connection = await voice.join();
            try {
                const dispatcher = connection.play('https://media.discordapp.net/attachments/716572478851252336/717333373235757076/blopp_01.mp3');
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
    } else if (msg.content == '!flip') {
        msg.channel.send('flipping coin...');
        timeout(3000).then(() => {
            let number = Math.random();
            msg.channel.send(number > 0.5 ? 'HEADS' : 'TAILS');
        });
    } else if (msg.content == '!pet') {

        msg.channel.send(`_pets ${process.env.PET}_`);
        //console.log(msg)
    }
});

client.login(process.env.TOKEN);

