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

    async checkConnection(chatId) {
        try {
            console.log(`Checking connection for chatId: ${chatId}`);
            
            // Check if we have tokens for this user
            const userData = await tokenStorage.getTokens(chatId);
            
            if (!userData || !userData.tokens) {
                console.log(`No tokens found for chatId: ${chatId}`);
                return false;
            }
            
            // Check if we have a spreadsheet ID
            if (!userData.spreadsheetId) {
                console.log(`No spreadsheet ID found for chatId: ${chatId}`);
                return false;
            }
            
            // Try to get a new access token to verify the refresh token works
            try {
                // Set credentials and get auth client
                authHandler.setCredentials(userData.tokens);
                const authClient = authHandler.getAuthClient();
                
                // This will throw if the token is invalid or expired
                await authClient.getAccessToken();
                
                console.log(`Connection verified for chatId: ${chatId}`);
                return true;
            } catch (tokenError) {
                console.error(`Token error for chatId: ${chatId}`, tokenError);
                return false;
            }
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

    async disconnectUser(userId) {
        return await tokenStorage.removeTokens(userId);
    }
}

module.exports = new SheetsIntegration();