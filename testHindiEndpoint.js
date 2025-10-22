/**
 * Hindi Font Fallback Test Endpoint
 * 
 * This adds a test endpoint to the export backend server to safely test
 * the Hindi font fallback solution without affecting the main codebase.
 */

const { testHindiFontFallback } = require('./HindiTest');

/**
 * Add test endpoint to the server
 * @param {Object} app - Express app instance
 */
function addHindiTestEndpoint(app) {
  // Test endpoint for Hindi font fallback
  app.get('/test-hindi-font', async (req, res) => {
    try {
      console.log('🧪 Hindi font test endpoint called');
      
      // Run the test
      await testHindiFontFallback();
      
      res.json({
        success: true,
        message: 'Hindi font fallback test completed successfully',
        details: 'Check the server logs for detailed output. The test PDF should be generated in ./temp/hindi-test/hindi-test.pdf'
      });
      
    } catch (error) {
      console.error('❌ Hindi font test failed:', error);
      
      res.status(500).json({
        success: false,
        message: 'Hindi font fallback test failed',
        error: error.message,
        details: 'Check the server logs for detailed error information'
      });
    }
  });
  
  console.log('✅ Hindi font test endpoint added: GET /test-hindi-font');
}

module.exports = { addHindiTestEndpoint };
