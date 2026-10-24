const sharp = require('sharp');
const crypto = require('node:crypto');
const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const settings = require('../settings/service');
const { badRequest, HttpError } = require('../../lib/errors');

const storages = { local: require('./storage/local'), cloudinary: require('./storage/cloudinary') };
const storage = () => storages[env.MEDIA_PROVIDER];

const SIZES = { full: 2000, medium: 800, thumb: 360 };
const FORMAT_TO_MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heif: 'image/avif' };

async function usage() {
  const agg = await prisma.productImage.aggregate({ _sum: { bytes: true }, _count: true });
  const { storageQuotaMb } = await settings.get('media');
  const usedBytes = agg._sum.bytes ?? 0;
  const quotaBytes = storageQuotaMb * 1024 * 1024;
  return { usedBytes, quotaBytes, imageCount: agg._count, percent: quotaBytes ? Math.round((usedBytes / quotaBytes) * 1000) / 10 : 0, provider: env.MEDIA_PROVIDER };
}

/**
 * Validate by actually decoding the file (the client-sent MIME type and extension are not trusted),
 * then re-encode: this strips EXIF/GPS metadata and neutralises polyglot files.
 */
async function processImage(buffer) {
  const cfg = await settings.get('media');
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 50_000_000 }).metadata();
  } catch {
    throw badRequest('File is not a valid image');
  }
  const mime = FORMAT_TO_MIME[meta.format];
  if (!mime || !cfg.allowedTypes.includes(mime)) throw badRequest(`Image type ${meta.format} is not allowed`);

  const base = sharp(buffer, { limitInputPixels: 50_000_000 }).rotate(); // apply EXIF orientation, metadata dropped on output
  const out = {};
  try {
    for (const [name, w] of Object.entries(SIZES)) {
      out[name] = await base.clone().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: name === 'thumb' ? 75 : 82 }).toBuffer();
    }
  } catch {
    throw badRequest('Image could not be read — it may be corrupted or incomplete');
  }
  const fullMeta = await sharp(out.full).metadata();
  return { variants: out, width: fullMeta.width, height: fullMeta.height, bytes: out.full.length + out.medium.length + out.thumb.length };
}

async function addProductImage(productId, file, { alt } = {}) {
  const { usedBytes, quotaBytes } = await usage();
  const processed = await processImage(file.buffer);
  if (quotaBytes && usedBytes + processed.bytes > quotaBytes) {
    throw new HttpError(507, 'Storage quota reached — delete unused images or raise the quota in Settings → Media');
  }
  const key = `products/${productId}/${crypto.randomBytes(8).toString('hex')}`;
  const stored = await storage().put(key, processed.variants);
  const [count, last] = await Promise.all([
    prisma.productImage.count({ where: { productId } }),
    prisma.productImage.findFirst({ where: { productId }, orderBy: { position: 'desc' }, select: { position: true } }),
  ]);
  return prisma.productImage.create({
    data: {
      productId,
      provider: storage().id,
      ...stored,
      width: processed.width,
      height: processed.height,
      bytes: processed.bytes,
      alt: alt || null,
      position: (last?.position ?? -1) + 1,
      isFeatured: count === 0,
    },
  });
}

async function deleteImage(image) {
  await storages[image.provider]?.remove(image.storageKey).catch((e) => console.error('storage remove failed', e.message));
  await prisma.productImage.delete({ where: { id: image.id } });
  if (image.isFeatured) {
    const next = await prisma.productImage.findFirst({ where: { productId: image.productId }, orderBy: { position: 'asc' } });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isFeatured: true } });
  }
}

module.exports = { usage, processImage, addProductImage, deleteImage, SIZES };
