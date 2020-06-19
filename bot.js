require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();
const Playlist = require('./src/playlist');

global.__basedir = __dirname;

client.on('ready', () => {
    console.log('Logged in as ' + client.user.tag);
});

new Playlist(client);

client.login(process.env.TOKEN);