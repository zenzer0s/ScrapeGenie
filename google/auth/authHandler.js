const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CONFIG } = require('../config/config');

// Define SCOPES here since it was referenced in the standalone functions
const SCOPES = GOOGLE_CONFIG.scopes;

// Create a single instance of the OAuth client to use throughout
let oauth2Client = null;

/**
 * Initialize OAuth2 client
 */
function initializeOAuth() {
  try {
    console.log('Initializing OAuth client with redirect URI:', GOOGLE_CONFIG.redirect_uri);
    
    oauth2Client = new OAuth2Client(
      GOOGLE_CONFIG.client_id,
      GOOGLE_CONFIG.client_secret,
      GOOGLE_CONFIG.redirect_uri
    );
    
    console.log('OAuth client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OAuth client:', error);
    throw error;
  }
}

/**
 * Set credentials for the OAuth client
 * @param {Object} tokens - The tokens to set
 * @returns {OAuth2Client} - The OAuth client with credentials set
 */
function setCredentials(tokens) {
  if (!oauth2Client) {
    initializeOAuth(); // Initialize if not already done
  }
  
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

/**
 * Get the OAuth client
 * @returns {OAuth2Client} - The OAuth client
 */
function getAuthClient() {
  if (!oauth2Client) {
    throw new Error('OAuth2 client not initialized');
  }
  
  return oauth2Client;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - The authorization code to exchange
 * @returns {Promise<Object>} - The tokens
 */
async function getTokensFromCode(code) {
  try {
    console.log('Exchanging authorization code for tokens');
    
    if (!oauth2Client) {
      initializeOAuth(); // Initialize if not already done
    }
    
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens retrieved successfully');
    
    return tokens;
  } catch (error) {
    console.error('Error getting tokens from code:', error);
    throw error;
  }
}

/**
 * Generate OAuth URL for user authentication
 * @param {string} state - State parameter (encoded chatId)
 * @returns {string} - Authorization URL
 */
function generateAuthUrl(state) {
  if (!oauth2Client) {
    initializeOAuth(); // Initialize if not already done
  }
  
  // Make sure SCOPES is defined
  const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];
  
  // Generate and return the URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent' // Force to show the consent screen
  });
  
  // Debug log the URL
  console.log(`Generated auth URL: ${authUrl.substring(0, 50)}...`);
  
  return authUrl;
}

// Initialize OAuth client right away
initializeOAuth();

module.exports = {
  initializeOAuth,
  setCredentials,
  getAuthClient,
  generateAuthUrl,
  getTokensFromCode
};