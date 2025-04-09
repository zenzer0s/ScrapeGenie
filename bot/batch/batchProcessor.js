const { v4: uuidv4 } = require('uuid');
const { callScrapeApi } = require('../services/apiService');
const { routeContent } = require('../handlers/contentRouter');
const { truncateUrl } = require('../utils/urlUtils');
const stepLogger = require('../utils/stepLogger');

const activeBatches = new Map();
const BATCH_TIMEOUT = 60 * 60 * 1000; // 1 hour
const ITEM_DELAY = 500; // ms between items

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

const createBatch = (links, chatId, userId) => {
  const batchId = uuidv4();
  const batch = {
    id: batchId,
    chatId,
    userId,
    createdAt: Date.now(),
    statusMessageId: null,
    links: links.map((url, index) => ({
      url, index, status: STATUS.PENDING, data: null, error: null
    })),
    stats: {
      total: links.length,
      pending: links.length,
      completed: 0,
      failed: 0
    }
  };
  
  activeBatches.set(batchId, batch);
  stepLogger.info('BATCH_CREATED', { batchId, chatId, linkCount: links.length });
  return batchId;
};

const updateStatus = async (bot, batch) => {
  if (!batch?.statusMessageId) return;
  
  const { stats } = batch;
  const progress = Math.round((stats.completed + stats.failed) / stats.total * 100);
  
  const message = [
    `📋 *Batch Processing*\n`,
    `Links: ${stats.total} total`,
    `✅ Completed: ${stats.completed}`,
    `⏳ Pending: ${stats.pending}`,
    `❌ Failed: ${stats.failed}`,
    `🔄 Progress: ${progress}%\n`,
    `📝 *Links Status:*`,
    ...batch.links.map((link, idx) => {
      const emoji = {
        [STATUS.COMPLETED]: '✅',
        [STATUS.FAILED]: '❌',
        [STATUS.PROCESSING]: '⏳',
        [STATUS.PENDING]: '⏳'
      }[link.status];
      return `${emoji} ${idx + 1}. ${truncateUrl(link.url)}`;
    })
  ].join('\n');

  try {
    await bot.editMessageText(message, {
      chat_id: batch.chatId,
      message_id: batch.statusMessageId,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    stepLogger.debug('STATUS_UPDATE_FAILED', { batchId: batch.id });
  }
};

const processItem = async (bot, batchId, index) => {
  const batch = activeBatches.get(batchId);
  if (!batch) return;

  const item = batch.links[index];
  item.status = STATUS.PROCESSING;
  await updateStatus(bot, batch);

  try {
    const data = await callScrapeApi(item.url, batch.userId);
    item.status = STATUS.COMPLETED;
    item.data = data;
    batch.stats.pending--;
    batch.stats.completed++;
    
    await Promise.all([
      updateStatus(bot, batch),
      routeContent(bot, batch.chatId, item.url, data)
    ]);
  } catch (error) {
    item.status = STATUS.FAILED;
    item.error = error.message;
    batch.stats.pending--;
    batch.stats.failed++;
    await updateStatus(bot, batch);
  }
};

const submitBatch = async (batchId, bot) => {
  const batch = activeBatches.get(batchId);
  if (!batch) throw new Error(`Batch ${batchId} not found`);

  try {
    const statusMsg = await bot.sendMessage(batch.chatId, '🔄 Initializing batch...');
    batch.statusMessageId = statusMsg.message_id;
    
    for (let i = 0; i < batch.links.length; i++) {
      await processItem(bot, batchId, i);
      if (i < batch.links.length - 1) {
        await new Promise(resolve => setTimeout(resolve, ITEM_DELAY));
      }
    }

    setTimeout(() => {
      activeBatches.delete(batchId);
      stepLogger.info('BATCH_CLEANUP', { batchId });
    }, BATCH_TIMEOUT);

    return true;
  } catch (error) {
    activeBatches.delete(batchId);
    await bot.sendMessage(batch.chatId, `❌ Batch processing failed: ${error.message}`);
    throw error;
  }
};

const updateBatchItemStatus = async (bot, batchId, index, dataOrError, success) => {
  const batch = activeBatches.get(batchId);
  if (!batch) return;

  const item = batch.links[index];
  if (success) {
    item.status = STATUS.COMPLETED;
    item.data = dataOrError;
    batch.stats.pending--;
    batch.stats.completed++;
  } else {
    item.status = STATUS.FAILED;
    item.error = dataOrError.message || 'Unknown error';
    batch.stats.pending--;
    batch.stats.failed++;
  }
  
  await updateStatus(bot, batch);
};

module.exports = { createBatch, submitBatch, updateBatchItemStatus };