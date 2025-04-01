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

    async saveSpreadsheetId(chatId, spreadsheetId) {
        try {
            const userData = await this.getTokens(chatId) || {};
            userData.spreadsheetId = spreadsheetId;
            userData.spreadsheetCreatedAt = userData.spreadsheetCreatedAt || new Date().toISOString();
            await this.saveTokens(chatId, userData);
            console.log(`Saved spreadsheet ID ${spreadsheetId} for user ${chatId}`);
            return true;
        } catch (error) {
            console.error(`Failed to save spreadsheet ID: ${error.message}`);
            return false;
        }
    }

    async removeTokens(chatId) {
        try {
            const filePath = path.join(this.storagePath, `${chatId}.json`);
            if (fs.existsSync(filePath)) {
                const userData = await this.getTokens(chatId);
                if (userData && userData.spreadsheetId) {
                    console.log(`Preserving spreadsheet ID ${userData.spreadsheetId} for user ${chatId}`);
                    const preservedData = {
                        spreadsheetId: userData.spreadsheetId,
                        spreadsheetCreatedAt: userData.spreadsheetCreatedAt,
                        disconnectedAt: new Date().toISOString()
                    };
                    await this.saveTokens(chatId, preservedData);
                } else {
                    fs.unlinkSync(filePath);
                }
            }
            return true;
        } catch (error) {
            console.error(`Failed to safely remove tokens: ${error.message}`);
            return false;
        }
    }

    async hasTokens(userId) {
        const tokens = await this.getTokens(userId);
        return !!tokens;
    }
}

module.exports = new TokenStorage();