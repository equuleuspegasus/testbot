const ytdl = require('ytdl-core-discord');
const axios = require('axios');

class Playback {

    constructor(connection) {
        this.connection = connection;
    }

    async youtube(song) {
        const stream = await ytdl(song.url.href, {highWaterMark: 1<<25});
        return this.playStream(stream, {type: 'opus', volume: false, highWaterMark: 1024});
    }

    async file(song) {
        return this.playStream(song.url.href, {volume: false, highWaterMark: 1024});
    }

    async clyp(song) {
        try { 
            let apiUrl = `https://api.clyp.it${song.url.pathname}`;
            let response = await axios.get(apiUrl);
            return this.playStream(response.data.OggUrl, {volume: false, highWaterMark: 1024});
        } catch(e) {
            console.log(e);
            return new Promise(resolve => resolve());
        }
    }

    async unsupported(song) {
        console.log('unsupported media type');
        return new Promise(resolve => resolve());
    }

    playStream(url, params) {
        this.dispatcher = this.connection.play(url, params);
        return new Promise((resolve,reject) => {
            this.dispatcher.on('finish', (e) =>  {
                console.log('finish:', e);
                resolve();
            });
            this.dispatcher.on('end', (e) => {
                console.log('end:', e);
            });
            this.dispatcher.on('error', (e) => {
                console.log('error:', e);
                reject();
            });
        });
    }
}

module.exports = Playback;