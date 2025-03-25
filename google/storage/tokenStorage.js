const fs = require('fs');
const path = require('path');

class TokenStorage {
    constructor() {
        this.storagePath = path.join(__dirname, '../../data/google_tokens');
        this.ensureDirectory();
    }

    ensureDirectory() {
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
            console.log(`Created token storage directory: ${this.storagePath}`);
        }
    }

    async saveTokens(userId, data) {
        const filePath = path.join(this.storagePath, `${userId}.json`);
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved tokens for user: ${userId}`);
        return true;
    }

    async getTokens(userId) {
        const filePath = path.join(this.storagePath, `${userId}.json`);
        try {
            if (fs.existsSync(filePath)) {
                const data = await fs.promises.readFile(filePath, 'utf8');
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error(`Error reading tokens for user ${userId}:`, error);
            return null;
        }
    }

    async removeTokens(userId) {
        const filePath = path.join(this.storagePath, `${userId}.json`);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            console.log(`Removed tokens for user: ${userId}`);
            return true;
        }
        return false;
    }

    async hasTokens(userId) {
        const tokens = await this.getTokens(userId);
        return !!tokens;
    }
}

module.exports = new TokenStorage();