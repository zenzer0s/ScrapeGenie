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

    // Update this method to get the correct sheet ID
    async deleteEntryByUrl(spreadsheetId, url) {
        if (!this.sheets) throw new Error('Sheets API not initialized');
      
        try {
          console.log(`Deleting entry with URL ${url} from sheet: ${spreadsheetId}`);
          
          // First get the spreadsheet metadata to find the correct sheet ID
          const spreadsheet = await this.sheets.spreadsheets.get({
            spreadsheetId
          });
          
          const sheets = spreadsheet.data.sheets || [];
          let sheetId = null;
          let sheetTitle = null;
          
          // Find the Website Metadata sheet
          for (const sheet of sheets) {
            if (sheet.properties.title === 'Website Metadata') {
              sheetId = sheet.properties.sheetId;
              sheetTitle = sheet.properties.title;
              break;
            }
          }
          
          if (sheetId === null) {
            console.error('Website Metadata sheet not found');
            throw new Error('Website Metadata sheet not found');
          }
          
          console.log(`Found Website Metadata sheet with ID: ${sheetId}`);
          
          // Get the data to find the row with the URL
          const dataResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetTitle}!A2:D`,  // Skip header row
          });
          
          const rows = dataResponse.data.values || [];
          
          // Find the row index where URL matches
          let rowToDelete = -1;
          for (let i = 0; i < rows.length; i++) {
            if (rows[i][1] === url) {  // URL is in column B (index 1)
              rowToDelete = i + 2;  // +2 because we're skipping header row and sheet is 1-indexed
              break;
            }
          }
          
          if (rowToDelete === -1) {
            console.log(`URL ${url} not found in sheet`);
            throw new Error('URL not found in sheet');
          }
          
          console.log(`Found URL at row ${rowToDelete}, deleting...`);
          
          // Delete the row
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  deleteDimension: {
                    range: {
                      sheetId: sheetId,  // Use the actual sheet ID we found
                      dimension: 'ROWS',
                      startIndex: rowToDelete - 1,  // 0-indexed in the API
                      endIndex: rowToDelete  // exclusive
                    }
                  }
                }
              ]
            }
          });
          
          console.log(`Deleted row ${rowToDelete} successfully`);
          return true;
        } catch (error) {
          console.error('Error deleting entry by URL:', error);
          throw error;
        }
      }
}

module.exports = new GoogleSheetsManager();