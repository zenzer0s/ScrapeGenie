// General commands
const startCommand = require('./general/startCommand');
const helpCommand = require('./general/helpCommand');
const statusCommand = require('./general/statusCommand');
const usageCommand = require('./general/usageCommand');
const { settingsCommand } = require('./general/settingsCommand');

// Pinterest commands
const pinterestLoginCommand = require('./pinterest/pinterestLoginCommand');
const pinterestLogoutCommand = require('./pinterest/pinterestLogoutCommand');
const pinterestStatusCommand = require('./pinterest/pinterestStatusCommand');

// Admin commands
const addAdminCommand = require('./admin/addAdminCommand');
const removeAdminCommand = require('./admin/removeAdminCommand');

// Handlers
const { handleSettingsCallback } = require('../handlers/settingsHandler');
const { handleCallbackQuery } = require('../handlers/callbackHandler');

// Export all commands
module.exports = {
  // General commands
  startCommand,
  helpCommand,
  statusCommand,
  usageCommand,
  settingsCommand,
  
  // Pinterest commands
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand,
  
  // Admin commands
  addAdminCommand,
  removeAdminCommand,

  // Handlers
  handleSettingsCallback,
  handleCallbackQuery,
};