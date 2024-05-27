const storage = new Map(); // temporary storage implementation. We will replace it with Redis later

class TonConnectStorage {
    constructor(chatId) {
        this.chatId = chatId; // store chatId in the instance
    }

    getKey(key) {
        return this.chatId.toString() + key; // create unique keys for different users
    }

    async removeItem(key) {
        storage.delete(this.getKey(key));
    }

    async setItem(key, value) {
        storage.set(this.getKey(key), value);
    }

    async getItem(key) {
        return storage.get(this.getKey(key)) || null;
    }
}

module.exports = TonConnectStorage;
