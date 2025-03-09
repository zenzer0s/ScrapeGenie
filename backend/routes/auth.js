const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sessionManager = require('../services/sessionManager');
const { loginToPinterest } = require('../scraper/pinterestScraper'); // Ensure this import is correct

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
  const loginUrl = `${BACKEND_URL}/auth/login/${token}`;
  console.log(`Generated login URL: ${loginUrl}`); // Add this for debugging
  
  res.json({
    success: true,
    loginUrl,
    expiresAt
  });
});

// Handle login submission - add better debugging
router.post('/login/:token', async (req, res) => {
  const { token } = req.params;
  const { username, password } = req.body;
  
  console.log(`Received login request for token: ${token}`);
  
  if (!pendingLogins.has(token)) {
    console.log(`Token not found in pendingLogins: ${token}`);
    return res.status(400).json({ success: false, error: 'Invalid or expired token' });
  }
  
  const { userId } = pendingLogins.get(token);
  console.log(`Processing login for user: ${userId}`);
  
  try {
    console.log(`Attempting to login to Pinterest with username: ${username.substring(0, 3)}***`);
    const loginResult = await loginToPinterest(username, password);
    
    if (loginResult.success) {
      // Count cookies for debugging
      console.log(`Login successful! Got ${loginResult.cookies.length} cookies`);
      
      // Log cookie names (not values) for debugging
      const cookieNames = loginResult.cookies.map(c => c.name).join(', ');
      console.log(`Cookie names: ${cookieNames}`);
      
      // Store the session
      sessionManager.saveSession(userId, {
        cookies: loginResult.cookies,
        createdAt: Date.now(),
        service: 'pinterest'
      });
      
      console.log(`Session saved for user ${userId}`);
      pendingLogins.delete(token);
      return res.json({ success: true, message: 'Login successful' });
    } else {
      console.error(`Login failed: ${loginResult.error}`);
      return res.status(401).json({ success: false, error: loginResult.error });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
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