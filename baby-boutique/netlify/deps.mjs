// Netlify packages a function by following its ES `import`s. The app itself is CommonJS (require),
// which the packager does not follow, so every runtime package is listed here to make sure it
// ships with the function. Keep in sync with "dependencies" in package.json (tests check this).
import '@netlify/blobs';
import '@prisma/client';
import 'argon2';
import 'cloudinary';
import 'cookie-parser';
import 'dotenv';
import 'express';
import 'express-rate-limit';
import 'helmet';
import 'multer';
import 'otplib';
import 'qrcode';
import 'serverless-http';
import 'sharp';
import 'stripe';
import 'zod';
