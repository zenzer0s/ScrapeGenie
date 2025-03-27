const { google } = require('googleapis');
let sheets = null;
let isInitialized = false;

/**
 * Initialize the Google Sheets API with an auth client
 * @param {OAuth2Client} authClient - Authenticated OAuth2 client
 */
function initializeSheets(authClient) {
    try {
        if (!authClient) {
            throw new Error('Auth client is required');
        }
        
        if (sheets) {
            console.log('Google Sheets API already initialized, skipping');
            return;
        }
        
        console.log('Initializing Google Sheets API');
        sheets = google.sheets({ version: 'v4', auth: authClient });
        drive = google.drive({ version: 'v3', auth: authClient });
        
        // Verify that the sheets and drive objects are properly initialized
        if (!sheets || !drive) {
            throw new Error('Failed to initialize Google API clients');
        }
        
        console.log('Google Sheets API initialized');
    } catch (error) {
        console.error(`Error initializing Sheets API: ${error}`);
        throw error;
    }
}

/**
 * Create a new spreadsheet
 * @param {string} title - Title of the spreadsheet
 * @returns {Promise<string>} - ID of the created spreadsheet
 */
async function createSpreadsheet(title) {
  if (!sheets) {
    throw new Error('Sheets API not initialized');
  }
  
  try {
    const response = await sheets.spreadsheets.create({
      resource: {
        properties: {
          title: title
        },
        sheets: [
          {
            properties: {
              title: 'Website Metadata',
              gridProperties: {
                rowCount: 1000,
                columnCount: 4
              }
            }
          }
        ]
      }
    });
    
    console.log(`Spreadsheet created with ID: ${response.data.spreadsheetId}`);
    
    // Set up header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: response.data.spreadsheetId,
      range: 'Website Metadata!A1:D1',
      valueInputOption: 'RAW',
      resource: {
        values: [['Title', 'URL', 'Description', 'Date Added']]
      }
    });
    
    return response.data.spreadsheetId;
  } catch (error) {
    console.error('Error creating spreadsheet:', error);
    throw error;
  }
}

/**
 * Get data from a spreadsheet
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @returns {Promise<Array>} - Array of rows
 */
async function getSpreadsheetData(spreadsheetId) {
  if (!sheets) {
    throw new Error('Sheets API not initialized');
  }
  
  try {
    // Get all values from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Website Metadata!A2:D'  // Skip header row
    });
    
    const rows = response.data.values || [];
    return rows;
  } catch (error) {
    console.error('Error getting spreadsheet data:', error);
    throw error;
  }
}

/**
 * Append a row to a sheet
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {Array} values - Array of values to append as a row
 * @param {string} [range='Website Metadata!A:D'] - Range to append to
 * @returns {Promise<object>} - Sheets API response
 */
async function appendRow(spreadsheetId, values, range = 'Website Metadata!A:D') {
  if (!sheets) {
    throw new Error('Sheets API not initialized');
  }
  
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values: [values]
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error appending row:', error);
    throw error;
  }
}

/**
 * Delete an entry from a sheet by URL
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {string} url - URL to find and delete
 * @returns {Promise<boolean>} - True if deleted
 */
async function deleteEntryByUrl(spreadsheetId, url) {
    try {
        console.log(`Deleting entry with URL ${url} from sheet: ${spreadsheetId}`);
        
        if (!sheets) {
            throw new Error('Google Sheets API not initialized. Call initializeSheets() first.');
        }
        
        // First, get the spreadsheet metadata to find the actual sheetId
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId
        });
        
        // Check if the spreadsheet has sheets
        if (!spreadsheet.data.sheets || spreadsheet.data.sheets.length === 0) {
            throw new Error('Spreadsheet has no sheets');
        }
        
        // Get the first sheet ID (which is typically where data is stored)
        const sheetId = spreadsheet.data.sheets[0].properties.sheetId;
        
        // Now get the data to find the row
        const data = await getSpreadsheetData(spreadsheetId);
        
        // Find the row with the matching URL
        const urlColumnIndex = 1; // Assuming URL is in column B (index 1)
        let rowToDelete = -1;
        
        for (let i = 0; i < data.length; i++) {
            if (data[i][urlColumnIndex] === url) {
                rowToDelete = i + 2; // +2 because row 1 is header, and data array is 0-indexed
                break;
            }
        }
        
        if (rowToDelete === -1) {
            throw new Error(`URL not found: ${url}`);
        }
        
        // Delete the row using the actual sheet ID
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId, // Using the real sheet ID instead of hardcoded 0
                                dimension: "ROWS",
                                startIndex: rowToDelete - 1, // 0-indexed
                                endIndex: rowToDelete // exclusive
                            }
                        }
                    }
                ]
            }
        });
        
        console.log(`Successfully deleted entry with URL: ${url}`);
        return true;
    } catch (error) {
        console.error(`Error deleting entry by URL: ${error}`);
        throw error;
    }
}

module.exports = {
  initializeSheets,
  createSpreadsheet,
  getSpreadsheetData,
  appendRow,
  deleteEntryByUrl
};