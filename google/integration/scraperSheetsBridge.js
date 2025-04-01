const scraper = require('../../backend/scraper/scraperManager');
const sheetsIntegration = require('./sheetsIntegration');

class ScraperSheetsBridge {
    async scrapeAndStore(url, userId, sheetsConfig) {
        try {
            // First scrape the website
            const scrapeResult = await scraper.scrapeContent(url, userId);

            // If scrape was successful and it's a general website
            if (scrapeResult.success && scrapeResult.type === 'website') {
                // Store in Google Sheets
                await sheetsIntegration.storeWebsiteMetadata(
                    sheetsConfig.spreadsheetId,
                    sheetsConfig.tokens,
                    {
                        title: scrapeResult.title,
                        url: scrapeResult.originalUrl,
                        description: scrapeResult.content
                    }
                );

                return {
                    ...scrapeResult,
                    sheetUpdated: true
                };
            }

            // Return original result for non-website content
            return scrapeResult;

        } catch (error) {
            console.error('Scraper-Sheets Bridge Error:', error);
            return {
                success: false,
                error: error.message,
                sheetUpdated: false
            };
        }
    }
}

module.exports = new ScraperSheetsBridge();