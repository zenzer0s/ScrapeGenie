const { google } = require('googleapis');
let sheets = null;
let drive = null;
let isInitialized = false;
let lastLogMessages = {};
const LOG_DEBOUNCE_MS = 5000; // Only log the same message once every 5 seconds

// Create a debounced logging function
function debouncedLog(message, key = null) {
    const logKey = key || message;
    const now = Date.now();
    
    // Check if we've logged this recently
    if (!lastLogMessages[logKey] || (now - lastLogMessages[logKey] > LOG_DEBOUNCE_MS)) {
        console.log(message);
        lastLogMessages[logKey] = now;
    }
}

/**
 * Initialize the Google Sheets API with an auth client
 * @param {OAuth2Client} authClient - Authenticated OAuth2 client
 */
function initializeSheets(authClient) {
    if (!authClient) {
        throw new Error('Auth client is required');
    }
    
    if (sheets && isInitialized) {
        return; // Already initialized, don't log anything
    }
    
    console.log('Initializing Google Sheets API');
    sheets = google.sheets({ version: 'v4', auth: authClient });
    drive = google.drive({ version: 'v3', auth: authClient });
    console.log('Google Sheets API initialized');
    isInitialized = true;
}

/**
 * Create a new spreadsheet
 * @param {string} title - Title of the spreadsheet
 * @returns {Promise<string>} - ID of the created spreadsheet
 */
async function createSpreadsheet(title) {
    try {
        console.log(`Creating spreadsheet: ${title}`);
        
        if (!sheets || !drive) {
            throw new Error('Google Sheets API not initialized');
        }
        
        // Create a new spreadsheet
        const response = await sheets.spreadsheets.create({
            resource: {
                properties: {
                    title: title
                },
                sheets: [
                    {
                        properties: {
                            title: 'Sheet1',  // Explicitly name the sheet "Sheet1"
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 26
                            }
                        }
                    }
                ]
            }
        });
        
        const spreadsheetId = response.data.spreadsheetId;
        console.log(`Spreadsheet created with ID: ${spreadsheetId}`);
        
        // Initialize the sheet with headers
        await sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: 'Sheet1!A1:D1',
            valueInputOption: 'RAW',
            resource: {
                values: [['Title', 'URL', 'Description', 'Date Added']]
            }
        });
        
        console.log('Added headers to spreadsheet');
        
        return spreadsheetId;
    } catch (error) {
        console.error(`Error creating spreadsheet: ${error.message}`);
        throw error;
    }
}

let lastSheetNames = {};

/**
 * Get data from a spreadsheet
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @returns {Promise<Array>} - Array of rows
 */
async function getSpreadsheetData(spreadsheetId, range = null) {
    try {
        if (!sheets) {
            throw new Error('Google Sheets API not initialized');
        }
        
        // First, get information about the spreadsheet to find the first sheet name
        if (!range) {
            // Check if we've already looked up this sheet name recently
            if (lastSheetNames[spreadsheetId] && 
                (Date.now() - lastSheetNames[spreadsheetId].timestamp < LOG_DEBOUNCE_MS)) {
                range = `${lastSheetNames[spreadsheetId].name}!A1:Z1000`;
            } else {
                const spreadsheet = await sheets.spreadsheets.get({
                    spreadsheetId
                });
                
                if (!spreadsheet.data.sheets || spreadsheet.data.sheets.length === 0) {
                    throw new Error('Spreadsheet has no sheets');
                }
                
                const firstSheetName = spreadsheet.data.sheets[0].properties.title;
                range = `${firstSheetName}!A1:Z1000`;
                
                // Store for future use
                lastSheetNames[spreadsheetId] = {
                    name: firstSheetName,
                    timestamp: Date.now()
                };
                
                // Only log sheet name if it hasn't been logged recently
                debouncedLog(`Using sheet name: ${firstSheetName}`, `sheet_name_${spreadsheetId}`);
            }
        }
        
        // Now get the data using the determined range
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        
        const rows = response.data.values || [];
        
        // Only log if there's data and we haven't logged this recently
        if (rows.length > 0) {
            debouncedLog(`Retrieved ${rows.length - 1} entries`, `entries_${spreadsheetId}`);
        }
        
        return rows;
    } catch (error) {
        console.error(`Error getting spreadsheet data: ${error.message}`);
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
        console.log(`Deleting entry with URL ${url}`);
        
        if (!sheets) {
            throw new Error('Google Sheets API not initialized');
        }
        
        // First, get the spreadsheet metadata
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId
        });
        
        if (!spreadsheet.data.sheets || spreadsheet.data.sheets.length === 0) {
            throw new Error('Spreadsheet has no sheets');
        }
        
        // Get the first sheet info
        const firstSheet = spreadsheet.data.sheets[0];
        const sheetId = firstSheet.properties.sheetId;
        const sheetName = firstSheet.properties.title;
        
        // Get data using the actual sheet name
        const data = await getSpreadsheetData(spreadsheetId, `${sheetName}!A1:Z1000`);
        
        // Find the row with the matching URL
        const urlColumnIndex = 1; // URL is in column B
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
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: "ROWS",
                            startIndex: rowToDelete - 1,
                            endIndex: rowToDelete
                        }
                    }
                }]
            }
        });
        
        console.log(`Successfully deleted entry with URL: ${url}`);
        return true;
    } catch (error) {
        console.error(`Error deleting entry: ${error.message}`);
        throw error;
    }
}

/**
 * Append website data to a spreadsheet
 * @param {string} spreadsheetId - ID of the spreadsheet
 * @param {Object} metadata - Website metadata to append
 * @returns {Promise<Object>} - Sheets API response
 */
async function appendWebsiteData(spreadsheetId, metadata) {
  try {
    console.log(`Appending website data to spreadsheet ${spreadsheetId}`);
    
    if (!sheets) {
      throw new Error('Google Sheets API not initialized');
    }
    
    // Format the data as a row
    const now = new Date().toISOString();
    const rowData = [
      metadata.title || 'Untitled',                  // Title
      metadata.originalUrl || metadata.url || '',    // URL
      metadata.content || metadata.description || '', // Description
      now                                            // Date Added
    ];
    
    // Get the first sheet name
    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });
    
    const sheetName = response.data.sheets[0].properties.title;
    console.log(`Using sheet "${sheetName}" for appending data`);
    
    // Append the row
    return await appendRow(spreadsheetId, rowData, `${sheetName}!A:D`);
  } catch (error) {
    console.error('Error appending website data:', error);
    throw error;
  }
}

/**
 * Delete a spreadsheet permanently from Google Drive
 * @param {string} spreadsheetId - ID of the spreadsheet to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteSpreadsheet(spreadsheetId) {
  try {
    console.log(`Deleting spreadsheet ${spreadsheetId} from Google Drive`);
    
    if (!drive) {
      // Initialize Drive API if not already done
      drive = google.drive({ version: 'v3', auth: sheets.context.auth });
      console.log('Google Drive API initialized');
    }
    
    // Request to permanently delete the spreadsheet (not just to trash)
    await drive.files.delete({
      fileId: spreadsheetId,
      supportsAllDrives: true
    });
    
    console.log(`Spreadsheet ${spreadsheetId} permanently deleted`);
    return true;
  } catch (error) {
    console.error(`Failed to delete spreadsheet: ${error.message}`);
    throw error;
  }
}

module.exports = {
  initializeSheets,
  createSpreadsheet,
  getSpreadsheetData,
  appendRow,
  deleteEntryByUrl,
  appendWebsiteData,
  deleteSpreadsheet  // Add this line
};