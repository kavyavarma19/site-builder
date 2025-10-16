import express from 'express';
import bodyParser from 'body-parser';
import { generateSite, deployToVercel } from './services.js';
import dotenv from 'dotenv';
dotenv.config();

const app = express();

// Enable CORS for all origins (required for ChatGPT MCP)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json());

// MCP Server Configuration
const mcpServerInfo = {
  name: "Neo Site Builder",
  description: "Generates and deploys websites via Vercel",
  version: "1.0.0"
};

// MCP Tools Definition
const mcpTools = [
  {
    name: "search",
    description: "Search for website templates and themes",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for website templates or themes"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "fetch",
    description: "Fetch details about a specific website template or deployment",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL or ID to fetch details from"
        }
      },
      required: ["url"]
    }
  },
  {
    name: "createWebsite",
    description: "Creates and deploys a website with the given name, theme, and domain",
    inputSchema: {
      type: "object",
      properties: {
        site_name: {
          type: "string",
          description: "The name of the website to create"
        },
        theme: {
          type: "string",
          enum: ["light", "dark"],
          description: "The theme for the website (light or dark)"
        },
        domain: {
          type: "string",
          description: "Optional custom domain for the website"
        }
      },
      required: ["site_name", "theme"]
    }
  }
];

// Root endpoint - Return MCP server info
app.get('/', (req, res) => {
  res.json({
    ...mcpServerInfo,
    endpoints: ["/mcp"]
  });
});

// MCP endpoint - Main protocol handler
app.all('/mcp', async (req, res) => {
  // Handle GET requests (for browser/discovery)
  if (req.method === 'GET') {
    return res.json({
      ...mcpServerInfo,
      protocol: "MCP",
      transport: "HTTP with JSON-RPC 2.0",
      endpoint: "/mcp",
      usage: "POST JSON-RPC 2.0 requests to this endpoint"
    });
  }

  // Handle JSON-RPC 2.0 requests (POST)
  const { method, params, id, jsonrpc } = req.body || {};

  // Log incoming request for debugging
  console.log('MCP Request:', { 
    method, 
    params, 
    id,
    headers: req.headers,
    body: req.body 
  });

  // JSON-RPC response helper
  const jsonRpcResponse = (result) => {
    return res.json({
      jsonrpc: "2.0",
      id: id || null,
      result
    });
  };

  const jsonRpcError = (code, message) => {
    return res.json({
      jsonrpc: "2.0",
      id: id || null,
      error: { code, message }
    });
  };

  // Handle notifications (no response needed for methods without id)
  if (!id && id !== 0) {
    console.log('Received notification (no response needed):', method);
    return res.status(200).end();
  }

  // Handle different MCP methods
  switch (method) {
    case 'initialize':
      return jsonRpcResponse({
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          logging: {}
        },
        serverInfo: mcpServerInfo
      });

    case 'initialized':
      // This is a notification after initialize succeeds
      return res.status(200).end();

    case 'tools/list':
      return jsonRpcResponse({
        tools: mcpTools
      });

    case 'ping':
      return jsonRpcResponse({ status: "ok" });

    case 'tools/call':
      const { name: toolName, arguments: toolArgs } = params || {};
      
      if (toolName === 'search') {
        try {
          const { query } = toolArgs || {};
          
          if (!query) {
            return jsonRpcError(-32602, "Missing required parameter: query");
          }

          // Return available templates based on search
          const templates = [
            { name: "Modern Portfolio", theme: "dark", description: "A sleek dark-themed portfolio site" },
            { name: "Business Landing", theme: "light", description: "Professional light business page" },
            { name: "Personal Blog", theme: "light", description: "Simple blog template" }
          ];

          const results = templates.filter(t => 
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.description.toLowerCase().includes(query.toLowerCase()) ||
            t.theme.toLowerCase().includes(query.toLowerCase())
          );

          return jsonRpcResponse({
            content: [
              {
                type: "text",
                text: `Found ${results.length} template(s) matching "${query}":\n\n` + 
                      results.map(t => `• ${t.name} (${t.theme}): ${t.description}`).join('\n')
              }
            ]
          });
        } catch (error) {
          console.error('Search error:', error);
          return jsonRpcError(-32603, `Search failed: ${error.message}`);
        }
      }

      if (toolName === 'fetch') {
        try {
          const { url } = toolArgs || {};
          
          if (!url) {
            return jsonRpcError(-32602, "Missing required parameter: url");
          }

          // Return details about a deployment or template
          return jsonRpcResponse({
            content: [
              {
                type: "text",
                text: `Fetched details for: ${url}\n\nThis endpoint creates and deploys websites to Vercel.\nAvailable themes: light, dark\nDeployment status: Active`
              }
            ]
          });
        } catch (error) {
          console.error('Fetch error:', error);
          return jsonRpcError(-32603, `Fetch failed: ${error.message}`);
        }
      }
      
      if (toolName === 'createWebsite') {
        try {
          const { site_name, theme, domain } = toolArgs || {};
          
          if (!site_name || !theme) {
            return jsonRpcError(-32602, "Missing required parameters: site_name and theme");
          }

          // Generate site
          const files = await generateSite({ site_name, theme });
          
          // Deploy to Vercel
          const deployResult = await deployToVercel({
            files,
            name: site_name,
            domain,
            token: process.env.VERCEL_TOKEN
          });

          return jsonRpcResponse({
            content: [
              {
                type: "text",
                text: `✅ Website created successfully!\n\nSite URL: ${deployResult.url}\nTheme: ${theme}\nName: ${site_name}`
              }
            ]
          });
        } catch (error) {
          console.error('Tool call error:', error);
          return jsonRpcError(-32603, `Failed to create website: ${error.message}`);
        }
      }
      
      return jsonRpcError(-32601, `Unknown tool: ${toolName}`);

    default:
      return jsonRpcError(-32601, `Method not found: ${method}`);
  }
});

// Legacy endpoint for backwards compatibility
app.get('/mcp.json', (req, res) => {
  res.json({
    ...mcpServerInfo,
    endpoints: ["/mcp"]
  });
});

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

// Export for Vercel serverless (instead of app.listen)
export default app;
