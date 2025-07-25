// Simple test to see what's hanging
console.log('Starting test...');

try {
  console.log('Loading reflect-metadata...');
  require('reflect-metadata');
  
  console.log('Loading express...');
  const express = require('express');
  
  console.log('Loading typeorm...');
  const { DataSource } = require('typeorm');
  
  console.log('Creating simple app...');
  const app = express();
  
  app.get('/test', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  console.log('Starting server...');
  const server = app.listen(3001, () => {
    console.log('Test server running on port 3001');
    // Close after 2 seconds
    setTimeout(() => {
      console.log('Closing server...');
      server.close();
      process.exit(0);
    }, 2000);
  });
  
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}