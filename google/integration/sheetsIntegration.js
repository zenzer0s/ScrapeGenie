const fs = require('fs');
const path = require('path');

class SheetsIntegration {
    constructor(tokenStorage, authHandler, sheetsManager) {
        this.tokenStorage = tokenStorage;
        this.authHandler = authHandler;
        this.sheetsManager = sheetsManager;
        
        // Add validation
        if (!tokenStorage) throw new Error('TokenStorage is required for SheetsIntegration');
        if (!authHandler) throw new Error('AuthHandler is required for SheetsIntegration');
        if (!sheetsManager) throw new Error('SheetsManager is required for SheetsIntegration');
    }

    async setupUserSheet(chatId) {
        // Implement lock mechanism to prevent duplicate calls
        if (this._setupInProgress && this._setupInProgress[chatId]) {
            console.log(`Setup already in progress for ${chatId}, returning existing promise`);
            return this._setupInProgress[chatId];
        }
        
        // Initialize setup tracking object if needed
        if (!this._setupInProgress) {
            this._setupInProgress = {};
        }
        
        // Create and store the promise
        this._setupInProgress[chatId] = (async () => {
            try {
                console.log(`Setting up sheet for user: ${chatId}`);
                
                // Get tokens with detailed logging
                console.log('Getting tokens from storage...');
                
                if (!this.tokenStorage) {
                    console.error('TokenStorage is undefined');
                    throw new Error('TokenStorage is not initialized');
                }
                
                const userData = await this.tokenStorage.getTokens(chatId);
                console.log('Got user data:', userData ? 'yes' : 'no');
                
                if (!userData || !userData.tokens) {
                    console.error('No tokens found for user');
                    throw new Error('No tokens found for user');
                }
                
                // Set up auth
                this.authHandler.setCredentials(userData.tokens);
                const authClient = this.authHandler.getAuthClient();
                
                // Initialize sheets
                this.sheetsManager.initializeSheets(authClient);
                
                // Create spreadsheet
                console.log('Creating spreadsheet...');
                const spreadsheetId = await this.sheetsManager.createSpreadsheet(`ScrapeGenie - ${chatId}`);
                console.log(`Spreadsheet created with ID: ${spreadsheetId}`);
                
                // Update user data
                console.log('Updating user data with spreadsheet ID...');
                await this.tokenStorage.saveTokens(chatId, {
                    ...userData,
                    spreadsheetId
                });
                
                console.log('Sheet setup complete');
                return spreadsheetId;
            } catch (error) {
                console.error('Setup failed:', error);
                throw error;
            } finally {
                // Clear the lock when done
                delete this._setupInProgress[chatId];
            }
        })();
        
        return this._setupInProgress[chatId];
    }

    async checkConnection(chatId) {
        try {
            console.log(`Checking connection for chatId: ${chatId}`);
            
            // Use this.tokenStorage instead of tokenStorage
            const userData = await this.tokenStorage.getTokens(chatId);
            
            if (!userData || !userData.tokens || !userData.spreadsheetId) {
                console.log(`No connection data found for chatId: ${chatId}`);
                return false;
            }
            
            // Set up authentication
            this.authHandler.setCredentials(userData.tokens);
            const authClient = this.authHandler.getAuthClient();
            
            // Test the connection by getting spreadsheet data
            this.sheetsManager.initializeSheets(authClient);
            
            // Try to access the spreadsheet to verify connection
            await this.sheetsManager.getSpreadsheetData(userData.spreadsheetId);
            
            console.log(`Connection successful for chatId: ${chatId}`);
            return true;
        } catch (error) {
            console.error(`Connection check error for chatId: ${chatId}`, error);
            return false;
        }
    }

    async storeWebsiteMetadata(chatId, metadata) {
        try {
            console.log(`[SHEETS] Storing metadata for user ${chatId}:`, metadata);
            
            const userData = await tokenStorage.getTokens(chatId);
            
            if (!userData) {
                console.error(`[SHEETS] No tokens found for user ${chatId}`);
                throw new Error('User not connected to Google Sheets');
            }
            
            console.log(`[SHEETS] Retrieved user data for ${chatId}:`, {
                spreadsheetId: userData.spreadsheetId,
                tokensExist: !!userData.tokens
            });
            
            // Get auth client with tokens
            authHandler.setCredentials(userData.tokens);
            const authClient = authHandler.getAuthClient();
            
            console.log(`[SHEETS] Auth client created for ${chatId}`);
            
            // Initialize sheets with auth client
            sheetsManager.initializeSheets(authClient);
            
            console.log(`[SHEETS] Sheets initialized, appending data to ${userData.spreadsheetId}`);
            
            // Store the metadata
            await sheetsManager.appendWebsiteData(userData.spreadsheetId, metadata);
            
            console.log(`[SHEETS] Metadata stored successfully for ${chatId}`);
            return true;
        } catch (error) {
            console.error(`[SHEETS] Failed to store metadata for ${chatId}:`, error);
            throw error;
        }
    }

    async disconnectUser(chatId) {
        try {
            console.log(`Disconnecting user: ${chatId}`);
            
            // Remove tokens from storage
            if (!this.tokenStorage) {
                console.error('TokenStorage is undefined');
                throw new Error('TokenStorage is not initialized');
            }
            
            // Delete tokens
            const success = await this.tokenStorage.removeTokens(chatId);
            
            if (success) {
                console.log(`User ${chatId} disconnected successfully`);
            } else {
                console.log(`User ${chatId} was not connected or disconnect failed`);
            }
            
            return success;
        } catch (error) {
            console.error(`Error disconnecting user ${chatId}:`, error);
            return false;
        }
    }
}

module.exports = SheetsIntegration;