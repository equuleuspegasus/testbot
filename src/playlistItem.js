const mm = require('music-metadata');
const https = require("https");
const fs = require('fs');
const ytdl = require('ytdl-core-discord');
const path = require('path');
const {makeTokenizer} = require('@tokenizer/http');
const axios = require('axios');

class PlaylistItem {

    constructor(url, type, fileinfo, originalMessage) {
        this.url = url;
        this.originalMessage = originalMessage;
        this.type = type;
        this.artist = fileinfo.artist;
        this.title = fileinfo.title;
        this.description = fileinfo.description;
        this.duration = fileinfo.duration;
    }

    static async create(url, originalMessage) {
        let type;
        let p = url.pathname;
        let fileinfo = {};
        if (p.endsWith('.mp3') || p.endsWith('.ogg') || p.endsWith('.aac') || p.endsWith('.webm')) {
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

            fileinfo.artist = metadata.common.artist || metadata.common.albumartist || originalMessage.author.username;
            fileinfo.title = metadata.common.title || originalMessage.attachments.first().name;
            fileinfo.description = metadata.comment;
            fileinfo.duration = metadata.format.duration;

        } else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
            type = 'youtube';
            let info = await ytdl.getBasicInfo(url.href);
            fileinfo.title = info.title; 
            fileinfo.description = info.description;
            fileinfo.duration = Number(info.length_seconds);
        } else if (url.hostname.includes('clyp.it')) {
            type = 'clyp';
            let response;
            try { 
                let apiUrl = `https://api.clyp.it${url.pathname}`;
                response = await axios.get(apiUrl);
            } catch(e) {
                console.log(e);
                return null;
            }
            let data = response.data;
            fileinfo.title = data.Title;
            fileinfo.description = data.Description;
            fileinfo.duration = data.Duration;
            fileinfo.artist = originalMessage.author.username;
            fileinfo.img = data.ArtworkPictureUrl;
        }
        
        else {
            //type = 'unsupported';
            return null;
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
        if (this.type == 'file') {
            return `[${this.artist} - ${this.title}](${this.url.href} '${this.type} link') (${this.msDuration()})`;
        } else if (this.type == 'youtube' || this.type == 'clyp') {
            return `[${this.title}](${this.url.href} '${this.type} link') (${this.msDuration()})`;
        }
    }

    toPlainString() {
        if (this.type == 'file') {
            return `${this.artist} - ${this.title}`;
        } else if (this.type == 'youtube' || this.type == 'clyp') {
            return `${this.title}`;
        }
    }
}

module.exports = PlaylistItem;