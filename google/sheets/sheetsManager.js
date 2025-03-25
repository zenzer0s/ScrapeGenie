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
        if (!this.sheets) throw new Error('Sheets API not initialized');

        try {
            await this.sheets.spreadsheets.values.append({
                spreadsheetId,
                range: 'Website Metadata',
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
        } catch (error) {
            console.error('Error appending data:', error);
            throw error;
        }
    }
}

module.exports = new GoogleSheetsManager();