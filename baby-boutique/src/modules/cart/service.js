const prisma = require('../../lib/prisma');
const env = require('../../config/env');
const { randomToken, sha256 } = require('../../lib/crypto');
const { badRequest } = require('../../lib/errors');
const settings = require('../settings/service');

const CART_COOKIE = 'cart';
const MAX_QTY_PER_LINE = 20;

const itemInclude = {
  variant: {
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, status: true, basePrice: true, isPersonalizable: true,
          images: { orderBy: [{ isFeatured: 'desc' }, { position: 'asc' }], take: 1, select: { thumbUrl: true } },
        },
      },
    },
  },
};

async function findCart(req) {
  if (req.user) return prisma.cart.findUnique({ where: { userId: req.user.id }, include: { items: { include: itemInclude } } });
  const token = req.cookies?.[CART_COOKIE];
  if (!token) return null;
  return prisma.cart.findUnique({ where: { tokenHash: sha256(token) }, include: { items: { include: itemInclude } } });
}

async function getOrCreateCart(req, res) {
  const existing = await findCart(req);
  if (existing) return existing;
  if (req.user) return prisma.cart.create({ data: { userId: req.user.id }, include: { items: { include: itemInclude } } });
  const token = randomToken();
  res.cookie(CART_COOKIE, token, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: 60 * 864e5 });
  return prisma.cart.create({ data: { tokenHash: sha256(token) }, include: { items: { include: itemInclude } } });
}

/** On login/register, move guest cart lines into the user's cart. */
async function mergeGuestCartIntoUser(req, res, userId) {
  const token = req.cookies?.[CART_COOKIE];
  if (!token) return;
  const guest = await prisma.cart.findUnique({ where: { tokenHash: sha256(token) }, include: { items: true } });
  res.clearCookie(CART_COOKIE, { path: '/' });
  if (!guest) return;
  const userCart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  for (const it of guest.items) {
    await prisma.cartItem.upsert({
      where: { cartId_variantId_personalization: { cartId: userCart.id, variantId: it.variantId, personalization: it.personalization } },
      create: { cartId: userCart.id, variantId: it.variantId, quantity: it.quantity, personalization: it.personalization },
      update: { quantity: { increment: it.quantity } },
    });
  }
  await prisma.cart.delete({ where: { id: guest.id } });
}

const unitPrice = (variant) => variant.price ?? variant.product.basePrice;

function shippingFor(subtotal, shipping) {
  if (subtotal === 0) return 0;
  if (shipping.freeOver > 0 && subtotal >= shipping.freeOver) return 0;
  return shipping.flatFee;
}

/** Price a cart server-side. Lines whose product is unpublished/inactive are flagged unavailable. */
async function priceCart(cart) {
  const shipping = await settings.get('shipping');
  const lines = (cart?.items ?? []).map((it) => {
    const v = it.variant;
    const available = v.isActive && v.product.status === 'PUBLISHED';
    const price = unitPrice(v);
    return {
      id: it.id,
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      slug: v.product.slug,
      imageUrl: v.product.images[0]?.thumbUrl ?? null,
      sku: v.sku,
      size: v.size,
      color: v.color,
      unitPrice: price,
      quantity: it.quantity,
      personalization: it.personalization,
      lineTotal: price * it.quantity,
      stock: v.stock,
      available,
      inStock: available && v.stock >= it.quantity,
    };
  });
  const subtotal = lines.filter((l) => l.available).reduce((s, l) => s + l.lineTotal, 0);
  const shippingFee = shippingFor(subtotal, shipping);
  return {
    currency: 'QAR',
    lines,
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    freeShippingThreshold: shipping.freeOver,
  };
}

async function addItem(req, res, { variantId, quantity, personalization = '' }) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant || !variant.isActive || variant.product.status !== 'PUBLISHED') throw badRequest('This item is not available');
  if (personalization && !variant.product.isPersonalizable) throw badRequest('This item cannot be personalised');
  const cart = await getOrCreateCart(req, res);
  const key = { cartId_variantId_personalization: { cartId: cart.id, variantId, personalization } };
  const existing = await prisma.cartItem.findUnique({ where: key });
  const qty = Math.min((existing?.quantity ?? 0) + quantity, MAX_QTY_PER_LINE);
  if (qty > variant.stock) throw badRequest(variant.stock > 0 ? `Only ${variant.stock} left in stock` : 'Out of stock');
  await prisma.cartItem.upsert({ where: key, create: { cartId: cart.id, variantId, quantity: qty, personalization }, update: { quantity: qty } });
  return cart.id;
}

const loadCartById = (id) => prisma.cart.findUnique({ where: { id }, include: { items: { include: itemInclude } } });

async function updateItem(req, itemId, quantity) {
  const cart = await findCart(req);
  const item = cart?.items.find((i) => i.id === itemId);
  if (!item) throw badRequest('Cart item not found');
  if (quantity === 0) return prisma.cartItem.delete({ where: { id: itemId } });
  if (quantity > item.variant.stock) throw badRequest(`Only ${item.variant.stock} left in stock`);
  await prisma.cartItem.update({ where: { id: itemId }, data: { quantity: Math.min(quantity, MAX_QTY_PER_LINE) } });
}

module.exports = { loadCartById, findCart, getOrCreateCart, mergeGuestCartIntoUser, priceCart, addItem, updateItem, shippingFor, unitPrice, CART_COOKIE };
