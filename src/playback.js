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
        return true;
    }

    playStream(url, params) {
        this.dispatcher = this.connection.play(url, params);
        return new Promise((resolve,reject) => {
            this.dispatcher.on('finish', () =>  {
                console.log('end');
                resolve();
            });
            this.dispatcher.on('error', () => {
                console.log('error');
                reject();
            });
        });
    }
}

module.exports = Playback;