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

    // Update the checkConnection method to detect deleted spreadsheets
    async checkConnection(chatId) {
        try {
            const userData = await this.tokenStorage.getTokens(chatId);
            
            if (!userData || !userData.tokens) {
                return {
                    connected: false,
                    authentication: false,
                    message: "Not authenticated with Google"
                };
            }
            
            // Check if spreadsheetId exists
            if (!userData.spreadsheetId) {
                return {
                    connected: true,
                    authentication: true,
                    spreadsheetMissing: true,
                    message: "Authentication successful, but no spreadsheet is linked"
                };
            }
            
            // Try to access the spreadsheet to verify connection
            try {
                this.authHandler.setCredentials(userData.tokens);
                const authClient = this.authHandler.getAuthClient();
                this.sheetsManager.initializeSheets(authClient);
                
                await this.sheetsManager.getSpreadsheetData(userData.spreadsheetId);
                
                return {
                    connected: true,
                    authentication: true,
                    message: "Connected to Google Sheets"
                };
            } catch (error) {
                // Check if spreadsheet was deleted
                if (error.message.includes("Requested entity was not found") || 
                    error.message.includes("not found") || 
                    error.message.includes("File not found")) {
                    
                    console.log(`Spreadsheet was deleted for chatId: ${chatId}`);
                    
                    // Clear the spreadsheet ID but keep auth tokens
                    userData.spreadsheetId = null;
                    await this.tokenStorage.saveTokens(chatId, userData);
                    
                    return {
                        connected: true,
                        authentication: true,
                        spreadsheetMissing: true,
                        message: "Your spreadsheet was deleted. Please create a new one."
                    };
                }
                
                console.error(`Connection check error: ${error.message}`);
                return {
                    connected: false,
                    authentication: true,
                    error: error.message,
                    message: "Error connecting to Google Sheets"
                };
            }
        } catch (error) {
            console.error(`Connection check error: ${error.message}`);
            return {
                connected: false,
                error: error.message,
                message: "Error checking connection"
            };
        }
    }

    async getSheetData(chatId, page = 1, pageSize = 5) {
        try {
            console.log(`Getting sheet data for chatId: ${chatId}`);
            
            const isConnected = await this.checkConnection(chatId);
            
            if (!isConnected.connected) {
                throw new Error('User is not connected to Google Sheets');
            }
            
            console.log(`User is connected to Google Sheets`);
            
            const userData = await this.tokenStorage.getTokens(chatId);
            console.log(`Using spreadsheet ID: ${userData.spreadsheetId}`);
            
            // Get data from spreadsheet
            const data = await this.sheetsManager.getSpreadsheetData(userData.spreadsheetId);
            
            // Skip header row and handle pagination
            const entries = [];
            const headerRow = data[0] || [];
            
            // Get column indices
            const titleIndex = headerRow.indexOf('Title');
            const urlIndex = headerRow.indexOf('URL');
            const descriptionIndex = headerRow.indexOf('Description');
            const dateAddedIndex = headerRow.indexOf('Date Added');
            
            // Process rows (skip header)
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                entries.push({
                    title: row[titleIndex] || 'Untitled',
                    url: row[urlIndex] || '',
                    description: row[descriptionIndex] || '',
                    dateAdded: row[dateAddedIndex] || new Date().toISOString()
                });
            }
            
            // Paginate results
            const startIndex = (page - 1) * pageSize;
            const paginatedEntries = entries.slice(startIndex, startIndex + pageSize);
            
            console.log(`Retrieved ${entries.length} entries, returning page ${page} with ${paginatedEntries.length} items`);
            
            return {
                entries: paginatedEntries,
                currentPage: page,
                totalPages: Math.ceil(entries.length / pageSize) || 1,
                totalEntries: entries.length
            };
        } catch (error) {
            console.error(`Error getting sheet data: ${error.message}`);
            throw error;
        }
    }

    async storeWebsiteMetadata(chatId, metadata) {
        try {
            console.log(`[SHEETS] Storing metadata for user ${chatId}:`, metadata);
            
            // Use this.tokenStorage instead of tokenStorage
            const userData = await this.tokenStorage.getTokens(chatId);
            
            if (!userData) {
                console.error(`[SHEETS] No tokens found for user ${chatId}`);
                throw new Error('User not connected to Google Sheets');
            }
            
            console.log(`[SHEETS] Retrieved user data for ${chatId}:`, {
                spreadsheetId: userData.spreadsheetId,
                tokensExist: !!userData.tokens
            });
            
            // Use this.authHandler instead of authHandler
            this.authHandler.setCredentials(userData.tokens);
            const authClient = this.authHandler.getAuthClient();
            
            console.log(`[SHEETS] Auth client created for ${chatId}`);
            
            // Use this.sheetsManager instead of sheetsManager
            this.sheetsManager.initializeSheets(authClient);
            
            console.log(`[SHEETS] Sheets initialized, appending data to ${userData.spreadsheetId}`);
            
            // Use this.sheetsManager instead of sheetsManager
            await this.sheetsManager.appendWebsiteData(userData.spreadsheetId, metadata);
            
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

    // Add method to create a new spreadsheet for an authenticated user
    async createNewSpreadsheet(chatId) {
        try {
            console.log(`Creating new spreadsheet for user: ${chatId}`);
            
            // Get tokens with detailed logging
            const userData = await this.tokenStorage.getTokens(chatId);
            
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
            userData.spreadsheetId = spreadsheetId;
            await this.tokenStorage.saveTokens(chatId, userData);
            
            console.log('New spreadsheet created successfully');
            return {
                success: true,
                spreadsheetId,
                message: "New spreadsheet created successfully"
            };
        } catch (error) {
            console.error('Spreadsheet creation failed:', error);
            return {
                success: false,
                error: error.message,
                message: "Failed to create spreadsheet"
            };
        }
    }

    /**
     * Handle authentication for a returning or new user
     * @param {string} chatId - The user's chat ID
     * @param {Object} tokens - OAuth tokens
     * @returns {Promise<Object>} - Result with returning user status
     */
    async handleReturningUser(chatId, tokens) {
        try {
            console.log(`[SHEETS] Handling authentication for user ${chatId}`);
            
            // Get existing user data
            let userData = await this.tokenStorage.getTokens(chatId) || {};
            
            // Set the new tokens
            userData.tokens = tokens;
            
            // Check if user has a previous spreadsheet
            if (userData.spreadsheetId) {
                console.log(`[SHEETS] Found existing spreadsheet ${userData.spreadsheetId} for user ${chatId}`);
                try {
                    // Verify sheet still exists
                    this.authHandler.setCredentials(tokens);
                    const authClient = this.authHandler.getAuthClient();
                    this.sheetsManager.initializeSheets(authClient);
                    
                    // Try to get spreadsheet data to verify it exists
                    await this.sheetsManager.getSpreadsheetData(userData.spreadsheetId);
                    
                    // Spreadsheet exists, update tokens but keep the sheet ID
                    console.log(`[SHEETS] Existing spreadsheet verified, updating tokens for user ${chatId}`);
                    await this.tokenStorage.saveTokens(chatId, userData);
                    
                    return {
                        success: true,
                        isReturning: true,
                        spreadsheetId: userData.spreadsheetId,
                        createdAt: userData.spreadsheetCreatedAt
                    };
                } catch (error) {
                    // Spreadsheet was deleted or inaccessible, need to create a new one
                    console.log(`[SHEETS] Previous spreadsheet not accessible, creating new one for user ${chatId}`);
                    userData.spreadsheetId = null;
                    userData.spreadsheetCreatedAt = null;
                    await this.tokenStorage.saveTokens(chatId, userData);
                    
                    // Create new spreadsheet
                    return await this.createNewSpreadsheetForUser(chatId, tokens);
                }
            } else {
                // No previous spreadsheet, create new
                console.log(`[SHEETS] No previous spreadsheet found, creating new one for user ${chatId}`);
                return await this.createNewSpreadsheetForUser(chatId, tokens);
            }
        } catch (error) {
            console.error(`[SHEETS] Error handling returning user: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a new spreadsheet for a user
     * @param {string} chatId - User's chat ID
     * @param {Object} tokens - OAuth tokens
     * @returns {Promise<Object>} - Creation result
     */
    async createNewSpreadsheetForUser(chatId, tokens) {
        try {
            console.log(`[SHEETS] Creating new spreadsheet for user ${chatId}`);
            
            // Set credentials and create sheet
            this.authHandler.setCredentials(tokens);
            const authClient = this.authHandler.getAuthClient();
            this.sheetsManager.initializeSheets(authClient);
            
            const spreadsheetId = await this.sheetsManager.createSpreadsheet(`ScrapeGenie - ${chatId}`);
            console.log(`[SHEETS] Created new spreadsheet ${spreadsheetId} for user ${chatId}`);
            
            // Save with new sheet ID and timestamp
            const userData = await this.tokenStorage.getTokens(chatId) || {};
            userData.tokens = tokens;
            userData.spreadsheetId = spreadsheetId;
            userData.spreadsheetCreatedAt = new Date().toISOString();
            
            await this.tokenStorage.saveTokens(chatId, userData);
            
            return {
                success: true,
                isReturning: false,
                spreadsheetId
            };
        } catch (error) {
            console.error(`[SHEETS] Failed to create new spreadsheet: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete existing spreadsheet and create a new one
     * @param {string} chatId - User's chat ID
     * @returns {Promise<Object>} - Result with new spreadsheet ID
     */
    async recreateSpreadsheet(chatId) {
        try {
            console.log(`[SHEETS] Recreating spreadsheet for user ${chatId}`);
            const userData = await this.tokenStorage.getTokens(chatId);
            
            if (!userData || !userData.tokens) {
                throw new Error('User not authenticated with Google');
            }
            
            // Set up auth
            this.authHandler.setCredentials(userData.tokens);
            const authClient = this.authHandler.getAuthClient();
            this.sheetsManager.initializeSheets(authClient);
            
            // Delete old spreadsheet if it exists
            if (userData.spreadsheetId) {
                try {
                    console.log(`[SHEETS] Attempting to delete old spreadsheet ${userData.spreadsheetId}`);
                    await this.sheetsManager.deleteSpreadsheet(userData.spreadsheetId);
                    console.log(`[SHEETS] Successfully deleted old spreadsheet`);
                } catch (error) {
                    console.error(`[SHEETS] Error deleting old spreadsheet: ${error.message}`);
                    // Continue even if delete fails
                }
            }
            
            // Create new spreadsheet
            const spreadsheetId = await this.sheetsManager.createSpreadsheet(`ScrapeGenie - ${chatId}`);
            console.log(`[SHEETS] Created new spreadsheet ${spreadsheetId} for user ${chatId}`);
            
            // Update user data
            userData.spreadsheetId = spreadsheetId;
            userData.spreadsheetCreatedAt = new Date().toISOString();
            await this.tokenStorage.saveTokens(chatId, userData);
            
            return {
                success: true,
                spreadsheetId
            };
        } catch (error) {
            console.error(`[SHEETS] Failed to recreate spreadsheet: ${error.message}`);
            throw error;
        }
    }
}

module.exports = SheetsIntegration;