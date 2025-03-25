const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CONFIG } = require('../config/config');

class GoogleAuthHandler {
    constructor() {
        this.oauth2Client = new OAuth2Client(
            GOOGLE_CONFIG.client_id,
            GOOGLE_CONFIG.client_secret,
            GOOGLE_CONFIG.redirect_uri
        );
    }

    generateAuthUrl(state = '') {
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: GOOGLE_CONFIG.scopes,
            prompt: 'consent',
            state: state // Pass the state parameter with chatId
        });
    }

    async getTokens(code) {
        if (!code) {
            throw new Error('Authorization code is required');
        }
        
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            this.oauth2Client.setCredentials(tokens);
            return tokens;
        } catch (error) {
            console.error('Error getting tokens:', error.message);
            throw error;
        }
    }

    setCredentials(tokens) {
        this.oauth2Client.setCredentials(tokens);
        return this.oauth2Client;
    }

    getAuthClient() {
        return this.oauth2Client;
    }
}

module.exports = new GoogleAuthHandler();