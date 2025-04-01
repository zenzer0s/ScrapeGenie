const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sessionManager = require('../services/sessionManager');
const pinterestScraper = require('../scraper/pinterestScraper.js');
const router = express.Router();

const DEFAULT_BACKEND_URL = `http://0.0.0.0:${process.env.PORT || 8080}`;
const BACKEND_URL = process.env.BACKEND_URL || DEFAULT_BACKEND_URL;

const pendingLogins = new Map();

// Serve the login page
router.get('/login/:token', (req, res) => {
  const { token } = req.params;
  
  if (!pendingLogins.has(token)) {
    return res.status(400).send('Invalid or expired login link');
  }
  
  res.sendFile(path.join(__dirname, '../public/pinterest-login.html'));
});

// Generate a login token and URL
router.post('/generate-token', (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  const token = uuidv4();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes expiry
  
  pendingLogins.set(token, { userId, expiresAt });
  
  // Clean up token after expiry
  setTimeout(() => pendingLogins.delete(token), 15 * 60 * 1000);
  
  const loginUrl = `${BACKEND_URL}/api/auth/login/${token}`;
  
  res.json({
    success: true,
    loginUrl,
    expiresAt
  });
});

// Handle login
router.post('/login/:token', async (req, res) => {
  const { token } = req.params;
  const { username, password } = req.body;
  
  if (!pendingLogins.has(token)) {
    return res.status(400).json({ success: false, error: 'Invalid or expired token' });
  }
  
  const { userId } = pendingLogins.get(token);
  
  try {
    const result = await pinterestScraper.loginToPinterest(username, password);
    
    if (!result.success) {
      return res.status(401).json({ success: false, error: result.error });
    }
    
    // Save session and clean up
    sessionManager.saveSession(userId, {
      service: 'pinterest',
      cookies: result.cookies,
      localStorage: result.localStorage,
      userAgent: result.userAgent,
      createdAt: Date.now()
    });
    
    pendingLogins.delete(token);
    
    return res.json({ success: true });
  } catch (error) {
    return res.status(401).json({ success: false, error: error.message });
  }
});

// Check login status
router.get('/status', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID required' });
  }
  
  const session = sessionManager.getSession(userId);
  
  const isLoggedIn = Boolean(session && 
                            session.service === 'pinterest' && 
                            Array.isArray(session.cookies) && 
                            session.cookies.length > 0);
  
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

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  pendingLogins.forEach((value, token) => {
    if (value.expiresAt < now) {
      pendingLogins.delete(token);
    }
  });
}, 15 * 60 * 1000);

module.exports = router;