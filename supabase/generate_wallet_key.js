/**
 * BANKROLL — Key Generator Script
 * ─────────────────────────────────────────────────────────
 * Run this ONCE to generate the WALLET_ENCRYPTION_KEY secret.
 * Then add it to Supabase Vault and your .env file.
 *
 * Usage:
 *   node generate_wallet_key.js
 *
 * Then copy the output and run:
 *   supabase secrets set WALLET_ENCRYPTION_KEY=<output>
 * ─────────────────────────────────────────────────────────
 */

const { randomBytes } = require('crypto');

// Generate 32 cryptographically secure random bytes (256-bit key for AES-256)
const key = randomBytes(32).toString('base64');

console.log('\n✅ WALLET_ENCRYPTION_KEY (AES-256-GCM master key):');
console.log(key);
console.log('\n⚠️  CRITICAL SECURITY RULES:');
console.log('  1. Store this in Supabase Vault ONLY (supabase secrets set WALLET_ENCRYPTION_KEY=...)');
console.log('  2. Add it to your .env file for local Edge Function dev');
console.log('  3. NEVER commit this to Git');
console.log('  4. NEVER share this key — losing it means losing access to all wallets');
console.log('  5. Keep an encrypted offline backup (e.g. in a password manager)\n');
