// Mobile development server script
const { exec } = require('child_process');
const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// Start the React development server
const reactProcess = exec('npm start', (error) => {
  if (error) {
    console.error(`Error starting React server: ${error}`);
    return;
  }
});

// Log React server output
reactProcess.stdout.on('data', (data) => {
  console.log(`React server: ${data}`);
});

reactProcess.stderr.on('data', (data) => {
  console.error(`React server error: ${data}`);
});

// Create a simple proxy server to inject viewport meta tag
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>IPS Management - Mobile View</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        iframe {
          border: none;
          width: 100%;
          height: 100vh;
        }
      </style>
    </head>
    <body>
      <iframe src="http://localhost:3000" frameborder="0"></iframe>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Mobile development server running at http://localhost:${port}`);
  console.log('Open this URL on your mobile device or use browser dev tools to simulate mobile view');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  reactProcess.kill();
  process.exit();
});