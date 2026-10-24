// Local-disk storage for DEVELOPMENT. Production should use object storage (cloudinary / S3).
const fs = require('node:fs/promises');
const path = require('node:path');
const env = require('../../../config/env');

const root = path.resolve(env.MEDIA_UPLOAD_DIR);

module.exports = {
  id: 'local',
  /** variants: { full: Buffer, medium: Buffer, thumb: Buffer } (all webp) */
  async put(key, variants) {
    const dir = path.join(root, path.dirname(key));
    await fs.mkdir(dir, { recursive: true });
    const base = path.basename(key);
    const urls = {};
    for (const [name, buf] of Object.entries(variants)) {
      await fs.writeFile(path.join(dir, `${base}-${name}.webp`), buf);
      urls[name] = `/uploads/${path.dirname(key)}/${base}-${name}.webp`;
    }
    return { storageKey: key, url: urls.full, mediumUrl: urls.medium, thumbUrl: urls.thumb };
  },
  async remove(key) {
    const dir = path.join(root, path.dirname(key));
    const base = path.basename(key);
    await Promise.all(['full', 'medium', 'thumb'].map((n) => fs.rm(path.join(dir, `${base}-${n}.webp`), { force: true })));
  },
};
