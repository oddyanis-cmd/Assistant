function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** Returns a slug that is unique for `model` (a Prisma delegate with a `slug` field). */
async function uniqueSlug(model, base, excludeId) {
  const root = slugify(base);
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = await model.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${root}-${i}`;
  }
}

module.exports = { slugify, uniqueSlug };
