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

    announcementSec = process.env.ANNOUNCE_SEC || 2;
    envQueueSec = process.env.QUEUE_SEC || 2;
    queueSec = process.env.QUEUE_SEC || 2;
    postSongSec = process.env.POST_SONG_SEC || 2;

    // dummy author object
    msgAuthor = {
        send: str => console.log(str)
    };

    startPhrases = [
        'STARTING IN', 'COMMENCING IN', 'INITIATING IN', 'COUNTDOWN FOR', 'TAKING OFF IN', 'EMBARKING IN', 'COMMENCEMENT IN', 'SWITCHING IT UP IN', 'PREPARING TO START IN', 'RE-ESTABLISHING 56K MODEM CONNECTION IN',
        'COME ON AND SLAM AND WELCOME TO THE JAM IN', 'ENTERING THE RACE IN', 'ENTERING IN', 'MAKING SOUNDS IN', 'HELL YES IN', 'UNDER WAY IN', 'SIT TIGHT FOR', 'FAINT YELLING FOR',
        'PREPARE YOURSELVES FOR', 'MANIFESTING IN', 'GET READY!!! FOR', 'PUSH PLAY IN', 'JOINING THE RACE IN', 'T-MINUS', 'ENTERING THE FRAY IN', 'PREPARE FOR LIFT-OFF IN', 'SOMEBODY RECOMMEND ME A GOOD BOOK TO READ IN',
        'YOU HAVE', 'HYPE INTENSIFYING FOR', 'STAND BY FOR', 'WASTING', 'QUEUE FOR', 'KICKING UP DUST IN', 'BEGIN IN', 'PRESS PLAY ON TAPE IN', 'THE EXPERIENCE BEGINS IN', 'COUNTING DOWN FOR', 'WAITING FOR',
        'START IN', 'ENGINES ON, YOU HAVE', 'TAKING A QUICK BREAK FOR', 'BEGINNING IN', 'AUDIO START IN', 'INCOMING IN', 'PARTYING IN', 'DOING THIS ONE IN', 'HI, MY NAME IS', 'FACESCRUNCH FOR', 'HAVING FUN IN',
        'ANTICIPATION BUILDING FOR', 'WE WILL START IN', 'IT WILL BEGIN IN', 'HOLD ON FOR', 'THE FUN BEGINS IN', 'STOPPING TIME FOR', 'COMMENCING COUNTDOWN:', 'LIFT-OFF IN', 'ARRIVING LATE TO THE PARTY IN',
        'lower case letters for', 'FOCUSING ENERGY FOR', 'MEDITATING FOR', 'ALLOW', 'IDLE ANIMATION FOR', 'PRETENDING TO BE A TREE FOR', 'PAUSING FOR', 'STARTING UP IN', 'ACTIVATION!!! IN', 'DISPENSING FRESH JUICE IN', 'CHAINSAW PIT REOPENING IN',
        'ROTATING FOR', 'RETICULATING SPLINES FOR', 'LAUNCHING THE MISSILES IN', 'DAYDREAMING FOR', 'ROWING A LITTLE BOAT FOR', 'QUARANTINING FOR', 'EXPLAINING THE PLOT FOR', 'UHHHHHHHHHH',
        'お前はもう死んでいる', 'STUCK IN TIME LOOP FOR', 'OWO             ','MIKU\'S GETTING PUMPED!!! ', 'PLOTTING FOR', 'FIXING BUGS FOR', 'SOFT PIANO CHORDS FOR', 'PLEASE INSERT DISK 2, YOU HAVE',
	'SYSTEM REBOOT IN', 'HORSE NOISES HAPPENING IN', 'BLOCKING TRAFFIC IN', 'PRETENDING TO BE A GHOST FOR','Hey, I know that today was tough. I know that you’re going through a lot lately, but you have to listen to me. You’re doing fine. You’re amazing, and you are noticed and loved. Keep it up, ok?', 'NO FUSS FOR', 'GIRL GAMING MOMENT IN', 'GAMER LANGUAGE ACTIVATING IN'
    ];

    emoji = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🅰️','🅱️','🅾️','🔴','🟠','🟡','🟢','🔵','🟣','🟤','⚫','⚪',
    '🔷','🔶','⬆️','↗️','➡️','↘️','⬇️','↙️','⬅️','↖️','♉','♐','♊','♑','♌','♎','♓','♋','♒','♈','♍','♏','⛎','🐺',
    '🦊','🦝','🐴','🦄','🐍','🐂','🐏','🦂','🦀','🐉','🐎','🏎️','⚽','⚾','🥎','🏀','🏐','🎹','🎺','🎻','🎬','🎮','🚲','🔥',
    '💧','🚀','🏁','🌂','🌐','🌎','☀️','🌕','🌘','🌗','🪐','⭐','✨','🌊','🌴','🌳','🌱','🍂','🍁','🌸'];

    constructor(client) {
        this.client = client;
        this.init();
    }

    init() {
        this.client.on('message', msg => {
            if (msg.channel.type == "dm" ||  msg.author.bot) {
                return;
            }
            if (process.env.ROLE && !msg.member.roles.cache.some(role => role.name == process.env.ROLE)) {
                return;
            }

            this.msgAuthor = msg.author;

            if (msg.content.startsWith("!play")) {
                msg.react('🏎️');
                let parts = msg.content.split(/\s+/);
                let index = Number(parts[1]);
                index = Number.isNaN(index) ? 0 : index-1;
                this.play(msg.channel, index);
            } else if (msg.content == "!next") {
                msg.react('🏎️');
                this.next(true);
            } else if (msg.content == "!prev") {
                msg.react('🏎️');
                this.prev(true);
            } else if (msg.content == "!stop") {
                msg.react('🏎️');
                this.stop();
            } else if (msg.content == "!list") {
                msg.react('🏎️');
                this.list(msg.channel);
            } else if (msg.content == "!pause") {
                msg.react('🏎️');
                this.pause();
            } else if (msg.content == "!resume") {
                msg.react('🏎️');
                this.resume();
            } else if (msg.content == "!vote") {
                msg.react('🏎️');
                this.vote(msg.channel);
            } else if (msg.content == "!skip") {
                msg.react('🏎️');
                this.skip();
            }       
        });
    }

    async play(channel, startAt = 0) {
        this.msgAuthor.send('PLAY')

        this.playlist = await this.compilePlaylist(channel);
        this.msgAuthor.send('Starting playback...');     

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
            this.client.user.setPresence({clientStatus: 'online'});
        }
    }

    getQueueSec() {
        let queueSec = this.envQueueSec * 1;
        let luckyNumber = Math.random();
        if (luckyNumber > 0.99) {
            queueSec += 2;
        } else if (luckyNumber > 0.95) {
            queueSec += 1;
        }
        return queueSec;
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

                this.queueSec = this.getQueueSec();
                
                await this.textChannel.send(this.getAnnouncement(song, immediate));

                this.client.user.setPresence({
                    activity: {
                        type: 'LISTENING',
                        name: song.toPlainString(),
                        url: song.url.href
                    }
                });
                
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
               
                await playback;

                await timeout(this.postSongSec * 1000);
                this.next();
            } 
        }
    }

    getAnnouncement(song, immediate) {
        let poster = song.getPoster();
        let output = this.getSongNo() + '. ' + song.toString();

        let embed = new MessageEmbed().setThumbnail(song.img)
        .setColor(immediate ? this.nowPlayingColour : this.announceColour)
        .setTitle(immediate ? 'NOW PLAYING' : 'NEXT UP')
        .addField(poster, output);
        if (!immediate && song.shortDescription()) {
            embed.addField('Description', song.shortDescription());
        }
        
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
        if (this.state == 'PLAYING') {
            if (this.currentSong < (this.playlist.length-1)) {
                this.playSong(this.currentSong + 1, immediate);
            } else {
                let embed = new MessageEmbed()
                .setColor(this.announceColour)
                .setTitle('🏎️ THANK YOU FOR LISTENING, SEE YOU AT THE NEXT RACE 🏎️');

                this.textChannel.send(embed);
                
                this.stop();
            }
        }
    }

    prev(immediate) {
        if (this.state == 'PLAYING' && this.currentSong > 0) {
            this.playSong(this.currentSong - 1, immediate);
        }
    }

    skip() {
        this.pause();
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
        //if (!this.playlist || !this.playlist.length) {
        this.playlist = await this.compilePlaylist(channel);

        //}
        //console.log(this.playlist);
        //let output = '';

        this.msgAuthor.send('Generating playlist embed(s)...');

        let embed = new MessageEmbed()
        .setColor(this.announceColour)
        .setTitle("🏎️ WELCOME RACERS 🏎️");
        
        let embedCount = 0;
        for (let i in this.playlist) {
          
            embedCount++; 

            let song = this.playlist[i];
            let songNo = Number(i) + 1;
            let output = `${songNo}. ${song.toString()}`;
          
            if (this.state == 'PLAYING' && i == this.currentSong) {
                output += ' 🏎️ 🎵';
            }

            if (embed.length > 5000 || embedCount > 25) {
                console.log('length exceeded');
                embedCount = 0;
                await channel.send(embed);
                embed = new MessageEmbed()
                .setColor(this.announceColour)
                .setTitle('🏎️ TRACK LIST (cont) 🏎️');
            }

            embed.addField(song.getPoster(), output);
        }


        channel.send(embed);
        this.msgAuthor.send('All done! Happy racing!');

    }

    async vote(channel) {
        if (!this.playlist || !this.playlist.length) {
            this.playlist = await this.compilePlaylist(channel);
        }
        let embed = new MessageEmbed()
        .setColor(this.announceColour)
        .setTitle('🏁 REACT TO VOTE 🏁');

        for (let i in this.playlist) {
            let song = this.playlist[i];
            
            let output = `${this.emoji[i]} ${song.toString()}`;
            embed.addField(song.getPoster(), output);
        }

        let msg = await channel.send(embed);
        for (let i in this.playlist) {
            await msg.react(this.emoji[i]);
        }
    }

    getSongPoster(song) {
        
    }

    async compilePlaylist(channel) {

        this.msgAuthor.send('I am going to compile the playlist now! Hang on while I collect all the messages...');

        const messages = await this.getAllMessages(channel);

        this.msgAuthor.send(`Found **${messages.size}** messages in channel ${channel.name}! Searching for URLs...`);

        let promises = [];
        messages.forEach(message => {
            let url = this.extractUrlFromMessage(message);
            if (url) {
                promises.push(PlaylistItem.create(url, message, this.msgAuthor));
            }
        });
        let playlist = [];

        this.msgAuthor.send(`Finished scraping URLs, now give me a few more moments to build the playlist.`);
        for (let promise of promises) {
            let song = await promise;
            if (song) {
                playlist.push(song);
            }
        }
        this.msgAuthor.send(`Playlist complete! There are **${playlist.length}** entries.`);
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
