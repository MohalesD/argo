// Dev-only convenience: mint a real admin sign-in link for a human
// email, using the exact mechanism the Goal 2 Playwright suite already
// exercises (tests/e2e/helpers/auth.ts, decision D-G2-12). This does
// not bypass sign-in or touch any auth/RLS code path: it calls the
// same Supabase admin.generateLink API real emailed magic links use,
// then lands on the same /auth/confirm route, unmodified, that every
// real signup goes through. generateLink does not dispatch mail, so
// running this never spends the mailer's rate-limited send quota.
//
// This is a standalone script, never part of the deployed app bundle
// (nothing under app/ imports it, no route serves it), so it cannot be
// reached over HTTP at all. NODE_ENV alone is not a reliable gate
// though: npm scripts commonly run with it unset, so refusing only on
// an exact 'production' match would fail OPEN by default. The real
// gate is ALLOW_DEV_SIGNIN: it must be explicitly set to 'true' in
// .env.local, so the script fails CLOSED in every environment until a
// human deliberately turns it on for that checkout.
//
// Usage: npx tsx scripts/dev-signin.ts <email> [next-path]
// Or set DEV_SIGNIN_EMAIL in .env.local and omit the email argument.
// Requires ALLOW_DEV_SIGNIN=true in .env.local.
import '../src/lib/env.js';
import { createClient } from '@supabase/supabase-js';

if (process.env.NODE_ENV === 'production') {
  console.error('dev-signin refuses to run with NODE_ENV=production.');
  process.exit(1);
}

if (process.env.ALLOW_DEV_SIGNIN !== 'true') {
  console.error('dev-signin is off by default. Set ALLOW_DEV_SIGNIN=true in .env.local to enable it.');
  console.error(
    `This mints a real admin sign-in link against ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(NEXT_PUBLIC_SUPABASE_URL is not set)'}.`,
  );
  process.exit(1);
}

const email = process.argv[2] || process.env.DEV_SIGNIN_EMAIL;
if (!email) {
  console.error('Usage: npx tsx scripts/dev-signin.ts <email> [next-path]');
  console.error('Or set DEV_SIGNIN_EMAIL in .env.local.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !secretKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.local).');
  process.exit(1);
}

console.log(`Minting a dev sign-in link against ${supabaseUrl} for ${email}...`);

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
if (error || !data?.properties?.hashed_token) {
  console.error(`generateLink failed: ${error?.message ?? 'no hashed_token returned'}`);
  process.exit(1);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const next = process.argv[3] || '/library';
const link = `${appUrl}/auth/confirm?token_hash=${data.properties.hashed_token}&type=email&next=${encodeURIComponent(next)}`;

console.log(`\nSigned-in session link for ${email}:\n\n${link}\n`);
console.log(`Start the app (npm run dev) and open that link; it lands on ${next}.`);
