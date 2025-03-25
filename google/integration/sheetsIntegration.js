const authHandler = require('../auth/authHandler');
const sheetsManager = require('../sheets/sheetsManager');

class SheetsIntegration {
    async setupUserSheet(userId, authCode) {
        try {
            // Get tokens using auth code
            const tokens = await authHandler.getTokens(authCode);
            
            // Initialize sheets with auth
            const auth = authHandler.setCredentials(tokens);
            sheetsManager.initializeSheets(auth);

            // Create new spreadsheet
            const spreadsheetId = await sheetsManager.createNewSpreadsheet(userId);
            
            return {
                spreadsheetId,
                tokens
            };
        } catch (error) {
            console.error('Setup failed:', error);
            throw error;
        }
    }

    async storeWebsiteMetadata(spreadsheetId, tokens, metadata) {
        try {
            // Set credentials and initialize sheets
            const auth = authHandler.setCredentials(tokens);
            sheetsManager.initializeSheets(auth);

            // Store the metadata
            await sheetsManager.appendWebsiteData(spreadsheetId, metadata);
            
            return true;
        } catch (error) {
            console.error('Failed to store metadata:', error);
            throw error;
        }
    }
}

module.exports = new SheetsIntegration();