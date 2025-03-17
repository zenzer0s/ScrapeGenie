const Queue = require('bull');
const path = require('path');
const fs = require('fs');
const stepLogger = require('../utils/stepLogger');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a write stream for queue logs
const queueLogStream = fs.createWriteStream(path.join(logsDir, 'queue.log'), { flags: 'a' });

// Helper to log messages to both console and file
function logQueue(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(message);
  queueLogStream.write(logEntry);
}

// Queue setup
let linkQueue;
let queueEnabled = false;

// Initialize the queue
async function initQueue() {
  stepLogger.info('INIT_QUEUE_START');
  try {
    // Create Bull queue with Redis connection
    linkQueue = new Queue('link-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: 100,
        removeOnFail: 200
      }
    });
    
    // Set up queue event handlers
    linkQueue.on('completed', job => {
      logQueue(`✅ Job completed: ${job.id}, URL: ${job.data.url}`);
    });
    
    linkQueue.on('failed', (job, err) => {
      logQueue(`❌ Job failed: ${job.id}, URL: ${job.data.url}, Error: ${err.message}`);
    });
    
    linkQueue.on('stalled', job => {
      logQueue(`⚠️ Job stalled: ${job.id}, URL: ${job.data.url}`);
    });
    
    linkQueue.on('error', error => {
      logQueue(`🔴 Queue error: ${error.message}`);
      queueEnabled = false;
    });
    
    // Test connection
    await linkQueue.getJobCounts();
    queueEnabled = true;
    logQueue('✅ Queue initialized successfully');
    stepLogger.info('INIT_QUEUE_SUCCESS', { queueEnabled: true });
    return true;
  } catch (error) {
    stepLogger.error('INIT_QUEUE_FAILED', { error: error.message });
    logQueue(`❌ Queue initialization failed: ${error.message}`);
    queueEnabled = false;
    return false;
  }
}

// Initialize queue when module is loaded
initQueue();

// Add a job to the queue
async function addLinkToQueue(url, chatId, userId, messageId) {
  try {
    stepLogger.info('ADD_TO_QUEUE_START', { url, chatId });
    
    if (!queueEnabled || !linkQueue) {
      throw new Error('Queue system disabled');
    }
    
    const job = await linkQueue.add({
      url,
      chatId,
      userId,
      messageId,
      timestamp: Date.now()
    });
    
    logQueue(`➕ Added job ${job.id} to queue: ${url} for chat ${chatId}`);
    stepLogger.info('ADD_TO_QUEUE_SUCCESS', { jobId: job.id, url });
    return job;
  } catch (error) {
    stepLogger.error('ADD_TO_QUEUE_FAILED', { url, error: error.message });
    logQueue(`❌ Failed to add job to queue: ${error.message}`);
    throw error;
  }
}

// Get queue statistics
async function getQueueStats() {
  try {
    if (!queueEnabled || !linkQueue) {
      return { 
        waiting: 0, active: 0, completed: 0, failed: 0, total: 0, 
        status: 'disabled'
      };
    }
    
    const [waiting, active, completed, failed] = await Promise.all([
      linkQueue.getWaitingCount().catch(() => 0),
      linkQueue.getActiveCount().catch(() => 0),
      linkQueue.getCompletedCount().catch(() => 0),
      linkQueue.getFailedCount().catch(() => 0)
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active,
      status: 'enabled'
    };
  } catch (error) {
    logQueue(`❌ Failed to get queue stats: ${error.message}`);
    return { error: error.message, status: 'error' };
  }
}

// Function to check if queue is enabled
function isQueueEnabled() {
  return queueEnabled;
}

module.exports = {
  linkQueue,
  addLinkToQueue,
  getQueueStats,
  isQueueEnabled,
  initQueue
};