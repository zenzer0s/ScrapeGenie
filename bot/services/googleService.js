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

    /**
     * Get Google authentication URL
     * @param {string} chatId - The user's chat ID
     * @param {Object} options - Additional options
     * @returns {Promise<string>} - Authentication URL
     */
    async getAuthUrl(chatId, options = {}) {
        try {
            stepLogger.info('GOOGLE_AUTH_URL_REQUEST', { chatId });
            
            // First check if user has existing spreadsheet data
            const status = await this.getDetailedStatus(chatId);
            const hasExistingSheet = status && status.spreadsheetId && 
                (status.connected || status.disconnectedAt);
            
            // Always include returning=true if the user has an existing spreadsheet
            const params = hasExistingSheet ? 
                { ...options, returning: true } : 
                options;
            
            // Generate auth URL with appropriate parameters
            const response = await this.api.get(`/api/google/auth-url`, {
                params: {
                    chatId,
                    ...params
                }
            });
            
            stepLogger.debug('GOOGLE_AUTH_URL_RESPONSE', { 
                chatId, 
                hasExistingSheet
            });
            
            return response.data.authUrl;
        } catch (error) {
            stepLogger.error('GOOGLE_AUTH_URL_ERROR', { chatId, error: error.message });
            throw error;
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

    // Add this method to the GoogleService class
    async disconnect(chatId) {
        try {
            stepLogger.info('GOOGLE_DISCONNECT_REQUEST', { chatId });
            
            // Call the API endpoint to disconnect (preserve spreadsheet ID)
            const response = await this.api.post('/api/google/disconnect', { chatId });
            
            stepLogger.debug('GOOGLE_DISCONNECT_RESPONSE', { 
                chatId, 
                response: JSON.stringify(response.data) 
            });
            
            return {
                success: true,
                message: "Successfully disconnected from Google Sheets"
            };
        } catch (error) {
            stepLogger.error('GOOGLE_DISCONNECT_ERROR', { 
                chatId, 
                error: error.message 
            });
            
            return {
                success: false,
                error: error.message,
                message: "Failed to disconnect from Google Sheets"
            };
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

    /**
     * Get detailed connection status
     * @param {string} chatId - The Telegram chat ID
     * @returns {Promise<Object>} - Detailed connection status
     */
    async getDetailedStatus(chatId) {
        try {
            stepLogger.info('GOOGLE_STATUS_CHECK', { chatId });
            
            // Use this.api which is already configured with the baseURL
            const response = await this.api.get(`/api/google/status?chatId=${chatId}`);
            
            stepLogger.debug('GOOGLE_STATUS_RESPONSE', { 
                chatId, 
                response: JSON.stringify(response.data).substring(0, 100) + '...' 
            });
            
            return response.data;
        } catch (error) {
            stepLogger.error('GOOGLE_STATUS_CHECK_ERROR', { chatId, error: error.message });
            throw error;
        }
    }

    /**
     * Create a new spreadsheet for an authenticated user
     * @param {string} chatId - The Telegram chat ID
     * @returns {Promise<Object>} - Result with success status
     */
    async createNewSpreadsheet(chatId) {
        try {
            stepLogger.info('GOOGLE_CREATE_SPREADSHEET', { chatId });
            
            // Use this.api instead of axios directly
            const response = await this.api.post(`/api/google/create-spreadsheet`, { chatId });
            
            stepLogger.debug('GOOGLE_CREATE_SPREADSHEET_RESPONSE', { chatId, response: JSON.stringify(response.data) });
            return response.data;
        } catch (error) {
            stepLogger.error('GOOGLE_CREATE_SPREADSHEET_ERROR', { chatId, error: error.message });
            return { 
                success: false, 
                error: error.message,
                message: "Failed to create spreadsheet"
            };
        }
    }

    /**
     * Recreate a spreadsheet for an authenticated user
     * @param {string} chatId - The Telegram chat ID
     * @returns {Promise<Object>} - Result with success status
     */
    async recreateSpreadsheet(chatId) {
        try {
            stepLogger.info('GOOGLE_RECREATE_SPREADSHEET', { chatId });
            
            // Call the API endpoint to recreate spreadsheet
            const response = await this.api.post('/api/google/recreate-spreadsheet', { chatId });
            
            stepLogger.debug('GOOGLE_RECREATE_SPREADSHEET_RESPONSE', { 
                chatId, 
                response: JSON.stringify(response.data)
            });
            
            return response.data;
        } catch (error) {
            stepLogger.error('GOOGLE_RECREATE_SPREADSHEET_ERROR', { 
                chatId, 
                error: error.message 
            });
            
            return {
                success: false,
                error: error.message,
                message: "Failed to recreate spreadsheet"
            };
        }
    }

    /**
     * Get basic connection status
     * @param {string} chatId - The Telegram chat ID
     * @returns {Promise<boolean>} - True if connected and authenticated, false otherwise
     */
    async getStatus(chatId) {
        try {
            stepLogger.info('GOOGLE_BASIC_STATUS_CHECK', { chatId });
            
            // Use the detailed status function and return just the boolean
            const detailedStatus = await this.getDetailedStatus(chatId);
            
            // Return true if connected AND authenticated, false otherwise
            return !!(detailedStatus && detailedStatus.connected && detailedStatus.authentication);
        } catch (error) {
            stepLogger.error('GOOGLE_BASIC_STATUS_ERROR', { chatId, error: error.message });
            return false;
        }
    }
}

module.exports = new GoogleService();