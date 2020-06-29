const ytdl = require('ytdl-core-discord');
const axios = require('axios');
const fs = require('fs');

class Playback {

    constructor(connection) {
        this.connection = connection;
    }

    async youtube(song) {
        const stream = await ytdl(song.url.href, {highWaterMark: 1<<25});
        return this.playStream(stream, {type: 'opus', volume: false, highWaterMark: 256, fec: true});
    }

    async file(song) {
        try {
            let filename = './temp';
            let temp = fs.createWriteStream(filename, {autoClose: true});
            let response = await axios({method: 'get', url: song.url.href, responseType: 'stream'});
            response.data.pipe(temp);
            return this.playStream(filename, {volume: false, highWaterMark: 256, fec: true});
        } catch (e) {
            console.log('error playing file');
            return new Promise(resolve => resolve());
        }
    }

    async clyp(song) {

        const refreshClypData = async (song) => {
            try { 
                let apiUrl = `https://api.clyp.it${song.url.pathname}`;
                let response = await axios.get(apiUrl);
                let url = new URL(response.data.OggUrl);
                let expiry = url.searchParams.Expires;
                song.expiry = Number(expiry) * 1000;
                song.streamUrl = url.href;
                return song;
            } catch(e) {
                console.log(e);
                return false;
            }
        }

        if (song.expiry < Date.now()) {
            song = await refreshClypData(song);
        }

        try {
            return this.playStream(song.streamUrl, {volume: false, highWaterMark: 256, fec: true});
        } catch(e) {
            song = refreshClypData(song);
            return this.playStream(song.streamUrl, {volume: false, highWaterMark: 256, fec: true});

        }
    }

    async soundcloud(song) {
        let url = `${song.streamUrl}?client_id=${process.env.SC_CLIENT_ID}`;
        return this.playStream(url, {volume: false, highWaterMark: 256});
    }

    async unsupported(song) {
        console.log('unsupported media type');
        return new Promise(resolve => resolve());
    }

    playStream(url, params) {
        this.dispatcher = this.connection.play(url, params);
        return new Promise((resolve,reject) => {
            this.dispatcher.on('finish', () =>  {
                console.log('finish');
                resolve();
            });
            this.dispatcher.on('end', () => {
                console.log('end');
            });
            this.dispatcher.on('error', () => {
                console.log('error');
                reject();
            });
            this.dispatcher.on('debug', (e) => {
                console.log('debug', e);
            })
        });
    }
}

module.exports = Playback;
