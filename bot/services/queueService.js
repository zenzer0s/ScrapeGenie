const Queue = require('bull');
const config = require('../config/botConfig');
const stepLogger = require('../utils/stepLogger');

// Queue setup - use a module object instead of separate variables
const queueState = {
  linkQueue: null,
  queueEnabled: false
};

/**
 * Initialize the queue
 * @returns {Promise<boolean>} Success or failure
 */
async function initQueue() {
  stepLogger.info('INIT_QUEUE_START');
  
  try {
    // Skip if already initialized
    if (queueState.queueEnabled && queueState.linkQueue) {
      stepLogger.info('QUEUE_ALREADY_ACTIVE');
      return true;
    }
    
    // Create Bull queue with Redis connection
    queueState.linkQueue = new Queue('link-processing', {
      redis: config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200      // Keep last 200 failed jobs
      }
    });
    
    // Set up queue event handlers with proper logging
    queueState.linkQueue.on('completed', job => {
      stepLogger.success('QUEUE_JOB_COMPLETE', { 
        jobId: job.id, 
        url: job.data.url.substring(0, 50)
      });
    });
    
    queueState.linkQueue.on('failed', (job, err) => {
      stepLogger.error('QUEUE_JOB_FAILED', { 
        jobId: job.id, 
        url: job.data.url.substring(0, 50), 
        error: err.message 
      });
    });
    
    queueState.linkQueue.on('stalled', job => {
      stepLogger.warn('QUEUE_JOB_STALLED', { 
        jobId: job.id, 
        url: job.data.url.substring(0, 50)
      });
    });
    
    queueState.linkQueue.on('error', error => {
      stepLogger.error('QUEUE_ERROR', { error: error.message });
      queueState.queueEnabled = false;
    });
    
    // Test connection by getting job counts
    await queueState.linkQueue.getJobCounts();
    queueState.queueEnabled = true;
    
    // Setup queue maintenance
    setupQueueMaintenance();
    
    stepLogger.success('INIT_QUEUE_SUCCESS', { queueEnabled: true });
    return true;
  } catch (error) {
    stepLogger.error('INIT_QUEUE_FAILED', { error: error.message });
    queueState.queueEnabled = false;
    return false;
  }
}

/**
 * Set up periodic queue maintenance
 */
function setupQueueMaintenance() {
  // Clean old jobs every 12 hours
  setInterval(async () => {
    try {
      if (!queueState.linkQueue) return;
      
      const result = await queueState.linkQueue.clean(1000 * 60 * 60 * 24 * 7, 'completed');
      if (result && result.length > 0) {
        stepLogger.info('QUEUE_CLEANUP_COMPLETED', { 
          count: result.length
        });
      }
      
      const failedResult = await queueState.linkQueue.clean(1000 * 60 * 60 * 24 * 3, 'failed');
      if (failedResult && failedResult.length > 0) {
        stepLogger.info('QUEUE_CLEANUP_FAILED', { 
          count: failedResult.length
        });
      }
    } catch (error) {
      stepLogger.error('QUEUE_CLEANUP_ERROR', { error: error.message });
    }
  }, 12 * 60 * 60 * 1000); // 12 hours
}

/**
 * Add a job to the queue
 * @param {string} url - URL to process
 * @param {string|number} chatId - Chat ID
 * @param {string|number} userId - User ID
 * @param {string|number} messageId - Message ID for status updates
 * @returns {Promise<object>} Job object
 */
async function addLinkToQueue(url, chatId, userId, messageId) {
  try {
    stepLogger.info('ADD_TO_QUEUE_START', { 
      url: url.substring(0, 50), 
      chatId 
    });
    
    // Try to initialize queue if not active
    if (!queueState.queueEnabled || !queueState.linkQueue) {
      stepLogger.warn('QUEUE_NOT_ENABLED', { 
        attemptingInit: true 
      });
      
      const initResult = await initQueue();
      if (!initResult) {
        throw new Error('Queue system disabled and initialization failed');
      }
    }
    
    // Add job to queue
    const job = await queueState.linkQueue.add({
      url,
      chatId,
      userId,
      messageId,
      timestamp: Date.now()
    });
    
    stepLogger.success('ADD_TO_QUEUE_SUCCESS', { 
      jobId: job.id, 
      url: url.substring(0, 50)
    });
    
    return job;
  } catch (error) {
    stepLogger.error('ADD_TO_QUEUE_FAILED', { 
      url: url.substring(0, 50), 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get current queue statistics
 * @returns {Promise<object>} Queue statistics
 */
async function getQueueStats() {
  try {
    if (!queueState.queueEnabled || !queueState.linkQueue) {
      return { 
        waiting: 0, active: 0, completed: 0, failed: 0, 
        delayed: 0, total: 0, status: 'disabled'
      };
    }
    
    // Get counts in parallel for efficiency
    const counts = await queueState.linkQueue.getJobCounts();
    
    return {
      ...counts,
      total: counts.waiting + counts.active,
      status: 'enabled'
    };
  } catch (error) {
    stepLogger.error('GET_QUEUE_STATS_FAILED', { error: error.message });
    return { error: error.message, status: 'error' };
  }
}

/**
 * Check if queue is currently enabled
 * @returns {boolean} Queue status
 */
function isQueueEnabled() {
  return queueState.queueEnabled;
}

/**
 * Gracefully shut down the queue
 * @returns {Promise<void>}
 */
async function shutdownQueue() {
  if (queueState.linkQueue) {
    stepLogger.info('QUEUE_SHUTDOWN_START');
    
    try {
      await queueState.linkQueue.close();
      stepLogger.success('QUEUE_SHUTDOWN_COMPLETE');
    } catch (error) {
      stepLogger.error('QUEUE_SHUTDOWN_ERROR', { error: error.message });
    }
  }
}

// Register graceful shutdown
process.on('SIGTERM', async () => {
  await shutdownQueue();
});

process.on('SIGINT', async () => {
  await shutdownQueue();
});

// Getter for linkQueue
function getLinkQueue() {
  return queueState.linkQueue;
}

// Export functions instead of variables
module.exports = {
  get linkQueue() { return queueState.linkQueue; }, // Getter will always return current value
  addLinkToQueue,
  getQueueStats,
  isQueueEnabled: () => queueState.queueEnabled, // Changed to a function that returns current value
  initQueue,
  shutdownQueue,
  initialized: false
};