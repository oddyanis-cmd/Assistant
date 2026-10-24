const crypto = require('node:crypto');
const prisma = require('../../lib/prisma');
const { randomToken, sha256 } = require('../../lib/crypto');
const { badRequest, conflict } = require('../../lib/errors');
const settings = require('../settings/service');
const { priceCart } = require('../cart/service');

function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `LS-${ymd}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/**
 * Turn a cart into a PENDING_PAYMENT order, reserving stock atomically.
 * Prices are always recomputed on the server — never trusted from the client.
 */
async function createOrderFromCart({ cart, userId, email, shippingAddress, customerNote, provider }) {
  const priced = await priceCart(cart);
  if (!priced.lines.length) throw badRequest('Your cart is empty');
  const unavailable = priced.lines.filter((l) => !l.available);
  if (unavailable.length) throw badRequest(`No longer available: ${unavailable.map((l) => l.productName).join(', ')}`);

  const shipping = await settings.get('shipping');
  if (!shipping.countries.includes(shippingAddress.country)) {
    throw badRequest('We do not ship to this country yet');
  }

  const accessToken = randomToken();
  const order = await prisma.$transaction(async (tx) => {
    for (const l of priced.lines) {
      // Conditional decrement: fails if another checkout took the last items.
      const r = await tx.productVariant.updateMany({
        where: { id: l.variantId, isActive: true, stock: { gte: l.quantity } },
        data: { stock: { decrement: l.quantity } },
      });
      if (r.count !== 1) throw conflict(`Sorry, "${l.productName}${l.size ? ` (${l.size})` : ''}" just sold out or has less stock than requested`);
    }
    const created = await tx.order.create({
      data: {
        number: orderNumber(),
        userId: userId ?? null,
        email,
        currency: priced.currency,
        subtotal: priced.subtotal,
        shippingFee: priced.shippingFee,
        total: priced.total,
        shippingAddress,
        customerNote,
        paymentProvider: provider,
        accessTokenHash: sha256(accessToken),
        items: {
          create: priced.lines.map((l) => ({
            variantId: l.variantId, productName: l.productName, sku: l.sku, size: l.size, color: l.color,
            imageUrl: l.imageUrl, unitPrice: l.unitPrice, quantity: l.quantity, personalization: l.personalization,
          })),
        },
      },
      include: { items: true },
    });
    await tx.inventoryMovement.createMany({
      data: priced.lines.map((l) => ({ variantId: l.variantId, delta: -l.quantity, reason: 'sale', orderId: created.id, note: `Reserved for ${created.number}` })),
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });
  return { order, accessToken, lines: priced.lines };
}

/** Return reserved stock to inventory exactly once. Must be called inside a transaction. */
async function releaseStock(tx, order, reason, userId) {
  const fresh = await tx.order.updateMany({ where: { id: order.id, stockReleased: false }, data: { stockReleased: true } });
  if (fresh.count !== 1) return;
  const items = await tx.orderItem.findMany({ where: { orderId: order.id, variantId: { not: null } } });
  for (const it of items) {
    await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
    await tx.inventoryMovement.create({ data: { variantId: it.variantId, delta: it.quantity, reason, orderId: order.id, userId } });
  }
}

/**
 * Apply a verified provider result to the payment and its order. Idempotent: safe to call from both the
 * customer's return redirect and the webhook, in any order, any number of times.
 */
async function applyPaymentResult(payment, result, expectedAmountCheck) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: payment.orderId } });
    if (result.status === 'SUCCEEDED') {
      const amountOk = expectedAmountCheck ? expectedAmountCheck(order) : result.amount === order.total;
      if (!amountOk) {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'FAILED', raw: { ...result.raw, error: 'amount_mismatch' } } });
        console.error(`Payment amount mismatch for order ${order.number}`, result);
        return order;
      }
      const updated = await tx.payment.updateMany({ where: { id: payment.id, status: { not: 'SUCCEEDED' } }, data: { status: 'SUCCEEDED', raw: result.raw } });
      if (updated.count === 1 && ['PENDING_PAYMENT', 'CANCELLED'].includes(order.status)) {
        if (order.status === 'CANCELLED' && order.stockReleased) {
          // Paid after expiry: re-reserve if possible; otherwise flag for the owner to handle manually.
          await tx.order.update({ where: { id: order.id }, data: { adminNote: 'Payment arrived after the order expired — check stock and confirm with the customer.' } });
        }
        const items = await tx.orderItem.findMany({ where: { orderId: order.id } });
        for (const it of items) {
          if (it.variantId) {
            const v = await tx.productVariant.findUnique({ where: { id: it.variantId }, select: { productId: true } });
            if (v) await tx.product.update({ where: { id: v.productId }, data: { salesCount: { increment: it.quantity } } });
          }
        }
        return tx.order.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date(), paymentProvider: payment.provider } });
      }
      return order;
    }
    if (result.status === 'FAILED') {
      await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', raw: result.raw } });
    }
    if (result.status === 'REFUNDED') {
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      if (order.status !== 'REFUNDED') return tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
    }
    return order;
  });
}

async function cancelOrder(orderId, { reason = 'cancel', userId } = {}) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) throw badRequest('Shipped orders cannot be cancelled — use a refund/return instead');
    await releaseStock(tx, order, reason, userId);
    await tx.payment.updateMany({ where: { orderId, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    return tx.order.update({ where: { id: orderId }, data: { status: order.status === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED' } });
  });
}

/** Expire unpaid orders and release their stock. Called on an interval by the server. */
async function expirePendingOrders() {
  const { pendingOrderTtlMinutes } = await settings.get('commerce');
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', createdAt: { lt: new Date(Date.now() - pendingOrderTtlMinutes * 6e4) } },
    select: { id: true },
    take: 100,
  });
  for (const o of stale) await cancelOrder(o.id, { reason: 'expired' }).catch((e) => console.error('expire', e.message));
  return stale.length;
}

// Allowed manual status transitions in the admin.
const TRANSITIONS = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

module.exports = { createOrderFromCart, applyPaymentResult, cancelOrder, releaseStock, expirePendingOrders, orderNumber, TRANSITIONS };
