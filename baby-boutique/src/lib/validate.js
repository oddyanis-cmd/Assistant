const { badRequest } = require('./errors');

/** Parse `data` with a zod schema or throw a 400 with field errors. */
function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) throw badRequest('Validation failed', r.error.flatten().fieldErrors);
  return r.data;
}

module.exports = { parse };
