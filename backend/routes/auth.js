const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sessionManager = require('../services/sessionManager');
// Force a fresh import of the Pinterest scraper
const pinterestScraper = require('../scraper/pinterestScraper.js'); // Add .js extension
const router = express.Router();

const DEFAULT_BACKEND_URL = `http://0.0.0.0:${process.env.PORT || 8080}`;
const BACKEND_URL = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;

// Store temporary login tokens and user sessions
const pendingLogins = new Map();
const userSessions = new Map();

// Serve the login page
router.get('/login/:token', (req, res) => {
  const { token } = req.params;
  
  // Check if token is valid
  if (!pendingLogins.has(token)) {
    return res.status(400).send('Invalid or expired login link');
  }
  
  // Serve the login HTML page
  res.sendFile(path.join(__dirname, '../public/pinterest-login.html'));
});

// Generate a login token and URL
router.post('/generate-token', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  // Generate a unique token
  const token = uuidv4();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
  
  // Store token with user ID
  pendingLogins.set(token, {
    userId,
    expiresAt
  });
  
  console.log(`Generated login token for user ${userId}: ${token}`);
  
  // Clean up expired tokens every 15 minutes
  setTimeout(() => {
    if (pendingLogins.has(token)) {
      pendingLogins.delete(token);
    }
  }, 15 * 60 * 1000);
  
  // Return the login URL with fallback
  const loginUrl = `${BACKEND_URL}/api/auth/login/${token}`;
  console.log(`Generated login URL: ${loginUrl}`); // Add this for debugging
  
  res.json({
    success: true,
    loginUrl,
    expiresAt
  });
});

// Update the login route handler
router.post('/login/:token', async (req, res) => {
  const { token } = req.params;
  const { username, password } = req.body;
  
  console.log(`Received login request for token: ${token}`);
  
  // Check if token is valid
  if (!pendingLogins.has(token)) {
    return res.status(400).json({ success: false, error: 'Invalid or expired token' });
  }
  
  const { userId } = pendingLogins.get(token);
  console.log(`Processing login for user: ${userId}`);
  
  try {
    console.log(`Attempting to login to Pinterest with username: ${username.substring(0, 3)}***`);
    
    // Get session data directly from loginToPinterest
    const result = await pinterestScraper.loginToPinterest(username, password);
    
    if (!result.success) {
      console.log(`Login failed: ${result.error}`);
      return res.status(401).json({ success: false, error: result.error });
    }
    
    // Save the session using sessionManager
    sessionManager.saveSession(userId, {
      service: 'pinterest',
      cookies: result.cookies,
      localStorage: result.localStorage,
      userAgent: result.userAgent,
      createdAt: Date.now()
    });
    
    // Clean up the pending login
    pendingLogins.delete(token);
    
    console.log(`Login successful for user: ${userId}`);
    return res.json({ success: true });
  } catch (error) {
    console.log(`Login failed: ${error.message}`);
    return res.status(401).json({ success: false, error: error.message });
  }
});

// Check login status
router.get('/status', (req, res) => {
  const { userId } = req.query;
  
  console.log(`Checking login status for user: ${userId}`);
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID required' });
  }
  
  const session = sessionManager.getSession(userId);
  console.log(`Session found: ${!!session}`);
  
  if (session) {
    console.log(`Session has ${session.cookies ? session.cookies.length : 0} cookies`);
    console.log(`Session created at: ${new Date(session.createdAt).toISOString()}`);
  }
  
  const isLoggedIn = !!session && session.service === 'pinterest' && 
                    Array.isArray(session.cookies) && session.cookies.length > 0;
  
  console.log(`Is user logged in: ${isLoggedIn}`);
  
  return res.json({ success: true, isLoggedIn });
});

// Log out (delete session)
router.post('/logout', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  const result = sessionManager.deleteSession(userId);
  
  return res.json({
    success: true,
    loggedOut: result
  });
});

module.exports = router;