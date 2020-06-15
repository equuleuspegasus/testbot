
const Collection = require('@discordjs/collection');
const PlaylistItem = require('./playlistItem');
const Playback = require('./playback');
const { MessageEmbed } = require('discord.js');
const timeout = require('./timeout');



class Playlist {

    client;
    playlist;
    textChannel;
    currentSong = 0;
    state = 'STOPPED';
    embedColour = "#88aaff";
    
    announceColour = "#e41148";
    queueColour = "#ff9800";
    nowPlayingColour = "#4caf50";

    announcementSec = 2
    queueSec = 2;
    postSongSec = 2;

    startPhrases = [
        'STARTING IN', 'COMMENCING IN', 'INITIATING IN', 'COUNTDOWN FOR', 'TAKING OFF IN', 'EMBARKING IN', 'COMMENCEMENT IN', 'COMING AT YOU IN', 'PREPARING TO START IN',
        'COME ON AND SLAM AND WELCOME TO THE JAM IN', 'ENTERING THE RACE IN', 'ENTERING IN', 'MAKING NOISE IN', 'REDEFINING MUSIC IN', 'HELL YES IN', 'UNDER WAY IN', 'SIT TIGHT FOR',
        'PREPARE YOURSELVES FOR', 'MANIFESTING IN', 'GET READY FOR', 'PUSH PLAY IN', 'JOINING THE RACE IN', 'T-MINUS', 'ENTERING THE FRAY IN', 'PREPARE FOR LIFT-OFF IN',
        'YOU HAVE', 'HYPE INTENSIFYING FOR', 'STAND BY FOR', 'WASTING', 'QUEUE FOR', 'KICKING UP DUST IN', 'BEGINS IN', 'THE EXPERIENCE BEGINS IN', 'COUNTING DOWN FOR', 'WAITING FOR',
        'START IN', 'ENGINES ON, YOU HAVE', 'TAKING A QUICK BREAK FOR', 'BEGINNING IN', 'AUDIO START IN', 'INCOMING IN', 'PARTYING IN', 'DOING THIS ONE IN', 'HI, MY NAME IS',
        'ANTICIPATION BUILDING FOR', 'WE WILL START IN', 'WE WILL BEGIN IN', 'HOLD ON FOR', 'THE FUN BEGINS IN',
    ];

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
                    this.next(true);
                } else if (msg.content == "!prev") {
                    this.prev(true);
                } else if (msg.content == "!stop") {
                    this.stop();
                } else if (msg.content == "!list") {
                    this.list(msg.channel);
                } else if (msg.content == "!pause") {
                    this.pause();
                } else if (msg.content == "!resume") {
                    this.resume();
                }
            }
        });
    }

    async play(channel, startAt = 0) {

        this.playlist = await this.compilePlaylist(channel);        

        await this.stopSong();

        const voice = channel.guild.channels.cache.find(c => c.type === 'voice');
        let connection;
        try {
            connection = await voice.join();
        } catch (e) {
            console.log(e);
            return;
        }

        this.playback = new Playback(connection);

        this.state = 'PLAYING';

        this.textChannel = channel;

        this.playSong(startAt);

    }

    async stopSong() {
        if (this.playback && this.playback.dispatcher) {
            await this.playback.dispatcher.end();
        }
    }

    stop() {
        if (this.playback) {
            this.stopSong();
            this.state = 'STOPPED';
            this.currentSong = 0;
            this.playback.connection.disconnect();
            this.textChannel = null;
            this.client.user.setPresence({});
        }
    }

    async playSong(index, immediate) {
        console.log('play song', index);
        // if (this.state == 'PLAYING') {
        //     await this.stopSong();
        // }
        if (this.playback && this.textChannel) {
            if (index >= 0 && index < this.playlist.length) {
                this.currentSong = index;
                let song = this.playlist[index];

                this.state = 'INTRO';
                
                await this.textChannel.send(this.getAnnouncement(song, immediate));
                
                if (!immediate) {
                    await timeout(this.announcementSec * 1000);
                    await this.textChannel.send(this.getQueue());
                    await timeout(this.queueSec * 1000);
                }       
                                
                let playback = this.playback[song.type](song);

                if (!immediate) {
                    await this.textChannel.send(this.getAnnouncement(song, true));
                }

                this.state = 'PLAYING';
                
                this.client.user.setPresence({
                    activity: {
                        type: 'LISTENING',
                        name: song.toPlainString(),
                        url: song.url.href
                    }
                });
                
                await playback;

                await timeout(this.postSongSec * 1000);
                this.next();
            } else {
                this.stop();
            }
        }
    }

    getAnnouncement(song, immediate) {
        let poster = song.originalMessage.author.username;
        let output = this.getSongNo() + '. ' + song.toString();

        let embed = new MessageEmbed()
        .setColor(immediate ? this.nowPlayingColour : this.announceColour)
        .setTitle(immediate ? 'NOW PLAYING' : 'NEXT UP')
        .addField(poster, output);
        return embed;
    }

    getQueue() {
        let phrase = this.startPhrases[Math.floor(Math.random() * this.startPhrases.length)];
        let embed = new MessageEmbed()
        .setColor(this.queueColour)
        .setTitle(`${phrase} ${this.queueSec} SECONDS`);
        return embed;
    }

    next(immediate) {
        if (this.state == 'PLAYING' && this.currentSong < (this.playlist.length-1)) {
            this.playSong(this.currentSong + 1, immediate);
        }
    }

    prev(immediate) {
        if (this.state == 'PLAYING' && this.currentSong > 0) {
            this.playSong(this.currentSong - 1), immediate;
        }
    }

    skip() {
        this.next();
    }

    pause() {
        if (this.playback && this.playback.dispatcher) {
            this.playback.dispatcher.pause();
        }
    }

    resume() {
        if (this.playback && this.playback.dispatcher) {
            this.playback.dispatcher.resume();
        }
    }

    async list(channel) {
        if (!this.playlist || !this.playlist.length) {
            this.playlist = await this.compilePlaylist(channel);
        }
        //console.log(this.playlist);
        //let output = '';

        let embed = new MessageEmbed()
        .setColor(this.announceColour)
        .setTitle('TRACK LIST');
        
        for (let i in this.playlist) {
            let song = this.playlist[i];
            let poster = song.originalMessage.author.username;
            let songNo = Number(i) + 1;
            let output = songNo + '. ' + this.playlist[i].toString();
            if (this.state == 'PLAYING' && i == this.currentSong) {
                output += ' (NOW PLAYING)';
            }
            embed.addField(poster, output);
        }

        channel.send(embed);
    }

    async compilePlaylist(channel) {
        const messages = await this.getAllMessages(channel);

        let promises = [];
        messages.forEach(message => {
            let url = this.extractUrlFromMessage(message);
            if (url) {
                promises.push(PlaylistItem.create(url, message));
            }
        });
        let playlist = [];
        for (let promise of promises) {
            let song = await promise;
            if (song) {
                playlist.push(song);
            }
        }

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
            try {
                m = await channel.messages.fetch({before: lastMessage, limit: 100});
                lastMessage = m.last().id;
            } catch (e) {
                console.log(e);
                continue;
            }
            allMessages = allMessages.concat(m);
        } while (m.size == 100);

        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        return allMessages;
    }

    getSongNo() {
        return this.currentSong + 1;
    }

    extractUrlFromMessage(message) {
        let url;

        if (message.author.bot) {
            return null;
        }

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
}

module.exports = Playlist;