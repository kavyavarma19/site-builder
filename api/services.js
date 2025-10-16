import fs from 'fs';
import path from 'path';

/**
 * Step 1: Generate a simple HTML website as a string.
 * This is your MVP website generator.
 */
export async function generateSite({ site_name, theme }) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${site_name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: ${theme === 'dark' ? '#111' : '#fafafa'};
            color: ${theme === 'dark' ? '#fff' : '#111'};
            text-align: center;
            padding: 50px;
          }
          h1 { font-size: 2.5em; }
        </style>
      </head>
      <body>
        <h1>Welcome to ${site_name}</h1>
        <p>This is your first auto-generated website!</p>
      </body>
    </html>
  `;

  // For now, just return this string — later you can write to disk
  return { html };
}

/**
 * Step 2: Pretend to deploy to Vercel (mock for now).
 * Later, this will call the actual Vercel API.
 */
export async function deployToVercel({ files, name, domain, token }) {
  console.log('Mock deploy triggered for:', name);
  
  // Simulate a small delay
  await new Promise(r => setTimeout(r, 1000));

  // Return a fake deployed URL
  const mockUrl = `https://${name.toLowerCase().replace(/\s+/g, '-')}.vercel.app`;

  return { url: mockUrl };
}
