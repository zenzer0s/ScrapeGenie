const express = require('express');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const Queue = require('bull');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

/**
 * Check if Redis is available
 * @returns {Promise<boolean>}
 */
async function isRedisAvailable() {
  try {
    const { stdout } = await exec('redis-cli ping');
    return stdout.trim() === 'PONG';
  } catch (error) {
    console.error(`Redis check failed: ${error.message}`);
    return false;
  }
}

/**
 * Set up the Bull queue dashboard
 * @param {Express} app - The Express application
 * @returns {Promise<Object>} Dashboard functions
 */
async function setupQueueDashboard(app) {
  try {
    // Check Redis availability
    const redisOk = await isRedisAvailable();
    
    if (!redisOk) {
      console.warn('⚠️ Redis unavailable. Setting up fallback page.');
      app.get('/admin/queues', (req, res) => {
        res.send(`
          <html>
            <head><title>Queue Dashboard - Redis Unavailable</title></head>
            <body>
              <h1>Redis Unavailable</h1>
              <p>The queue dashboard cannot connect to Redis.</p>
              <p>Run: sudo systemctl start redis</p>
              <button onclick="location.reload()">Retry</button>
            </body>
          </html>
        `);
      });
      return {};
    }
    
    // Simple authentication middleware
    const auth = (req, res, next) => {
      const authHeader = req.headers.authorization;
      const expected = Buffer.from('admin:admin').toString('base64');
      
      if (!authHeader || authHeader !== `Basic ${expected}`) {
        res.set('WWW-Authenticate', 'Basic realm="Bull Dashboard"');
        return res.status(401).send('Authentication required');
      }
      
      next();
    };
    
    // Create queue reference
    const linkQueue = new Queue('link-processing', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    // Create dashboard
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    
    const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
      queues: [new BullAdapter(linkQueue)],
      serverAdapter
    });
    
    // Mount dashboard UI
    app.use('/admin/queues', auth, serverAdapter.getRouter());
    
    console.log('📊 Queue dashboard mounted at /admin/queues');
    return { addQueue, removeQueue, setQueues, replaceQueues };
    
  } catch (error) {
    console.error(`❌ Dashboard setup error: ${error.message}`);
    app.get('/admin/queues', (req, res) => {
      res.status(500).send(`
        <html>
          <head><title>Queue Dashboard - Error</title></head>
          <body>
            <h1>Queue Dashboard Error</h1>
            <p>Error: ${error.message}</p>
            <button onclick="location.reload()">Retry</button>
          </body>
        </html>
      `);
    });
    return {};
  }
}

module.exports = { setupQueueDashboard };