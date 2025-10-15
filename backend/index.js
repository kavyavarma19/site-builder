import express from 'express';
import bodyParser from 'body-parser';
import { generateSite, deployToVercel } from './services.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(bodyParser.json());

// Discovery information (reuse for multiple endpoints)
const discoveryInfo = {
  name: "Neo Site Builder",
  description: "Generates and deploys websites via Vercel",
  endpoints: [
    {
      path: "/api/createWebsite",
      method: "POST",
      description: "Creates a website with the given name, theme, and domain"
    }
  ]
};

// Root endpoint
app.get('/', (req, res) => res.json(discoveryInfo));

// MCP JSON endpoints (supports both URL variants)
app.get(['/mcp/json', '/mcp.json'], (req, res) => res.json(discoveryInfo));

// Main API endpoint
app.post('/api/createWebsite', async (req, res) => {
  try {
    const { site_name, theme, domain } = req.body;

    if (!site_name || !theme) {
      return res.status(400).json({ success: false, message: "Missing site_name or theme" });
    }

    // Generate site files
    let files;
    try {
      files = await generateSite({ site_name, theme });
    } catch (err) {
      console.error("Error generating site:", err);
      return res.status(500).json({ success: false, message: "Site generation failed", error: err.message });
    }

    // Deploy to Vercel
    let deployResult;
    try {
      deployResult = await deployToVercel({
        files,
        name: site_name,
        domain,
        token: process.env.VERCEL_TOKEN
      });
    } catch (err) {
      console.error("Error deploying to Vercel:", err);
      return res.status(500).json({ success: false, message: "Vercel deployment failed", error: err.message });
    }

    // Success response
    res.json({ success: true, siteUrl: deployResult.url });

  } catch (err) {
    console.error("Unexpected error in /api/createWebsite:", err);
    res.status(500).json({ success: false, message: "Unexpected server error", error: err.message });
  }
});

// Catch-all for unhandled routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Endpoint not found" });
});

// Global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP server listening on port ${PORT}`));
