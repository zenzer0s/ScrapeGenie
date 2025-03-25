const { googleConnectCommand } = require('./googleConnectCommand');
const { googleStatusCommand } = require('./googleStatusCommand');
const { 
    googleDisconnectCommand, 
    handleDisconnectCallback 
} = require('./googleDisconnectCommand');

// Map of commands to their handlers
const googleCommands = {
    'google_connect': googleConnectCommand,
    'google_status': googleStatusCommand,
    'google_disconnect': googleDisconnectCommand
};

// Callback query handlers
const googleCallbacks = {
    'google_disconnect_confirm': handleDisconnectCallback,
    'google_disconnect_cancel': handleDisconnectCallback
};

// Register Google commands with bot
function registerGoogleCommands(bot) {
    // Register command handlers
    Object.entries(googleCommands).forEach(([command, handler]) => {
        bot.onText(new RegExp(`/${command}`), (msg) => handler(bot, msg));
    });

    // Register callback query handlers
    bot.on('callback_query', (query) => {
        const handler = googleCallbacks[query.data];
        if (handler) {
            handler(bot, query);
        }
    });

    // Add command descriptions
    bot.setMyCommands([
        // ...existing commands...
        { command: 'google_connect', description: 'Connect Google Sheets' },
        { command: 'google_status', description: 'Check Google Sheets connection' },
        { command: 'google_disconnect', description: 'Disconnect Google Sheets' }
    ]);
}

module.exports = {
    registerGoogleCommands,
    googleCommands,
    googleCallbacks
};