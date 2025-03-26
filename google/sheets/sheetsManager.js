const { google } = require('googleapis');
const authHandler = require('../auth/authHandler');

class GoogleSheetsManager {
    constructor() {
        this.sheets = null;
    }

    initializeSheets(auth) {
        this.sheets = google.sheets({ version: 'v4', auth });
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
}

module.exports = new GoogleSheetsManager();