
const Collection = require('@discordjs/collection');
const PlaylistItem = require('./playlistItem');
const Playback = require('./playback');

class Playlist {

    client;

    constructor(client) {
        this.client = client;
        this.init();
    }

    init() {
        this.client.on('message', msg => {
            if (msg.channel.type != "dm") {
                if (msg.content == "!play") {
                    this.play(msg.channel);
                } else if (msg.content == "!skip") {
                    this.skip();
                }
            }
        });
    }

    async play(channel) {
        const playlist = await this.compilePlaylist(channel);

        const voice = channel.guild.channels.cache.find(c => c.type === 'voice');
        const connection = await voice.join();
        this.playback = new Playback(connection);

        for (let item of playlist) {
            await this.playback[item.type](item.url.href);
        }

        // this.client.user.setPresence({
        //     activity: {
        //         type: 'LISTENING',
        //         name: 'some kinda music'
        //     }
        // });
    }

    skip() {
        this.playback.dispatcher.end();
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