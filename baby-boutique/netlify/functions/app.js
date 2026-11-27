// Netlify entry point: the whole Express app (shop, admin, API) runs in this one function.
// Every request is routed here by netlify.toml, so the admin/shop domain split in
// src/middleware/adminHost.js and the security headers apply exactly as on a normal server.
const serverless = require('serverless-http');
const { createApp } = require('../../src/app');

const app = createApp();

exports.handler = serverless(app, {
  // Return images, fonts and uploads as binary (base64) rather than corrupting them as text.
  binary: ['image/*', 'font/*', 'application/octet-stream', 'application/pdf', 'multipart/form-data'],
});
