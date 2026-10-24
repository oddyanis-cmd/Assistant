const env = require('../config/env');
const { HttpError } = require('../lib/errors');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is larger than the allowed upload size' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists', details: err.meta });
  }
  if (err?.code === 'P2025') return res.status(404).json({ error: 'Not found' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong', ...(env.isProd ? {} : { debug: err.message }) });
};
