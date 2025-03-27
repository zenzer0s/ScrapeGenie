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

    // Update the getSheetData method with more detailed logging
    async getSheetData(chatId, page = 1, pageSize = 5, forceRefresh = false) {
        try {
            // More detailed logging
            stepLogger.info('GOOGLE_SHEET_DATA_REQUEST', { 
                chatId, 
                page, 
                pageSize,
                forceRefresh,
                timestamp: new Date().toISOString(), // Add timestamp for debugging
                requestId: `sheet-req-${Date.now()}` // Add unique request ID
            });
            
            // Add cache buster if force refresh
            const params = { chatId, page, pageSize };
            if (forceRefresh) {
                params.t = Date.now(); // Add timestamp to force a fresh request
                stepLogger.info('GOOGLE_SHEET_REFRESH', { chatId, timestamp: params.t });
            }
            
            // Log before making the request
            stepLogger.debug('GOOGLE_SHEET_API_CALL', {
                endpoint: '/api/google/sheet-data',
                params: JSON.stringify(params)
            });
            
            // Use the API endpoint
            const response = await this.api.get('/api/google/sheet-data', { params });
            
            // Log response details
            stepLogger.info('GOOGLE_SHEET_DATA_RECEIVED', {
                chatId,
                entriesCount: response.data?.entries?.length || 0,
                totalEntries: response.data?.totalEntries || 0,
                currentPage: response.data?.currentPage || page,
                totalPages: response.data?.totalPages || 1,
                responseTime: `${Date.now() - (forceRefresh ? params.t : 0)}ms`
            });
            
            return response.data;
        } catch (error) {
            // Enhanced error logging
            stepLogger.error(`GOOGLE_SHEET_DATA_ERROR: ${error.message}`, { 
                chatId,
                page,
                forceRefresh,
                errorCode: error.response?.status || 'unknown',
                errorData: error.response?.data ? JSON.stringify(error.response.data) : 'none'
            });
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