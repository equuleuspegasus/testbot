import { Collection } from "@discordjs/collection"
import { PlaylistItem } from "./playlistitem.js"
import { Playback } from "./playback.js"
import { ChannelType, EmbedBuilder, Guild } from "discord.js"
import { timeout } from "./timeout.js"

export class Playlist {
    client
    playlist
    textChannel
    currentSong = 0
    state = "STOPPED"
    embedColour = "#88aaff"

    announceColour = "#e41148"
    queueColour = "#ff9800"
    nowPlayingColour = "#4caf50"

    announcementSec = process.env.ANNOUNCE_SEC || 2
    envQueueSec = process.env.QUEUE_SEC || 2
    queueSec = process.env.QUEUE_SEC || 2
    postSongSec = process.env.POST_SONG_SEC || 2

    startPhrases
    emoji

    // dummy author object
    msgAuthor = {
        send: (str) => console.log(str),
    }

    /**
     * @param { import('discord.js').Client } client
     * @param { string[] } startPhrases
     * @param { string[] } emoji
     */
    constructor(client, startPhrases, emoji) {
        this.client = client
        this.startPhrases = startPhrases
        this.emoji = emoji
        this.init()
    }

    /**
     * @param { Guild } guild
     */
    getRandomGuildEmoji(guild) {
        return guild.emojis.cache.random()
    }

    /**
     * @param { Guild } guild
     */
    getMikuDabEmoji(guild) {
        return (
            guild.emojis.cache.find((emoji) => emoji.name === "Mikudab") ||
            this.getRandomGuildEmoji()
        )
    }

    init() {
        this.client.on("messageCreate", (msg) => {
            if (msg.channel.type !== ChannelType.GuildText || msg.author.bot) {
                return
            }
            if (
                process.env.ROLE &&
                !msg.member.roles.cache.some(
                    (role) => role.name == process.env.ROLE
                )
            ) {
                return
            }

            this.msgAuthor = msg.author

            const emoji = this.getRandomGuildEmoji(msg.guild)

            if (msg.content.startsWith("!play")) {
                msg.react(emoji)
                if (this.state === "PLAYING") {
                    this.resume()
                } else {
                    let parts = msg.content.split(/\s+/)
                    let index = Number(parts[1])
                    index = Number.isNaN(index) ? 0 : index - 1
                    this.play(msg.channel, index)
                }
            } else if (msg.content == "!next") {
                msg.react(emoji)
                this.next(true)
            } else if (msg.content == "!prev") {
                msg.react(emoji)
                this.prev(true)
            } else if (msg.content == "!stop") {
                msg.react(emoji)
                this.stop()
            } else if (msg.content == "!list") {
                msg.react(emoji)
                this.list(msg.channel)
            } else if (msg.content == "!pause") {
                msg.react(emoji)
                this.pause()
            } else if (msg.content == "!resume") {
                msg.react(emoji)
                this.resume()
            } else if (msg.content == "!vote") {
                msg.react(emoji)
                this.vote(msg.channel)
            } else if (msg.content == "!skip") {
                msg.react(emoji)
                this.skip()
            }
        })
    }

    /**
     *
     * @param { import("discord.js").GuildTextBasedChannel } channel
     * @param { Number } startAt
     * @returns
     */
    async play(channel, startAt = 0) {
        this.msgAuthor.send("PLAY")

        this.playlist = await this.compilePlaylist(channel)
        this.msgAuthor.send("Starting playback...")

        await this.stopSong()

        this.playback = new Playback(channel.guild)
        this.playback.getVoiceConnection()

        this.state = "PLAYING"

        this.textChannel = channel

        this.playSong(startAt)
    }

    async stopSong() {
        if (this.playback && this.playback.dispatcher) {
            await this.playback.dispatcher.end()
        }
    }

    stop() {
        if (this.playback) {
            this.stopSong()
            this.state = "STOPPED"
            this.currentSong = 0
            this.playback.close()
            this.textChannel = null
            this.client.user.setPresence({ clientStatus: "online" })
        }
    }

    getQueueSec() {
        let queueSec = this.envQueueSec * 1
        let luckyNumber = Math.random()
        if (luckyNumber > 0.99) {
            queueSec += 2
        } else if (luckyNumber > 0.95) {
            queueSec += 1
        }
        return queueSec
    }

    async playSong(index, immediate) {
        console.log("play song", index)
        // if (this.state == 'PLAYING') {
        //     await this.stopSong();
        // }
        if (this.playback && this.textChannel) {
            if (index >= 0 && index < this.playlist.length) {
                this.currentSong = index
                let song = this.playlist[index]

                this.state = "INTRO"

                this.queueSec = this.getQueueSec()

                await this.textChannel.send({
                    embeds: [this.getAnnouncement(song, immediate)],
                })

                this.client.user.setPresence({
                    activities: [
                        {
                            type: "LISTENING",
                            name: song.toPlainString(),
                            url: song.url.href,
                        },
                    ],
                })

                if (!immediate) {
                    await timeout(this.announcementSec * 1000)
                    await this.textChannel.send({ embeds: [this.getQueue()] })
                    await timeout(this.queueSec * 1000)
                }

                let playback = this.playback[song.type](song)

                if (!immediate) {
                    await this.textChannel.send({
                        embeds: [this.getAnnouncement(song, true)],
                    })
                }

                this.state = "PLAYING"

                await playback

                await timeout(this.postSongSec * 1000)
                this.next()
            }
        }
    }

    getAnnouncement(song, immediate) {
        let poster = song.getPoster()
        let output = this.getSongNo() + ". " + song.toString()

        let embed = new EmbedBuilder()
            .setThumbnail(song.img)
            .setColor(immediate ? this.nowPlayingColour : this.announceColour)
            .setTitle(immediate ? "NOW PLAYING" : "NEXT UP")
            .addFields({ name: poster, value: output })
        if (!immediate && song.shortDescription()) {
            embed.addFields({
                name: "Description",
                value: song.shortDescription(),
            })
        }

        return embed
    }

    getQueue() {
        let phrase =
            this.startPhrases[
                Math.floor(Math.random() * this.startPhrases.length)
            ]
        let embed = new EmbedBuilder()
            .setColor(this.queueColour)
            .setTitle(`${phrase} ${this.queueSec} SECONDS`)
        return embed
    }

    next(immediate) {
        if (this.state == "PLAYING") {
            if (this.currentSong < this.playlist.length - 1) {
                this.playSong(this.currentSong + 1, immediate)
            } else {
                const emoji = this.getMikuDabEmoji(this.textChannel.guild)
                let embed = new EmbedBuilder()
                    .setColor(this.announceColour)
                    .setTitle(
                        emoji.toString() +
                            " THANK YOU FOR LISTENING, SEE YOU AT THE NEXT RACE " +
                            emoji.toString()
                    )

                this.textChannel.send({ embeds: [embed] })

                this.stop()
            }
        }
    }

    prev(immediate) {
        if (this.state == "PLAYING" && this.currentSong > 0) {
            this.playSong(this.currentSong - 1, immediate)
        }
    }

    skip() {
        this.pause()
        this.next()
    }

    pause() {
        if (this.playback) {
            this.playback.getAudioPlayer()?.pause()
        }
    }

    resume() {
        if (this.playback) {
            this.playback.getAudioPlayer()?.unpause()
        }
    }

    /**
     *
     * @param { import("discord.js").GuildTextBasedChannel } channel
     */
    async list(channel) {
        //if (!this.playlist || !this.playlist.length) {
        this.playlist = await this.compilePlaylist(channel)

        this.msgAuthor.send("Generating playlist embed(s)...")

        const emoji = this.getRandomGuildEmoji(channel.guild)

        let embed = new EmbedBuilder()
            .setColor(this.announceColour)
            .setTitle(emoji.toString() + " WELCOME RACERS " + emoji.toString())

        let embedCount = 0
        for (let i in this.playlist) {
            embedCount++

            let song = this.playlist[i]
            let songNo = Number(i) + 1
            let output = `${songNo}. ${song.toString()}`

            if (this.state == "PLAYING" && i == this.currentSong) {
                output += " 🏎️ 🎵"
            }

            if (embed.length > 5000 || embedCount > 25) {
                console.log("length exceeded")
                embedCount = 0
                await channel.send({ embeds: [embed] })
                embed = new EmbedBuilder()
                    .setColor(this.announceColour)
                    .setTitle(
                        emoji.toString() +
                            " TRACK LIST (cont) " +
                            emoji.toString()
                    )
            }

            embed.addFields({ name: song.getPoster(), value: output })
        }

        channel.send({ embeds: [embed] })
        this.msgAuthor.send("All done! Happy racing!")
    }

    async vote(channel) {
        if (!this.playlist || !this.playlist.length) {
            this.playlist = await this.compilePlaylist(channel)
        }
        let embed = new EmbedBuilder()
            .setColor(this.announceColour)
            .setTitle("🏁 REACT TO VOTE 🏁")

        for (let i in this.playlist) {
            let song = this.playlist[i]

            let output = `${this.emoji[i]} ${song.toString()}`
            embed.addFields({ name: song.getPoster(), value: output })
        }

        let msg = await channel.send({ embeds: [embed] })
        for (let i in this.playlist) {
            await msg.react(this.emoji[i])
        }
    }

    getSongPoster(song) {}

    async compilePlaylist(channel) {
        this.msgAuthor.send(
            "I am going to compile the playlist now! Hang on while I collect all the messages..."
        )

        const messages = await this.getAllMessages(channel)

        this.msgAuthor.send(
            `Found **${messages.size}** messages in channel ${channel.name}! Searching for URLs...`
        )

        let promises = []
        messages.forEach((message) => {
            let url = this.extractUrlFromMessage(message)
            if (url) {
                promises.push(PlaylistItem.create(url, message, this.msgAuthor))
            }
        })
        let playlist = []

        this.msgAuthor.send(
            `Finished scraping URLs, now give me a few more moments to build the playlist.`
        )
        for (let promise of promises) {
            let song = await promise
            if (song) {
                playlist.push(song)
            }
        }
        this.msgAuthor.send(
            `Playlist complete! There are **${playlist.length}** entries.`
        )
        return playlist
    }

    async getAllMessages(channel) {
        if (!channel) {
            throw new Error("no channel specified")
        }

        let allMessages = new Collection()
        let lastMessage = null
        let m = null
        do {
            try {
                m = await channel.messages.fetch({
                    before: lastMessage,
                    limit: 100,
                })
                lastMessage = m.last().id
            } catch (e) {
                console.log(e)
                continue
            }
            allMessages = allMessages.concat(m)
        } while (m.size == 100)

        allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        return allMessages
    }

    getSongNo() {
        return this.currentSong + 1
    }

    extractUrlFromMessage(message) {
        let url

        if (message.author.bot) {
            return null
        }

        // return attachment url if any
        if (message.attachments.size) {
            let attachment = message.attachments.first()
            url = this.getUrl(attachment.proxyURL)
            if (!url) {
                url = this.getUrl(attachment.url)
            }
        }
        if (url) {
            return url
        }

        // else return url from message body, if any
        let msgParts = message.content.split(" ")

        for (let token of msgParts) {
            url = this.getUrl(token)
            if (url) {
                break
            }
        }

        return url
    }

    getUrl(str) {
        try {
            return new URL(str)
        } catch (e) {
            return null
        }
    }
}
