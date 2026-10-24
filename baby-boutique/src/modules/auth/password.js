const argon2 = require('argon2');

// OWASP-recommended Argon2id parameters (19 MiB, t=2, p=1).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

const hashPassword = (pw) => argon2.hash(pw, OPTIONS);
const verifyPassword = (hash, pw) => argon2.verify(hash, pw).catch(() => false);

// Used to keep login timing similar when the email does not exist.
let dummyHash;
async function dummyVerify(pw) {
  dummyHash ??= await hashPassword('timing-equaliser-password');
  await verifyPassword(dummyHash, pw);
  return false;
}

module.exports = { hashPassword, verifyPassword, dummyVerify };
