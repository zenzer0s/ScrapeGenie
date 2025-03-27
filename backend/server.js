const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const requestLogCache = {};
const LOG_DEBOUNCE_MS = 5000;

// Ensure RAM disk directory exists
const INSTAGRAM_TMP_DIR = "/dev/shm/instagram_tmp";

try {
  if (!fs.existsSync(INSTAGRAM_TMP_DIR)) {
    fs.mkdirSync(INSTAGRAM_TMP_DIR, { recursive: true });
    console.log(`📂 Created Instagram RAM disk directory: ${INSTAGRAM_TMP_DIR}`);
  } else {
    console.log(`📂 Using existing Instagram RAM disk directory: ${INSTAGRAM_TMP_DIR}`);
    
    // Clean up existing files on startup
    const files = fs.readdirSync(INSTAGRAM_TMP_DIR);
    if (files.length > 0) {
      exec(`rm -rf ${INSTAGRAM_TMP_DIR}/*`, (error) => {
        if (error) {
          console.error(`❌ Error cleaning RAM disk: ${error}`);
        } else {
          console.log(`🧹 Cleaned ${files.length} files from RAM disk on startup`);
        }
      });
    }
  }
} catch (error) {
  console.error(`❌ RAM disk setup error: ${error.message}`);
  console.log(`⚠️ Falling back to regular file system`);
}

// Ensure the data and sessions directories exist
const dataDir = path.join(__dirname, '../data');
const sessionsDir = path.join(dataDir, 'sessions');

if (!require('fs').existsSync(dataDir)) {
  require('fs').mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory');
}

if (!require('fs').existsSync(sessionsDir)) {
  require('fs').mkdirSync(sessionsDir, { recursive: true });
  console.log('Created sessions directory');
}

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
app.use(cors());

// Request body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Add this middleware to reduce repetitive HTTP logs
app.use((req, res, next) => {
    // Skip logging for static files and frequent API calls
    if (req.path.startsWith('/api/google/status') || 
        req.path.includes('.') || // Skip static files (.js, .css, etc)
        req.path === '/healthcheck') {
        return next();
    }
    
    // Use a timer to measure response time
    const start = Date.now();
    
    // Override end method to log when the response is sent
    const originalEnd = res.end;
    res.end = function() {
        const duration = Date.now() - start;
        // Log in a cleaner format with less detail
        if (duration > 1000) { // Only log responses that take more than 1 second
            console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
        }
        originalEnd.apply(res, arguments);
    };
    
    next();
});

// Replace or update your request logging middleware
app.use((req, res, next) => {
    // Skip logging for frequently accessed endpoints
    if (req.path.includes('.') || // Static files
        req.path === '/healthcheck' ||
        (req.path.startsWith('/api/google/status') && req.method === 'GET')) {
        return next();
    }
    
    // Create a cache key based on method, path and query params
    const cacheKey = `${req.method}_${req.path}_${JSON.stringify(req.query)}`;
    const now = Date.now();
    
    // Don't log if we've seen this exact request recently
    if (requestLogCache[cacheKey] && (now - requestLogCache[cacheKey] < LOG_DEBOUNCE_MS)) {
        return next();
    }
    
    // Update cache
    requestLogCache[cacheKey] = now;
    
    // Use a timer to measure response time
    const start = Date.now();
    
    // Override end method to log when the response is sent
    const originalEnd = res.end;
    res.end = function() {
        const duration = Date.now() - start;
        
        // Only log if the response takes significant time
        if (duration > 200) { // Only log responses that take more than 200ms
            console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
        }
        
        originalEnd.apply(res, arguments);
    };
    
    next();
});

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Dynamically load available routes
const routesDir = path.join(__dirname, 'routes');
const availableEndpoints = ['/health'];

if (fs.existsSync(routesDir)) {
  fs.readdirSync(routesDir).forEach(file => {
    if (file.endsWith('.js')) {
      const routeName = file.replace('.js', '');
      const routePath = `/api/${routeName}`;
      try {
        const router = require(`./routes/${routeName}`);
        app.use(routePath, router);
        availableEndpoints.push(routePath);
        console.log(`✅ Route loaded: ${routePath}`);
      } catch (err) {
        console.error(`Failed to load route ${routePath}:`, err.message);
      }
    }
  });
} else {
  console.warn('Routes directory not found:', routesDir);
}

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'ScrapeGenie API Server',
    version: '1.0.0',
    endpoints: availableEndpoints
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
