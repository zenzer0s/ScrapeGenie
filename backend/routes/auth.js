const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sessionManager = require('../services/sessionManager');
const { loginToPinterest } = require('../scraper/pinterestScraper');

const router = express.Router();

const DEFAULT_BACKEND_URL = `http://localhost:${process.env.PORT || 5000}`;
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

// Handle login submission
router.post('/login/:token', async (req, res) => {
  const { token } = req.params;
  const { username, password } = req.body;
  
  // Validate the token
  if (!pendingLogins.has(token)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
  
  // Get the associated user ID
  const { userId } = pendingLogins.get(token);
  
  try {
    // Attempt to login to Pinterest
    const loginResult = await loginToPinterest(username, password);
    
    if (!loginResult.success) {
      return res.status(401).json({
        success: false,
        error: loginResult.error
      });
    }
    
    // Store the session cookies
    const sessionData = {
      cookies: loginResult.cookies,
      createdAt: Date.now(),
      service: 'pinterest'
    };
    
    sessionManager.saveSession(userId, sessionData);
    
    // Remove the used token
    pendingLogins.delete(token);
    
    // Return success
    return res.json({
      success: true,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
});

// Check login status
router.get('/status', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  // Check if user has a valid session
  const session = sessionManager.getSession(userId);
  
  if (!session) {
    return res.json({ success: true, isLoggedIn: false });
  }
  
  // Check if session is expired (consider sessions valid for 30 days)
  const SESSION_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days
  const isExpired = Date.now() - session.createdAt > SESSION_EXPIRY;
  
  if (isExpired) {
    // Delete expired session
    sessionManager.deleteSession(userId);
    return res.json({ success: true, isLoggedIn: false });
  }
  
  return res.json({ 
    success: true, 
    isLoggedIn: true,
    service: session.service
  });
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