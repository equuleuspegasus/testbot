import ytdl from "ytdl-core-discord"
import axios from "axios"
import fs from "fs"
import path from "path"
import {
    getVoiceConnection,
    joinVoiceChannel,
    createAudioPlayer,
    AudioPlayerStatus,
    createAudioResource,
} from "@discordjs/voice"
import { ChannelType, Guild } from "discord.js"

export class Playback {
    bitrate = process.env.BITRATE || "auto"

    /**
     * @param { Guild } guild
     */
    constructor(guild) {
        this.guild = guild
    }

    getVoiceConnection() {
        let conn = getVoiceConnection(this.guild.id)

        if (!conn) {
            const voice = this.guild.channels.cache.find(
                (c) => c.type === ChannelType.GuildVoice
            )
            conn = joinVoiceChannel({
                channelId: voice.id,
                guildId: voice.guild.id,
                adapterCreator: voice.guild.voiceAdapterCreator,
            })
        }
        return conn
    }

    /**
     *
     * @returns { import('@discordjs/voice').AudioPlayer }
     */
    getAudioPlayer() {
        if (this.audioPlayer) {
            return this.audioPlayer
        }
        this.audioPlayer = createAudioPlayer()
        this.getVoiceConnection().subscribe(this.audioPlayer)

        return this.audioPlayer
    }

    close() {
        this.audioPlayer?.stop()
        this.getVoiceConnection().destroy()
    }

    async youtube(song) {
        const stream = await ytdl(song.url.href, { highWaterMark: 1 << 25 })
        return this.playStream(stream, {
            type: "opus",
            volume: false,
            highWaterMark: 256,
            fec: true,
        })
    }

    async file(song) {
        try {
            let filename = path.resolve(__basedir, "./temp")
            let temp = fs.createWriteStream(filename, { autoClose: true })
            let response = await axios({
                method: "get",
                url: song.url.href,
                responseType: "stream",
            })
            response.data.pipe(temp)

            await new Promise((resolve) => {
                response.data.on("end", resolve)
            })

            return this.playStream(filename, {
                volume: false,
                highWaterMark: 256,
                fec: true,
            })
        } catch (e) {
            console.log("error playing file")
            return new Promise((resolve) => resolve())
        }
    }

    async clyp(song) {
        const refreshClypData = async (song) => {
            try {
                let apiUrl = `https://api.clyp.it${song.url.pathname}`
                let response = await axios.get(apiUrl)
                let url = new URL(response.data.OggUrl)
                let expiry = url.searchParams.Expires
                song.expiry = Number(expiry) * 1000
                song.streamUrl = url.href
                return song
            } catch (e) {
                console.log(e)
                return false
            }
        }

        if (song.expiry < Date.now()) {
            song = await refreshClypData(song)
        }

        try {
            return this.playStream(song.streamUrl, {
                volume: false,
                highWaterMark: 256,
                fec: true,
            })
        } catch (e) {
            song = refreshClypData(song)
            return this.playStream(song.streamUrl, {
                volume: false,
                highWaterMark: 256,
                fec: true,
            })
        }
    }

    async whyp(song) {
        try {
            let filename = path.resolve(__basedir, "./temp")
            let temp = fs.createWriteStream(filename, { autoClose: true })
            let response = await axios({
                method: "get",
                url: song.streamUrl,
                responseType: "stream",
                headers: {
                    Referer: "https://whyp.it",
                },
            })
            response.data.pipe(temp)

            await new Promise((resolve) => {
                response.data.on("end", resolve)
            })

            return this.playStream(filename, {
                volume: false,
                highWaterMark: 256,
                fec: true,
            })
        } catch (e) {
            console.log("error playing file")
            return new Promise((resolve) => resolve())
        }
    }

    async soundcloud(song) {
        let url = `${song.streamUrl}?client_id=${process.env.SC_CLIENT_ID}`
        return this.playStream(url, { volume: false, highWaterMark: 256 })
    }

    async unsupported(song) {
        console.log("unsupported media type")
        return new Promise((resolve) => resolve())
    }

    playStream(url) {
        //this.dispatcher = this.connection.play(url, params)

        const player = this.getAudioPlayer()

        const res = createAudioResource(url)
        player.play(res)

        return new Promise((resolve, reject) => {
            player.on(AudioPlayerStatus.Idle, () => {
                console.log("finish")
                resolve()
            })
            player.on("error", () => {
                console.log("error")
                reject()
            })
            player.on("debug", (e) => {
                console.log("debug", e)
            })
        })
    }
}
