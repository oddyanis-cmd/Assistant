// Netlify entry point: the whole Express app (shop, admin, API) runs in this one function.
// Every request is routed here by netlify.toml, so the admin/shop domain split in
// src/middleware/adminHost.js and the security headers apply exactly as on a normal server.
const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { createApp } = require('../../src/app');

const app = createApp();

const handle = serverless(app, {
  // Return images, fonts and uploads as binary (base64) rather than corrupting them as text.
  binary: ['image/*', 'font/*', 'application/octet-stream', 'application/pdf', 'multipart/form-data'],
});

exports.handler = async (event, context) => {
  connectLambda(event); // gives this request access to the site's Netlify Blobs (product photos)
  return handle(event, context);
};
