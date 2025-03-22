const fs = require('fs');
const path = require('path');
const stepLogger = require('./stepLogger');

const settingsPath = path.join(__dirname, '../../data/settings.json');

// Ensure settings.json exists and has valid content
function ensureSettingsFile() {
  try {
    // Make sure the directory exists
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      stepLogger.info('SETTINGS_DIR_CREATED', { path: dir });
    }
    
    // Check if file exists
    if (!fs.existsSync(settingsPath)) {
      // Create with default empty structure
      fs.writeFileSync(settingsPath, JSON.stringify({ users: {} }, null, 2));
      stepLogger.info('SETTINGS_FILE_CREATED', { path: settingsPath });
      return;
    }
    
    // Validate file content
    const content = fs.readFileSync(settingsPath, 'utf8');
    if (!content || content.trim() === '') {
      // File exists but is empty
      fs.writeFileSync(settingsPath, JSON.stringify({ users: {} }, null, 2));
      stepLogger.warn('SETTINGS_FILE_EMPTY_FIXED', { path: settingsPath });
      return;
    }
    
    // Try to parse to validate JSON
    try {
      JSON.parse(content);
    } catch (e) {
      // Invalid JSON - overwrite with default
      fs.writeFileSync(settingsPath, JSON.stringify({ users: {} }, null, 2));
      stepLogger.error('SETTINGS_FILE_CORRUPTED_FIXED', { path: settingsPath, error: e.message });
    }
  } catch (error) {
    stepLogger.error('SETTINGS_FILE_ERROR', { error: error.message });
    // Create a valid settings object in memory even if file operations fail
    return { users: {} };
  }
}

// Get user settings
function getUserSettings(userId) {
  try {
    ensureSettingsFile();
    
    // Read current settings with error handling
    let settings;
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch (error) {
      stepLogger.error('SETTINGS_READ_ERROR', { userId, error: error.message });
      // Return default settings if read fails
      return { instagram: { sendMedia: true, sendCaption: false } };
    }
    
    // Initialize if needed
    if (!settings.users) {
      settings.users = {};
    }
    
    if (!settings.users[userId]) {
      settings.users[userId] = { 
        instagram: { 
          sendMedia: true,
          sendCaption: false
        } 
      };
      // Save the new user settings
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        stepLogger.info('DEFAULT_SETTINGS_INITIALIZED', { userId });
      } catch (error) {
        stepLogger.error('SETTINGS_WRITE_ERROR', { userId, error: error.message });
      }
    }
    
    // Return the settings
    return { ...settings.users[userId] };
  } catch (error) {
    stepLogger.error('GET_USER_SETTINGS_ERROR', { userId, error: error.message });
    // Return default settings as fallback
    return { instagram: { sendMedia: true, sendCaption: false } };
  }
}

// Update user settings
function updateUserSettings(userId, newSettings) {
  try {
    ensureSettingsFile();
    
    // Read current settings
    let settings;
    try {
      const content = fs.readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(content);
    } catch (error) {
      stepLogger.error('SETTINGS_READ_ERROR', { userId, error: error.message });
      settings = { users: {} };
    }
    
    // Initialize if needed
    if (!settings.users) {
      settings.users = {};
    }
    
    if (!settings.users[userId]) {
      settings.users[userId] = { 
        instagram: { 
          sendMedia: true,
          sendCaption: false
        } 
      };
    }
    
    // Update settings
    settings.users[userId] = {
      ...settings.users[userId],
      ...newSettings
    };
    
    // Write updated settings
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      stepLogger.info('USER_SETTINGS_UPDATED', { userId });
    } catch (error) {
      stepLogger.error('SETTINGS_WRITE_ERROR', { userId, error: error.message });
    }
    
    return { ...settings.users[userId] };
  } catch (error) {
    stepLogger.error('UPDATE_USER_SETTINGS_ERROR', { userId, error: error.message });
    return { instagram: { sendMedia: true, sendCaption: false } };
  }
}

module.exports = {
  getUserSettings,
  updateUserSettings,
};