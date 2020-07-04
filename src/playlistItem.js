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

    static async create(url, originalMessage) {
        let type;
        let p = url.pathname;
        let fileinfo = {};
        if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
            type = 'youtube';

            if (url.hostname.includes('youtu.be')) {
                let id = url.pathname.replace(/^\/+/, '');
                if (!id) {
                    return null;
                }
                url = new URL('https://www.youtube.com/watch?v='+id);
            }

            let info = await ytdl.getBasicInfo(url.href);
            fileinfo.title = info.title; 
            fileinfo.description = info.description;
            fileinfo.duration = Number(info.length_seconds);
            fileinfo.img = info.author.avatar;
        } else if (url.hostname.includes('clyp.it')) {
            type = 'clyp';
            let response;
            let attempts = 0;
            while (!response && attempts < 3) {
                try { 
                    let apiUrl = `https://api.clyp.it${url.pathname}`;
                    response = await axios.get(apiUrl);
                } catch(e) {
                    console.log(e);
                    attempts++;
                }
            }
            if (!response) {
                console.log('failed to get clyp data');
                return null;
            }
            let data = response.data;
            fileinfo.title = data.Title;
            fileinfo.description = data.Description;
            fileinfo.duration = data.Duration;
            fileinfo.artist = originalMessage.author.username;
            fileinfo.img = data.ArtworkPictureUrl;
            fileinfo.streamUrl = data.OggUrl;
            let expiry = (new URL(data.OggUrl)).searchParams.Expires;
            fileinfo.expiry = Number(expiry) * 1000;

        } else if (url.hostname.includes('soundcloud.com')) {
            type = 'soundcloud';

            let response;
            let attempts = 0;
            while (!response && attempts < 3) {
                try {
                    let apiUrl = `http://api.soundcloud.com/resolve.json?url=${encodeURIComponent(url.href)}&client_id=${process.env.SC_CLIENT_ID}`;
                    response = await axios.get(apiUrl);
                } catch(e) {
                    console.log(e);
                    attempts++;
                }
            }
            if (!response) {
                console.log('failed to get soundcloud data');
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
                return null;
            }

            fileinfo.artist = metadata.common.artist || metadata.common.albumartist || originalMessage.member.nickname || originalMessage.author.username;
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
            default:
                return `${this.artist} - ${this.title}`;
        }
    }

    getPoster() {
        return this.originalMessage.member.nickname || this.originalMessage.author.username;
    }
}

module.exports = PlaylistItem;