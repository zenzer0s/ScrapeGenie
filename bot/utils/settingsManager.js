const fs = require('fs');
const path = require('path');
const stepLogger = require('../utils/stepLogger');

const settingsPath = path.join(__dirname, '../../data/settings.json');

// Ensure settings.json exists
function ensureSettingsFile() {
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ users: {} }, null, 2));
    stepLogger.info('SETTINGS_FILE_CREATED', { path: settingsPath });
  }
}

// Get user settings
function getUserSettings(userId) {
  ensureSettingsFile();
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings.users[userId]) {
    // Initialize default settings for new users
    settings.users[userId] = { instagram: { sendMedia: true, sendCaption: true } };
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    stepLogger.info('DEFAULT_SETTINGS_INITIALIZED', { userId });
  }
  stepLogger.debug('USER_SETTINGS_RETRIEVED', { userId, settings: settings.users[userId] });
  return settings.users[userId];
}

// Update user settings
function updateUserSettings(userId, newSettings) {
  ensureSettingsFile();
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  if (!settings.users[userId]) {
    settings.users[userId] = { instagram: { sendMedia: true, sendCaption: true } };
  }
  settings.users[userId] = { ...settings.users[userId], ...newSettings };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  stepLogger.info('USER_SETTINGS_UPDATED', { userId, newSettings });
}

module.exports = {
  getUserSettings,
  updateUserSettings,
};