const { google } = require('googleapis');
let sheets = null;
let isInitialized = false;

/**
 * Initialize the Google Sheets API with an auth client
 * @param {OAuth2Client} authClient - Authenticated OAuth2 client
 */
function initializeSheets(authClient) {
  // Only initialize once
  if (isInitialized) {
    console.log('Google Sheets API already initialized, skipping');
    return;
  }
  
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
  if (!sheets) {
    throw new Error('Sheets API not initialized');
  }

  try {
    console.log(`Deleting entry with URL ${url} from sheet: ${spreadsheetId}`);
    
    // First get the spreadsheet metadata to find the correct sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
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
    const dataResponse = await sheets.spreadsheets.values.get({
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
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
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

module.exports = {
  initializeSheets,
  createSpreadsheet,
  getSpreadsheetData,
  appendRow,
  deleteEntryByUrl
};