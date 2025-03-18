const stepLogger = require('../utils/stepLogger');

// Simple in-memory queue for status checking
const memoryQueue = {
  waiting: [],
  active: [],
  completed: [],
  failed: []
};

/**
 * Initialize the queue (compatibility function)
 * @returns {Promise<boolean>} Always returns true
 */
async function initQueue() {
  stepLogger.info('INIT_QUEUE_START');
  stepLogger.success('INIT_QUEUE_SUCCESS', { queueEnabled: true });
  return true;
}

/**
 * Add a job to the processing queue
 * @param {string} url - URL to process
 * @param {string|number} chatId - Chat ID
 * @param {string|number} userId - User ID 
 * @param {number|object} messageId - Message ID or batch info
 * @returns {Promise<object>} Job object with ID
 */
async function addLinkToQueue(url, chatId, userId, messageId) {
  // Create a job-like object for compatibility
  const jobId = Date.now().toString() + Math.floor(Math.random() * 1000);
  
  const job = {
    id: jobId,
    data: { url, chatId, userId, messageId },
    timestamp: Date.now()
  };
  
  memoryQueue.waiting.push(job);
  stepLogger.info('URL_ADDED_TO_MEMORY_QUEUE', { 
    jobId: job.id,
    url: url.substring(0, 50)
  });
  
  return job;
}

/**
 * Get current queue statistics (compatibility function)
 * @returns {Promise<object>} Queue statistics
 */
async function getQueueStats() {
  return {
    waiting: memoryQueue.waiting.length, 
    active: memoryQueue.active.length,
    completed: memoryQueue.completed.length, 
    failed: memoryQueue.failed.length,
    delayed: 0,
    total: memoryQueue.waiting.length + memoryQueue.active.length,
    status: 'enabled'
  };
}

/**
 * Check if queue is enabled (compatibility function)
 * @returns {boolean} Always returns true
 */
function isQueueEnabled() {
  return true;
}

/**
 * Shutdown queue (compatibility function)
 * @returns {Promise<void>}
 */
async function shutdownQueue() {
  stepLogger.info('QUEUE_SHUTDOWN_START');
  // Clear memory queues
  memoryQueue.waiting = [];
  memoryQueue.active = [];
  stepLogger.success('QUEUE_SHUTDOWN_COMPLETE');
  return true;
}

module.exports = {
  initQueue,
  addLinkToQueue,
  getQueueStats,
  isQueueEnabled,
  shutdownQueue,
  // Compatibility with the getter
  get linkQueue() { return null; }
};