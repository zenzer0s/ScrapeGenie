const Queue = require('bull');
const path = require('path');
const fs = require('fs');

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

// Create the processing queue
const linkQueue = new Queue('link-processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
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

// Set up event handlers for the queue
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
});

// Function to add a job to the queue
async function addLinkToQueue(url, chatId, userId, messageId) {
  try {
    const job = await linkQueue.add({
      url,
      chatId,
      userId,
      messageId,
      timestamp: Date.now()
    });
    
    logQueue(`➕ Added job ${job.id} to queue: ${url} for chat ${chatId}`);
    return job;
  } catch (error) {
    logQueue(`❌ Failed to add job to queue: ${error.message}`);
    throw error;
  }
}

// Get queue statistics
async function getQueueStats() {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      linkQueue.getWaitingCount(),
      linkQueue.getActiveCount(),
      linkQueue.getCompletedCount(),
      linkQueue.getFailedCount()
    ]);
    
    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active
    };
  } catch (error) {
    logQueue(`❌ Failed to get queue stats: ${error.message}`);
    return { error: error.message };
  }
}

module.exports = {
  linkQueue,
  addLinkToQueue,
  getQueueStats
};