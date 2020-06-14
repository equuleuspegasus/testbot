const ytdl = require('ytdl-core-discord');

class Playback {

    constructor(connection) {
        this.connection = connection;
    }

    async youtube(url) {
        const stream = await ytdl(url, {highWaterMark: 1<<25});
        return this.playStream(stream, {type: 'opus', volume: false, highWaterMark: 512});
    }

    async file(url) {
        return this.playStream(url, {volume: false, highWaterMark: 512});
    }

    async unsupported(url) {
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