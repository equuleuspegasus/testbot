class PlaylistItem {
    constructor(url, type, originalMessage) {
        this.url = url;
        this.originalMessage = originalMessage;
        this.type = type;
    }

    static create(url, originalMessage) {
        let type;
        if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.ogg')) {
            type = 'file';
        } else if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
            type = 'youtube';
        } else {
            type = 'unsupported';
        }

        return new PlaylistItem(url, type, originalMessage);
    }

    toString() {
        return this.url;
    }
}

module.exports = PlaylistItem;