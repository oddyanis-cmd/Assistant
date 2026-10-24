// Cloudinary object storage + CDN. Only the full-size image is uploaded; medium/thumbnail sizes are
// derived on the CDN with URL transformations (f_auto/q_auto deliver AVIF/WebP per browser).
const cloudinary = require('cloudinary').v2;

let configured = false;
function client() {
  if (!configured) {
    cloudinary.config({ secure: true }); // reads CLOUDINARY_URL
    configured = true;
  }
  return cloudinary;
}

const derived = (publicId, w) => client().url(publicId, { secure: true, transformation: [{ width: w, crop: 'limit', fetch_format: 'auto', quality: 'auto' }] });

module.exports = {
  id: 'cloudinary',
  async put(key, variants) {
    const result = await new Promise((resolve, reject) => {
      client()
        .uploader.upload_stream({ public_id: key, resource_type: 'image', overwrite: false }, (err, r) => (err ? reject(err) : resolve(r)))
        .end(variants.full);
    });
    return {
      storageKey: result.public_id,
      url: derived(result.public_id, 2000),
      mediumUrl: derived(result.public_id, 800),
      thumbUrl: derived(result.public_id, 360),
    };
  },
  async remove(key) {
    await client().uploader.destroy(key, { resource_type: 'image' });
  },
};
