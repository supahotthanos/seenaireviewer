#!/usr/bin/env node
// Generates a strong random string suitable for ADMIN_SECRET.
//   npm run gen-secret

import { randomBytes } from 'node:crypto'

const secret = randomBytes(32).toString('base64url')
console.log(secret)
