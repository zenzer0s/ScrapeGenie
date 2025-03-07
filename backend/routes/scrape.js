// scrape.js (routes)
const express = require('express');
const ytScraper = require('../scraper/ytScraper');
const instaScraper = require('../scraper/instaScraper');
const { scrapePinterest } = require('../scraper/scraper'); // Import the scrapePinterest function
const { scrapeMetadata } = require('../scraper/metadata');
const sessionManager = require('../services/sessionManager');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { url, userId } = req.body;
        
        console.log(`Scrape request received for URL: ${url}`);
        if (userId) {
            console.log(`Request includes userID: ${userId}`);
        }

        if (!url) {
            return res.status(400).json({ 
                success: false, 
                error: "URL is required" 
            });
        }

        let result;
        
        // Handle YouTube videos and shorts
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            result = await ytScraper(url);
        }
        // Handle Instagram posts and reels
        else if (url.includes('instagram.com')) {
            result = await instaScraper(url);
        }
        // Handle Pinterest pins with session if available
        else if (url.includes('pinterest.com') || url.includes('pin.it')) {
            console.log('Pinterest URL detected, checking for session');
            
            let cookies = [];
            if (userId) {
                const session = sessionManager.getSession(userId);
                if (session && session.service === 'pinterest') {
                    cookies = session.cookies;
                    console.log(`Found session for user ${userId} with ${cookies.length} cookies`);
                    
                    const cookieNames = cookies.map(c => c.name).join(', ');
                    console.log(`Cookie names: ${cookieNames}`);
                } else {
                    console.log(`No valid session found for user ${userId}`);
                }
            }
            
            try {
                result = await scrapePinterest(url, userId);
                if (!result.success && !cookies.length) {
                    result.requiresAuthentication = true;
                }
            } catch (error) {
                console.error('Error scraping Pinterest:', error);
                
                // Return a proper error response with more details
                return res.status(400).json({
                    success: false,
                    error: `Failed to process Pinterest URL: ${error.message}`,
                    details: error.stack
                });
            }
        }
        // Handle any other URL
        else {
            result = await scrapeMetadata(url);
        }

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to scrape data" 
        });
    }
});

router.post('/pinterest', async (req, res) => {
  const { url, userId } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    const result = await scrapePinterest(url, userId);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;