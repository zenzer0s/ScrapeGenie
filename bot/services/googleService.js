const axios = require('axios');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');
const express = require('express');
const router = express.Router();

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
            stepLogger.error(`GOOGLE_AUTH_URL_ERROR: ${error.message}`, { chatId });
            throw new Error('Failed to initialize Google connection');
        }
    }

    async checkConnectionStatus(chatId) {
        try {
            stepLogger.info('GOOGLE_STATUS_CHECK', { chatId });
            const response = await this.api.get('/api/google/status', {
                params: { chatId }
            });
            
            // Log the actual response for debugging
            stepLogger.debug('GOOGLE_STATUS_RESPONSE', { 
                chatId, 
                response: JSON.stringify(response.data) 
            });
            
            return response.data.isConnected;
        } catch (error) {
            stepLogger.error(`GOOGLE_STATUS_CHECK_ERROR: ${error.message}`, { chatId });
            throw new Error('Failed to check connection status');
        }
    }

    async disconnectGoogle(chatId) {
        try {
            stepLogger.info('GOOGLE_DISCONNECT_REQUEST', { chatId });
            await this.api.post('/api/google/disconnect', { chatId });
            return true;
        } catch (error) {
            stepLogger.error(`GOOGLE_DISCONNECT_ERROR: ${error.message}`, { chatId });
            throw new Error('Failed to disconnect Google account');
        }
    }

    async getSheetData(chatId, page = 1, pageSize = 5) {
        try {
            stepLogger.info('GOOGLE_SHEET_DATA_REQUEST', { chatId, page });
            
            // Use the API endpoint
            const response = await this.api.get('/api/google/sheet-data', {
                params: { chatId, page, pageSize }
            });
            
            return response.data;
        } catch (error) {
            stepLogger.error(`GOOGLE_SHEET_DATA_ERROR: ${error.message}`, { chatId });
            throw new Error('Failed to retrieve sheet data');
        }
    }

    async deleteSheetEntry(chatId, entry) {
        try {
            stepLogger.info('GOOGLE_SHEET_DELETE_REQUEST', { chatId, url: entry.url });
            
            // Call the backend API to delete the entry
            await this.api.delete('/api/google/sheet-entry', {
                data: { 
                    chatId,
                    url: entry.url  // Using URL as the unique identifier
                }
            });
            
            return true;
        } catch (error) {
            stepLogger.error(`GOOGLE_SHEET_DELETE_ERROR: ${error.message}`, { chatId });
            throw new Error('Failed to delete entry from sheet');
        }
    }
}

router.get('/status', async (req, res) => {
    try {
        const { chatId } = req.query;
        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID required' });
        }
        
        const isConnected = await new GoogleService().checkConnectionStatus(chatId);
        console.log(`Google connection status for user ${chatId}: ${isConnected}`);
        
        res.json({ isConnected });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = new GoogleService();
module.exports.router = router;