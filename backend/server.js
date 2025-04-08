const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Constants
const PORT = process.env.PORT || 8080;
const INSTAGRAM_TMP_DIR = "/dev/shm/instagram_tmp";
const LOG_DEBOUNCE_MS = 5000;
const requestLogCache = {};

// Directory paths
const dirs = {
  data: path.join(__dirname, '../data'),
  sessions: path.join(__dirname, '../data/sessions'),
  routes: path.join(__dirname, 'routes'),
  public: path.join(__dirname, 'public')
};

// Ensure required directories exist
function setupDirectories() {
  [dirs.data, dirs.sessions, INSTAGRAM_TMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Clean RAM disk
  if (fs.existsSync(INSTAGRAM_TMP_DIR)) {
    const files = fs.readdirSync(INSTAGRAM_TMP_DIR);
    if (files.length > 0) {
      exec(`rm -rf ${INSTAGRAM_TMP_DIR}/*`);
    }
  }
}

// Load routes dynamically
function loadRoutes(app) {
  const availableEndpoints = ['/health'];
  
  if (!fs.existsSync(dirs.routes)) {
    return availableEndpoints;
  }

  fs.readdirSync(dirs.routes)
    .filter(file => file.endsWith('.js'))
    .forEach(file => {
      const routeName = file.replace('.js', '');
      const routePath = `/api/${routeName}`;
      try {
        const router = require(`./routes/${routeName}`);
        app.use(routePath, router);
        availableEndpoints.push(routePath);
      } catch (err) {
        console.error(`❌ Route load failed ${routePath}:`, err.message);
      }
    });

  return availableEndpoints;
}

// Request logger middleware
function createRequestLogger() {
  return (req, res, next) => {
    if (req.path.includes('.') || 
        req.path === '/healthcheck' ||
        (req.path.startsWith('/api/google/status') && req.method === 'GET')) {
      return next();
    }
    
    const cacheKey = `${req.method}_${req.path}_${JSON.stringify(req.query)}`;
    const now = Date.now();
    
    if (requestLogCache[cacheKey] && (now - requestLogCache[cacheKey] < LOG_DEBOUNCE_MS)) {
      return next();
    }
    
    requestLogCache[cacheKey] = now;
    
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  };
}

// Initialize Express app
function createApp() {
  const app = express();
  
  // Basic middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(express.static(dirs.public));
  app.use(createRequestLogger());

  // Load routes
  const availableEndpoints = loadRoutes(app);

  // Health check
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

  // Error handler
  app.use((err, req, res, next) => {
    console.error(`❌ ${err.message}`);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}

// Start server
async function startServer() {
  try {
    setupDirectories();
    const app = createApp();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
