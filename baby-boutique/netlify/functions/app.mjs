// Netlify entry point: the whole Express app (shop, admin, API) runs in this one function.
// It is a modern Netlify Function (default export + config.path), which is what gives it the
// site's Netlify Database connection (NETLIFY_DB_URL) and Netlify Blobs automatically.
// withLambda adapts the web Request/Response to the event shape serverless-http expects.
import '../deps.mjs'; // ships every runtime package with the function
import { withLambda } from '@netlify/aws-lambda-compat';
import serverless from 'serverless-http';
import appModule from '../../src/app.js';

const handle = serverless(appModule.createApp(), {
  // Return images, fonts and uploads as binary (base64) rather than corrupting them as text.
  binary: ['image/*', 'font/*', 'application/octet-stream', 'application/pdf', 'multipart/form-data'],
});

// Web Responses cannot carry a body with 204/205/304 statuses; drop the empty body serverless-http adds.
const NO_BODY = new Set([204, 205, 304]);
export default withLambda(async (event, context) => {
  const result = await handle(event, context);
  if (NO_BODY.has(result.statusCode)) { delete result.body; result.isBase64Encoded = false; }
  return result;
});

// Every path goes to the app, so the admin/shop domain split and security headers always apply.
export const config = { path: '/*' };
