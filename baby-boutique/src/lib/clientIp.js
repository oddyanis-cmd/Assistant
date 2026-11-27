// The visitor's real IP address.
// On Netlify Functions the platform sets x-nf-client-connection-ip itself (a visitor cannot forge it there);
// everywhere else we rely on Express's trust-proxy handling (TRUST_PROXY) via req.ip.
const onNetlify = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);

module.exports = function clientIp(req) {
  if (onNetlify) {
    const nf = req.get('x-nf-client-connection-ip');
    if (nf) return nf.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
};
