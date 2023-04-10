import dotenv from "dotenv"
import { Client, GatewayIntentBits, Partials } from "discord.js"
import { Playlist } from "./src/playlist.js"
import { emoji, startPhrases } from "./src/flavourtext.js"
import { fileURLToPath } from "url"
import { dirname } from "path"
import { generateDependencyReport } from "@discordjs/voice"

console.log(generateDependencyReport())

dotenv.config()

const client = new Client({
    intents: [
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.GuildMember,
        Partials.User,
    ],
})

global.__basedir = dirname(fileURLToPath(import.meta.url))

client.on("ready", () => {
    console.log("Logged in as " + client.user.tag)
})

new Playlist(client, startPhrases, emoji)

client.login(process.env.TOKEN)
