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
            const response = await this.api.get(`/api/google/auth-url?chatId=${chatId}`);
            
            if (!response.data || !response.data.url) {
                throw new Error('Invalid response from server');
            }
            
            return response.data.url;
        } catch (error) {
            stepLogger.error(`GOOGLE_AUTH_URL_ERROR: ${error.message}`, { chatId });
            throw new Error('Failed to generate authentication URL');
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

    // Reduce logs in getSheetData
    async getSheetData(chatId, page = 1, pageSize = 5, forceRefresh = false) {
        try {
            // Remove excessive logging, keep only essential info
            const logData = {
                chatId, 
                page, 
                pageSize,
                forceRefresh: forceRefresh ? true : undefined
            };
            
            if (forceRefresh) {
                stepLogger.info('GOOGLE_SHEET_REFRESH', logData);
            }
            
            // Use the API endpoint
            const response = await this.api.get('/api/google/sheet-data', { 
                params: { 
                    chatId, 
                    page, 
                    pageSize,
                    // Add cache buster if forcing refresh
                    ...(forceRefresh ? { t: Date.now() } : {})
                }
            });
            
            return response.data;
        } catch (error) {
            // Keep error logging
            stepLogger.error(`GOOGLE_SHEET_DATA_ERROR: ${error.message}`, { chatId, page });
            throw new Error('Failed to retrieve sheet data');
        }
    }

    // Update the deleteSheetEntry method with more detailed logging
    async deleteSheetEntry(chatId, entry) {
        try {
            // More detailed logging
            stepLogger.info('GOOGLE_SHEET_DELETE_REQUEST', { 
                chatId, 
                url: entry.url,
                entryTitle: entry.title || 'Untitled',
                timestamp: new Date().toISOString(),
                requestId: `delete-req-${Date.now()}`
            });
            
            // Log before making the request
            stepLogger.debug('GOOGLE_SHEET_DELETE_API_CALL', {
                endpoint: '/api/google/sheet-entry',
                method: 'DELETE',
                data: JSON.stringify({ chatId, url: entry.url })
            });
            
            // Call the backend API to delete the entry
            const startTime = Date.now();
            await this.api.delete('/api/google/sheet-entry', {
                data: { 
                    chatId,
                    url: entry.url  // Using URL as the unique identifier
                }
            });
            
            // Log success
            stepLogger.success('GOOGLE_SHEET_ENTRY_DELETED', {
                chatId,
                url: entry.url,
                responseTime: `${Date.now() - startTime}ms`
            });
            
            return true;
        } catch (error) {
            // Enhanced error logging
            stepLogger.error(`GOOGLE_SHEET_DELETE_ERROR: ${error.message}`, { 
                chatId,
                url: entry.url,
                errorCode: error.response?.status || 'unknown',
                errorData: error.response?.data ? JSON.stringify(error.response.data) : 'none'
            });
            
            // Make error message more user-friendly
            if (error.response && error.response.status === 404) {
                throw new Error('Entry not found in your Google Sheet');
            } else {
                throw new Error('Failed to delete entry from sheet');
            }
        }
    }

    // Update the storeWebsiteMetadata method with more detailed logging
    async storeWebsiteMetadata(chatId, metadata) {
        try {
            // More detailed logging
            stepLogger.info('GOOGLE_STORE_METADATA_REQUEST', { 
                chatId, 
                url: metadata.url,
                title: metadata.title || 'Untitled',
                timestamp: new Date().toISOString(),
                requestId: `metadata-req-${Date.now()}`
            });
            
            // Log before making the request
            stepLogger.debug('GOOGLE_STORE_METADATA_API_CALL', {
                endpoint: '/api/google/store-metadata',
                method: 'POST',
                data: JSON.stringify({ 
                    chatId,
                    metadata: {
                        title: metadata.title || 'Untitled',
                        url: metadata.url,
                        description: metadata.description || 'No description'
                    }
                })
            });
            
            const startTime = Date.now();
            await this.api.post('/api/google/store-metadata', {
                chatId,
                metadata: {
                    title: metadata.title || 'Untitled',
                    url: metadata.url,
                    description: metadata.description || 'No description'
                }
            });
            
            // Log success
            stepLogger.success('GOOGLE_METADATA_STORED', {
                chatId,
                url: metadata.url,
                responseTime: `${Date.now() - startTime}ms`
            });
            
            return true;
        } catch (error) {
            // Enhanced error logging
            stepLogger.error(`GOOGLE_STORE_METADATA_ERROR: ${error.message}`, { 
                chatId,
                url: metadata.url,
                errorCode: error.response?.status || 'unknown',
                errorData: error.response?.data ? JSON.stringify(error.response.data) : 'none'
            });
            throw new Error('Failed to store website metadata');
        }
    }
}

module.exports = new GoogleService();