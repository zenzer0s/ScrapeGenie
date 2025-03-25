const axios = require('axios');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');

class GoogleService {
    constructor() {
        this.api = axios.create({
            baseURL: config.backendUrl,
            timeout: 10000
        });
    }

    async getAuthUrl(chatId) {
        try {
            stepLogger.info('GOOGLE_AUTH_URL_REQUEST', { chatId });
            const response = await this.api.get('/api/google/auth-url', {
                params: { chatId }
            });
            return response.data.authUrl;
        } catch (error) {
            stepLogger.error('GOOGLE_AUTH_URL_ERROR', { 
                chatId, 
                error: error.message 
            });
            throw new Error('Failed to initialize Google connection');
        }
    }

    async checkConnectionStatus(chatId) {
        try {
            stepLogger.log(`Checking Google connection status for chat ${chatId}`);
            const response = await this.api.get('/api/google/status', {
                params: { chatId }
            });
            return response.data.isConnected;
        } catch (error) {
            stepLogger.error(`Failed to check connection status: ${error.message}`);
            return false;
        }
    }

    async disconnectGoogle(chatId) {
        try {
            stepLogger.log(`Disconnecting Google for chat ${chatId}`);
            await this.api.post('/api/google/disconnect', { chatId });
            return true;
        } catch (error) {
            stepLogger.error(`Failed to disconnect: ${error.message}`);
            throw new Error('Failed to disconnect Google account');
        }
    }
}

module.exports = new GoogleService();