const { google } = require('googleapis');
const authHandler = require('../auth/authHandler');
const sheetsManager = require('../../google/sheets/sheetsManager');

class GoogleSheetsManager {
    constructor() {
        this.sheets = null;
    }

    initializeSheets(authClient) {
        this.sheets = google.sheets({ version: 'v4', auth: authClient });
    }

    async createNewSpreadsheet(userId) {
        if (!this.sheets) throw new Error('Sheets API not initialized');

        try {
            const response = await this.sheets.spreadsheets.create({
                requestBody: {
                    properties: {
                        title: `ScrapeGenie Data - ${userId}`,
                    },
                    sheets: [{
                        properties: {
                            title: 'Website Metadata',
                            gridProperties: {
                                frozenRowCount: 1
                            }
                        },
                        data: [{
                            rowData: [{
                                values: [
                                    { userEnteredValue: { stringValue: 'Title' } },
                                    { userEnteredValue: { stringValue: 'URL' } },
                                    { userEnteredValue: { stringValue: 'Description' } },
                                    { userEnteredValue: { stringValue: 'Scraped Date' } }
                                ]
                            }]
                        }]
                    }]
                }
            });

            return response.data.spreadsheetId;
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            throw error;
        }
    }

    async appendWebsiteData(spreadsheetId, data) {
        if (!this.sheets) {
            console.error('[SHEETS_MANAGER] Sheets API not initialized');
            throw new Error('Sheets API not initialized');
        }

        try {
            console.log(`[SHEETS_MANAGER] Appending data to sheet: ${spreadsheetId}`);
            console.log('[SHEETS_MANAGER] Data to append:', data);
            
            // First check if the sheet exists
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId
            });
            
            console.log(`[SHEETS_MANAGER] Spreadsheet exists: ${response.data.properties.title}`);
            
            // Find or create the Website Metadata sheet
            let sheetExists = false;
            const sheets = response.data.sheets || [];
            
            for (const sheet of sheets) {
                if (sheet.properties.title === 'Website Metadata') {
                    sheetExists = true;
                    break;
                }
            }
            
            if (!sheetExists) {
                console.log('[SHEETS_MANAGER] Creating Website Metadata sheet');
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: {
                                        title: 'Website Metadata'
                                    }
                                }
                            }
                        ]
                    }
                });
                
                // Add headers
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: 'Website Metadata!A1:D1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['Title', 'URL', 'Description', 'Date Added']]
                    }
                });
            }
            
            // Now append the data
            const appendResponse = await this.sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Website Metadata!A2',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[
                        data.title || '',
                        data.url || '',
                        data.description || '',
                        new Date().toISOString()
                    ]]
                }
            });
            
            console.log('[SHEETS_MANAGER] Data appended successfully', appendResponse.data);
            return true;
        } catch (error) {
            console.error('[SHEETS_MANAGER] Error appending data:', error);
            throw error;
        }
    }

    async getSpreadsheetData(spreadsheetId) {
        if (!this.sheets) throw new Error('Sheets API not initialized');

        try {
            console.log(`Getting data from sheet: ${spreadsheetId}`);
            
            try {
                // First check if the sheet exists
                await this.sheets.spreadsheets.get({
                    spreadsheetId
                });
            } catch (error) {
                // Sheet doesn't exist or other error
                console.error('Error accessing spreadsheet:', error.message);
                return [];
            }
            
            try {
                // Check if the Website Metadata sheet exists
                const response = await this.sheets.spreadsheets.get({
                    spreadsheetId,
                    ranges: ['Website Metadata!A1:D']
                });
                
                // Get the values from the Website Metadata sheet
                const dataResponse = await this.sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: 'Website Metadata!A2:D',  // Skip header row
                });
                
                const rows = dataResponse.data.values || [];
                console.log(`Retrieved ${rows.length} rows from sheet`);
                
                return rows;
            } catch (error) {
                console.log('Website Metadata sheet not found:', error.message);
                
                // The sheet doesn't exist yet, create it with headers
                console.log('Creating Website Metadata sheet');
                await this.sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: {
                                        title: 'Website Metadata'
                                    }
                                }
                            }
                        ]
                    }
                });
                
                // Add headers
                await this.sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: 'Website Metadata!A1:D1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [['Title', 'URL', 'Description', 'Date Added']]
                    }
                });
                
                return []; // Return empty array since sheet was just created
            }
        } catch (error) {
            console.error('Error getting spreadsheet data:', error);
            throw error;
        }
    }
}

module.exports = new GoogleSheetsManager();