const fs = require('fs');
const path = require('path');

// Directory for storing session data
const SESSIONS_DIR = path.join(__dirname, '../../data/sessions');
const SESSION_REFRESH_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Save a user session
 * @param {string} userId - Telegram user ID
 * @param {object} sessionData - Session data to store
 */
function saveSession(userId, sessionData) {
  try {
    const filePath = path.join(SESSIONS_DIR, `${userId}.json`);
    sessionData.lastUpdated = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving session for user ${userId}:`, error.message);
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
    
    if (!fs.existsSync(filePath)) return null;
    
    const data = fs.readFileSync(filePath, 'utf8');
    const sessionData = JSON.parse(data);
    
    if (!sessionData?.cookies || !Array.isArray(sessionData.cookies)) {
      return null;
    }
    
    return sessionData;
  } catch (error) {
    console.error(`Error reading session for user ${userId}:`, error.message);
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
    
    if (!fs.existsSync(filePath)) return true;
    
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting session for user ${userId}:`, error.message);
    return false;
  }
}

/**
 * Check if a session needs to be refreshed
 * @param {Object} sessionData - The session data to check
 * @returns {boolean} - True if session needs refresh
 */
function sessionNeedsRefresh(sessionData) {
  if (!sessionData?.createdAt) return true;
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
    return saveSession(userId, session);
  }
  return false;
}

/**
 * Gets the path to a user's session file
 * @param {string} userId - Telegram user ID
 * @returns {string} - Path to the session file
 */
function getSessionPath(userId) {
  return path.join(SESSIONS_DIR, `${userId}.json`);
}

module.exports = {
  saveSession,
  getSession,
  deleteSession,
  sessionNeedsRefresh,
  touchSession,
  getSessionPath
};