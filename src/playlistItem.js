const mm = require('music-metadata');
const https = require("https");
const fs = require('fs');
const ytdl = require('ytdl-core-discord');
const path = require('path');
const {makeTokenizer} = require('@tokenizer/http');
const axios = require('axios');
const util = require('util');

class PlaylistItem {

    constructor(url, type, fileinfo, originalMessage) {
        this.url = url;
        this.originalMessage = originalMessage;
        this.type = type;

        Object.keys(fileinfo).forEach((k) => {
            this[k] = fileinfo[k];
        })
    }

    static async create(url, originalMessage, msgAuthor) {
        let type;
        let fileinfo = {};

        const tryGetUrl = async (url) => {
            let response;
            let attempts = 0;
            while (!response && attempts < 3) {
                try { 
                    response = await axios.get(url);
                } catch(e) {
                    console.log(e);
                    attempts++;
                }
            }
            if (!response) {
                return null;
            }
            return response;
        }

        if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
            type = 'youtube';

            if (url.pathname.startsWith('/channel/') || url.pathname.startsWith('/user/')) {
                return null;
            }

            if (url.hostname.includes('youtu.be')) {
                let id = url.pathname.replace(/^\/+/, '');
                if (!id) {
                    return null;
                }
                url = new URL('https://www.youtube.com/watch?v='+id);
            }

            let info;
            try {
                info = await ytdl.getBasicInfo(url.href);
            } catch (error) {
                console.log(error);
                msgAuthor.send(`couldn't get youtube data from \`${url.href}\`...`);
                return null;
            }

            info = info.videoDetails;

            fileinfo.title = info.title; 
            fileinfo.description = info.description;
            fileinfo.duration = Number(info.lengthSeconds);
            fileinfo.img = info.author.thumbnails[0].url;
        } else if (url.hostname.includes('clyp.it')) {
            type = 'clyp';

            let response = await tryGetUrl(`https://api.clyp.it${url.pathname}`);

            if (!response) {
                console.log('failed to get clyp data');
                msgAuthor.send(`couldn't get clyp data from ${url.href}...`);
                return null;
            }
            let data = response.data;
            fileinfo.title = data.Title;
            fileinfo.description = data.Description;
            fileinfo.duration = data.Duration;
            fileinfo.artist = PlaylistItem.getNickname(originalMessage);
            fileinfo.img = data.ArtworkPictureUrl;
            fileinfo.streamUrl = data.OggUrl;
            let expiry = (new URL(data.OggUrl)).searchParams.Expires;
            fileinfo.expiry = Number(expiry) * 1000;

        } else if (url.hostname.includes('whyp.it')) {
            type = 'whyp';

            let slug = url.pathname.split('/').pop();
            let response = await tryGetUrl(`https://api.whyp.it/api/tracks/${slug}`);
            if (!response) {
                console.log('failed to get whyp data');
                msgAuthor.send(`couldn't get whyp data from \`${url.href}\`...`);
                return null;
            }
            let data = response.data.track;
            fileinfo.title = data.title;
            fileinfo.description = data.description;
            fileinfo.duration = Number(data.duration);
            
            if (data.user) {
                fileinfo.artist = data.user.username;
                fileinfo.img = data.user.avatar;
            } else {
                fileinfo.artist = PlaylistItem.getNickname(originalMessage);
            }

            fileinfo.streamUrl = data.audio_url;

        } else if (url.hostname.includes('soundcloud.com')) {
            type = 'soundcloud';

            let response = await tryGetUrl(`http://api.soundcloud.com/resolve.json?url=${encodeURIComponent(url.href)}&client_id=${process.env.SC_CLIENT_ID}`);
            if (!response) {
                console.log('failed to get soundcloud data');
                msgAuthor.send(`couldn't get soundcloud data from \`${url.href}\`...`);
                return null;
            }
            let data = response.data;
            fileinfo.title = data.title;
            fileinfo.artist = data.user.username;
            fileinfo.description = data.description;
            fileinfo.streamUrl = data.stream_url;
            fileinfo.duration = data.duration / 1000;
            fileinfo.img = data.artwork_url || data.user.avatar_url; 
         
        } else {
            type = 'file';
            let httpTokenizer;
            try {
                httpTokenizer = await makeTokenizer(url.href);
            } catch (e) {
                console.log(e);
                return null;
            }
            let metadata;
            let attempts = 0;
            while (!metadata && attempts < 3) {
                try {
                    metadata = await mm.parseFromTokenizer(httpTokenizer);
                    break;
                } catch(e) {
                    console.log(e);
                    attempts++;
                }
            }
            if (!metadata) {
                // probably not an audio file
                console.log('audio not found');
                msgAuthor.send(`\`${url.href}\` doesn't seem to be audio...`);
                return null;
            }

            fileinfo.artist = metadata.common.artist || metadata.common.albumartist;

            if (!fileinfo.artist) {
                fileinfo.artist = PlaylistItem.getNickname(originalMessage);
            }

            fileinfo.title = metadata.common.title || url.pathname.split('/').pop() || 'untitled'; //originalMessage.attachments.first().name;
            fileinfo.description = metadata.comment;
            fileinfo.duration = metadata.format.duration;

        }

        return new PlaylistItem(url, type, fileinfo, originalMessage);
    }
    
    static getMimeType(p) {
        let ext = p.match(/.*\.(.*)/)[1];
        switch (ext) {
            case 'mp3':
                return 'audio/mpeg';
            case 'ogg':
                return 'audio/ogg';
            case 'webm':
                return 'audio/webm';
            case 'aac':
                return 'audio/aac';
            default:
                return null;
        }
    }

    static getNickname(message) {
        if (message.member && message.member.nickname) {
            return message.member.nickname;
        } else if (message.author && message.author.username) {
            return message.author.username;
        } else {
            return 'unknown';
        }
    }

    msDuration() {
        if (!this.duration) {
            return 'duration unknown';
        }
        let seconds = Math.floor(this.duration % 60).toString().padStart(2, '0');
        let minutes = Math.floor(this.duration / 60);
        return `${minutes}:${seconds}`;
    }

    toString() {
        switch (this.type) {
            case 'youtube':
            case 'clyp':
                return `[${this.title}](${this.url.href} '${this.url.href}') (${this.msDuration()})`;
            case 'soundcloud':
            case 'whyp':
                return `[${this.artist} - ${this.title}](${this.url.href} '${this.url.href}') (${this.msDuration()})`;
            case 'file':
            default:
                return `[${this.artist} - ${this.title}](${this.url.href} '${this.type} link') (${this.msDuration()})`;
        }
    }

    shortDescription() {
        try {
            let description = this.description;
            if (!description) {
                return '';
            }
            if (typeof description == 'array') {
                description = description[0];
            }
            if (Array.from(description).length > 280) {
                description = description.substring(0, 280);
                description = description.match(/(^.*\b)\s\b.*$/)[1];
                description += '...';
            }
            return description;
        } catch (e) {
            let description = this.description;
            if (Array.from(description).length > 280) {
                description = description.substring(0, 280);
                description += '...';
            }
            return description;
        }
    }

    toPlainString() {
        switch (this.type) {
            case 'youtube':
            case 'clyp':
                return `${this.title}`;
            case 'file':
            case 'soundcloud':
            case 'whyp':
            default:
                return `${this.artist} - ${this.title}`;
        }
    }

    getPoster() {
        return PlaylistItem.getNickname(this.originalMessage);
    }
}

module.exports = PlaylistItem;