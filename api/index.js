import express from 'express';
import bodyParser from 'body-parser';
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
    description: "Fetch complete details about a specific website template by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Template ID to fetch details for (e.g., template-1, template-2, template-3)"
        }
      },
      required: ["id"]
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
  // Set headers for fast response
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache');
  
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

  // Quick logging
  console.log('MCP:', method, id);

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

          // Search through available templates
          const templates = [
            { 
              id: "template-1", 
              name: "Modern Portfolio", 
              theme: "dark", 
              description: "A sleek dark-themed portfolio site with modern animations" 
            },
            { 
              id: "template-2", 
              name: "Business Landing", 
              theme: "light", 
              description: "Professional light business page with call-to-action sections" 
            },
            { 
              id: "template-3", 
              name: "Personal Blog", 
              theme: "light", 
              description: "Simple and clean blog template for personal content" 
            }
          ];

          const results = templates.filter(t => 
            t.name.toLowerCase().includes(query.toLowerCase()) ||
            t.description.toLowerCase().includes(query.toLowerCase()) ||
            t.theme.toLowerCase().includes(query.toLowerCase())
          ).map(t => ({
            id: t.id,
            title: t.name,
            text: t.description,
            url: `https://kavyavarma19-tir8.vercel.app/templates/${t.id}`
          }));

          // Return in ChatGPT MCP format
          return jsonRpcResponse({
            content: [
              {
                type: "text",
                text: JSON.stringify({ results })
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
          const { id } = toolArgs || {};
          
          if (!id) {
            return jsonRpcError(-32602, "Missing required parameter: id");
          }

          // Template database
          const templates = {
            "template-1": {
              id: "template-1",
              title: "Modern Portfolio",
              text: "A sleek dark-themed portfolio site with modern animations, responsive design, and smooth scrolling. Perfect for showcasing creative work, photography, or design projects. Features include: hero section with animated background, project gallery with hover effects, about section, contact form, and social media integration.",
              url: "https://kavyavarma19-tir8.vercel.app/templates/template-1",
              metadata: { theme: "dark", type: "portfolio" }
            },
            "template-2": {
              id: "template-2",
              title: "Business Landing",
              text: "Professional light business page with call-to-action sections, testimonials, and pricing tables. Ideal for startups, SaaS products, or service businesses. Includes: compelling hero with CTA buttons, feature showcase grid, customer testimonials carousel, pricing comparison table, FAQ section, and newsletter signup.",
              url: "https://kavyavarma19-tir8.vercel.app/templates/template-2",
              metadata: { theme: "light", type: "business" }
            },
            "template-3": {
              id: "template-3",
              title: "Personal Blog",
              text: "Simple and clean blog template for personal content, articles, and stories. Minimalist design focused on readability and content. Features: clean typography, article cards with featured images, categories and tags, author bio section, search functionality, and RSS feed support.",
              url: "https://kavyavarma19-tir8.vercel.app/templates/template-3",
              metadata: { theme: "light", type: "blog" }
            }
          };

          const template = templates[id];
          
          if (!template) {
            return jsonRpcError(-32602, `Template not found: ${id}`);
          }

          // Return in ChatGPT MCP format
          return jsonRpcResponse({
            content: [
              {
                type: "text",
                text: JSON.stringify(template)
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

          // Lazy load services only when needed
          const { generateSite, deployToVercel } = await import('./services.js');

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
