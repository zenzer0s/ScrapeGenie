const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Directory for storing encrypted session data
const SESSIONS_DIR = path.join(__dirname, '../../data/sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  console.log(`Created sessions directory: ${SESSIONS_DIR}`);
}

// Encryption key (in production, use an environment variable)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'this-is-a-32-byte-encryption-key!!';

/**
 * Encrypt data for storage
 * @param {object} data - Data to encrypt
 * @returns {string} - Encrypted string
 */
function encrypt(data) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let encrypted = cipher.update(JSON.stringify(data));
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt stored data
 * @param {string} text - Encrypted string
 * @returns {object} - Decrypted data object
 */
function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return JSON.parse(decrypted.toString());
}

/**
 * Save a user session
 * @param {string} userId - Telegram user ID
 * @param {object} sessionData - Session data to store
 */
function saveSession(userId, sessionData) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${userId}.json`);
    console.log(`Saving session for user ${userId} to ${filePath}`);
    
    // Add timestamp for debugging
    sessionData.lastUpdated = Date.now();
    
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    console.log(`Session saved successfully for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error saving session for user ${userId}:`, error);
    return false;
  }
}

/**
 * Get a stored user session
 * @param {string} userId - Telegram user ID
 * @returns {object|null} - Session data or null if not found
 */
function getSession(userId) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${userId}.json`);
    console.log(`Looking for session file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`No session file found for user ${userId}`);
      return null;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    console.log(`Session file found for user ${userId}, size: ${data.length} bytes`);
    
    // Basic validation of the session data
    const sessionData = JSON.parse(data);
    if (!sessionData || !sessionData.cookies || !Array.isArray(sessionData.cookies)) {
      console.warn(`Invalid session data for user ${userId}`);
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error(`Error reading session for user ${userId}:`, error);
    return null;
  }
}

/**
 * Delete a user session
 * @param {string} userId - Telegram user ID
 */
function deleteSession(userId) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${userId}.json`);
    console.log(`Deleting session for user ${userId}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`No session file found to delete for user ${userId}`);
      return true;
    }
    
    fs.unlinkSync(filePath);
    console.log(`Session deleted successfully for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`Error deleting session for user ${userId}:`, error);
    return false;
  }
}

/**
 * Check if a session needs to be refreshed
 * @param {Object} sessionData - The session data to check
 * @returns {boolean} - True if session needs refresh
 */
function sessionNeedsRefresh(sessionData) {
  if (!sessionData || !sessionData.createdAt) return true;
  
  const SESSION_REFRESH_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
  return Date.now() - sessionData.createdAt > SESSION_REFRESH_THRESHOLD;
}

/**
 * Update session data's timestamp to extend its life
 * @param {string} userId - Telegram user ID
 */
function touchSession(userId) {
  const session = getSession(userId);
  if (session) {
    session.lastAccessed = Date.now();
    saveSession(userId, session);
    return true;
  }
  return false;
}

module.exports = {
  saveSession,
  getSession,
  deleteSession,
  sessionNeedsRefresh,
  touchSession
};