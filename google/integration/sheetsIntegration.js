const authHandler = require('../auth/authHandler');
const sheetsManager = require('../sheets/sheetsManager');
const tokenStorage = require('../storage/tokenStorage');

class SheetsIntegration {
    async setupUserSheet(userId, tokens) {
        try {
            if (!tokens) {
                throw new Error('No OAuth tokens provided');
            }
            
            console.log('Setting up sheet for user:', userId);
            
            // Set credentials
            const auth = authHandler.setCredentials(tokens);
            sheetsManager.initializeSheets(auth);

            // Create new spreadsheet
            const spreadsheetId = await sheetsManager.createNewSpreadsheet(userId);
            
            // Store tokens and spreadsheet ID
            await tokenStorage.saveTokens(userId, {
                tokens,
                spreadsheetId,
                createdAt: new Date().toISOString()
            });
            
            return {
                spreadsheetId,
                tokens
            };
        } catch (error) {
            console.error('Setup failed:', error);
            throw error;
        }
    }

    async checkConnection(userId) {
        return await tokenStorage.hasTokens(userId);
    }

    async storeWebsiteMetadata(userId, metadata) {
        try {
            const userData = await tokenStorage.getTokens(userId);
            
            if (!userData) {
                throw new Error('User not connected to Google Sheets');
            }
            
            const auth = authHandler.setCredentials(userData.tokens);
            sheetsManager.initializeSheets(auth);
            
            await sheetsManager.appendWebsiteData(userData.spreadsheetId, metadata);
            
            return true;
        } catch (error) {
            console.error('Failed to store metadata:', error);
            throw error;
        }
    }

    async disconnectUser(userId) {
        return await tokenStorage.removeTokens(userId);
    }
}

module.exports = new SheetsIntegration();