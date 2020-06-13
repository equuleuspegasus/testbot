
const Collection = require('@discordjs/collection');
const PlaylistItem = require('./playlistItem');
const Playback = require('./playback');

class Playlist {

    client;
    playlist;
    currentSong = 0;
    state = 'STOPPED';

    constructor(client) {
        this.client = client;
        this.init();
    }

    init() {
        this.client.on('message', msg => {
            if (msg.channel.type != "dm") {
                if (msg.content.startsWith("!play")) {
                    let parts = msg.content.split(/\s+/);
                    let index = Number(parts[1]);
                    index = Number.isNaN(index) ? 0 : index-1;
                    this.play(msg.channel, index);
                } else if (msg.content == "!next") {
                    this.next();
                } else if (msg.content == "!prev") {
                    this.prev();
                } else if (msg.content == "!stop") {
                    this.stop();
                }
            }
        });
    }

    async play(channel, startAt = 0) {
        this.playlist = await this.compilePlaylist(channel);

        const voice = channel.guild.channels.cache.find(c => c.type === 'voice');
        const connection = await voice.join();
        this.playback = new Playback(connection);

        this.state = 'PLAYING';
        this.playSong(startAt);

        // this.client.user.setPresence({
        //     activity: {
        //         type: 'LISTENING',
        //         name: 'some kinda music'
        //     }
        // });
    }

    stopSong() {
        if (this.playback && this.playback.dispatcher) {
            this.playback.dispatcher.end();
        }
    }

    stop() {
        if (this.playback) {
            this.stopSong();
            this.state = 'STOPPED';
            this.currentSong = 0;
            this.playback.connection.disconnect();
        }
    }

    async playSong(index) {
        console.log('play song', index);
        if (this.playback) {
            if (index >= 0 && index < this.playlist.length) {
                this.currentSong = index;
                let song = this.playlist[index];
                await this.playback[song.type](song.url.href);
                this.next();
            } else {
                this.stop();
            }
        }
    }

    next() {
        if (this.currentSong < (this.playlist.length-1)) {
            this.playSong(this.currentSong + 1);
        }
    }

    prev() {
        if (this.currentSong > 0) {
            this.playSong(this.currentSong - 1);
        }
    }

    skip() {
        this.next();
    }

    async compilePlaylist(channel) {
        const messages = await this.getAllMessages(channel);

        let playlist = [];
        messages.forEach(message => {
            let url = this.extractUrlFromMessage(message);
            if (url) {
                let playlistItem = PlaylistItem.create(url, message);
                if (playlistItem) {
                    playlist.push(playlistItem);
                }
            }
        });
        return playlist;
    }

    async getAllMessages(channel) {
        if (!channel) {
            throw new Error('no channel specified');
        }

        let allMessages = new Collection();
        let lastMessage = null;
        let m = null;
        do {
            m = await channel.messages.fetch({before: lastMessage, limit: 100});
            lastMessage = m.last().id;
            allMessages = allMessages.concat(m);
        } while (m.size == 100);

        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        return allMessages;
    }

    extractUrlFromMessage(message) {
        let url;

        // return attachment url if any
        if (message.attachments.size) {
            let attachment = message.attachments.first();
            url = this.getUrl(attachment.proxyURL);
            if (!url) {
                url = this.getUrl(attachment.url);
            }
        }
        if (url) {
            return url;
        }

        // else return url from message body, if any
        let msgParts = message.content.split(' ');

        for (let token of msgParts) {
            url = this.getUrl(token);
            if (url) {
                break;
            }
        }

        return url;
    }

    getUrl(str) {
        try {
            return new URL(str);
        } catch (e) {
            return null;
        }
    }

    canHandle(url) {
        return true;
    }

}

module.exports = Playlist;