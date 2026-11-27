// Netlify Blobs storage: product photos are kept in the site's own blob store (no extra account needed)
// and served by the app at /media/<key>. Used when MEDIA_PROVIDER=netlify.
const { getStore } = require('@netlify/blobs');

const SIZES = ['full', 'medium', 'thumb'];
const store = () => getStore({ name: 'product-images', consistency: 'strong' });
const toArrayBuffer = (buf) => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
// Only keys this module itself creates can be read back (no path tricks).
const KEY_RE = /^products\/[a-z0-9]{8,40}\/[a-f0-9]{16}-(full|medium|thumb)\.webp$/;

module.exports = {
  id: 'netlify',
  async put(key, variants) {
    const urls = {};
    for (const name of SIZES) {
      const blobKey = `${key}-${name}.webp`;
      await store().set(blobKey, toArrayBuffer(variants[name]), { metadata: { contentType: 'image/webp' } });
      urls[name] = `/media/${blobKey}`;
    }
    return { storageKey: key, url: urls.full, mediumUrl: urls.medium, thumbUrl: urls.thumb };
  },
  async remove(key) {
    await Promise.all(SIZES.map((n) => store().delete(`${key}-${n}.webp`)));
  },
  /** Returns a Buffer, or null for unknown/invalid keys. */
  async read(blobKey) {
    if (!KEY_RE.test(blobKey)) return null;
    const data = await store().get(blobKey, { type: 'arrayBuffer' });
    return data ? Buffer.from(data) : null;
  },
};
