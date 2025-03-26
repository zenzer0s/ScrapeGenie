// General commands
const startCommand = require('./general/startCommand');
const helpCommand = require('./general/helpCommand');
const { handleHelpSettings } = require('./general/helpCommand');
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

// Google commands
const googleConnectCommand = require('./google/googleConnectCommand');
const googleStatusCommand = require('./google/googleStatusCommand');
const googleSheetCommand = require('./google/googleSheetCommand');

// Export directly - NO imports from handlers here
module.exports = {
  // General commands
  startCommand,
  helpCommand,
  handleHelpSettings,
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
  
  // Google commands
  googleConnectCommand,
  googleStatusCommand,
  googleSheetCommand
};