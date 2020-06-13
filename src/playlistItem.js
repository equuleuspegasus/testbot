const mm = require('music-metadata');
const https = require("https");
const fs = require('fs');
const ytdl = require('ytdl-core-discord');

class PlaylistItem {
    constructor(url, type, fileinfo, originalMessage) {
        this.url = url;
        this.originalMessage = originalMessage;
        this.type = type;
        this.artist = fileinfo.artist;
        this.title = fileinfo.title;
        this.description = fileinfo.description;
    }

    static async create(url, originalMessage) {
        let type;
        let path = url.pathname;
        let fileinfo = {};
        if (path.endsWith('.mp3') || path.endsWith('.ogg') || path.endsWith('.aac') || path.endsWith('.webm')) {
            type = 'file';
            let filename = 'temp' + (Math.floor(Math.random()*100000000000)).toString(16);
            let temp = fs.createWriteStream(filename);
            let metadata = await new Promise((resolve, reject) => {
                https.get(url.href, async response => {
                    response.pipe(temp);
                    let metadata = await mm.parseStream(fs.createReadStream(filename));
                    fs.unlink(filename, err => {
                        if (err) {
                            console.log(err);
                        }
                    });
                    resolve(metadata);
                });
            });            

            fileinfo.artist = metadata.common.artist || metadata.common.albumartist || originalMessage.author.username;
            fileinfo.title = metadata.common.title || originalMessage.attachments.first().name;
            fileinfo.description = metadata.comment;

        } else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
            type = 'youtube';
            let info = await ytdl.getInfo(url.href);
            fileinfo.title = info.title; 
        } else {
            //type = 'unsupported';
            return null;
        }

        return new PlaylistItem(url, type, fileinfo, originalMessage);
    }

    toString() {
        if (this.type == 'file') {
            return `[${this.artist} - ${this.title}](${this.url.href} '${this.type} link')`;
        } else if (this.type == 'youtube') {
            return `[${this.title}](${this.url.href} '${this.type} link')`;
        }
    }
}

module.exports = PlaylistItem;