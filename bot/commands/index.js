// General commands
const startCommand = require('./general/startCommand');
const helpCommand = require('./general/helpCommand');
const statusCommand = require('./general/statusCommand');
const usageCommand = require('./general/usageCommand');

// Pinterest commands
const pinterestLoginCommand = require('./pinterest/pinterestLoginCommand');
const pinterestLogoutCommand = require('./pinterest/pinterestLogoutCommand');
const pinterestStatusCommand = require('./pinterest/pinterestStatusCommand');

// Admin commands
const addAdminCommand = require('./admin/addAdminCommand');
const removeAdminCommand = require('./admin/removeAdminCommand');

// Export all commands
module.exports = {
  // General commands
  startCommand,
  helpCommand,
  statusCommand,
  usageCommand,
  
  // Pinterest commands
  pinterestLoginCommand,
  pinterestLogoutCommand,
  pinterestStatusCommand,
  
  // Admin commands
  addAdminCommand,
  removeAdminCommand
};