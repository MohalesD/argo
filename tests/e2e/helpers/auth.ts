import { existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

// Belt-and-suspenders: playwright.config.ts loads .env.local into the
// config process, which normally propagates to worker processes at
// spawn. Loading again here is a no-op if it already propagated
// (existing env wins over the file, matching src/lib/env.ts) and a
// safety net if it did not.
const envFile = path.resolve('.env.local');
if (existsSync(envFile) && !process.env.SUPABASE_SECRET_KEY) {
  process.loadEnvFile(envFile);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.local); auth helper cannot mint sign-in links without them.',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface TestUser {
  email: string;
  firstName: string;
}

// Shared per-run suffix, also useful for building other unique fixture
// names (QStack titles, etc.) so repeated hosted-project runs never
// collide with each other's leftover rows.
export const runId = Math.random().toString(36).slice(2, 8);

// A unique, disposable address for this run:
// e2e_<runId>_<name>@simulator.amazonses.com. Not @argo.test (GoTrue's
// public signInWithOtp rejects the reserved .test TLD with 400
// email_address_invalid) and not @example.com (GoTrue also runs
// MX-record deliverability validation before the send-rate check, and
// example.com has no MX; both verified live against the hosted
// project). The SES mailbox simulator passes GoTrue MX validation and
// absorbs mail with no bounces. The admin generateLink path accepted
// all of these fine, which is why only flows that submit the real
// signin forms ever tripped on it.
export function testEmail(name: string): string {
  return `e2e_${runId}_${name}@simulator.amazonses.com`;
}

const createdUserIds = new Map<string, string>();

// Signs a user in without sending real email: mints a magiclink action
// link via the service-role admin API (verified empirically to
// auto-create the auth.users row for a brand-new address, and to work
// unchanged for an address the app itself already created, e.g. via a
// real /signin form submission), then visits /auth/confirm with that
// token, the harness substitute for clicking an emailed link. `next`
// exercises the confirm route's documented `?next=` handling.
export async function signInAsTestUser(page: Page, user: TestUser, next = '/library'): Promise<void> {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: user.email,
    options: { data: { first_name: user.firstName } },
  });
  if (error || !data?.properties?.hashed_token) {
    const fullErrorDump = error
      ? JSON.stringify(error, Object.getOwnPropertyNames(error))
      : 'null';
    console.error('[signInAsTestUser] generateLink raw error:', fullErrorDump);
    console.error('[signInAsTestUser] generateLink error.status:', (error as any)?.status);
    console.error('[signInAsTestUser] generateLink error.code:', (error as any)?.code);
    console.error('[signInAsTestUser] generateLink error.name:', (error as any)?.name);
    console.error('[signInAsTestUser] generateLink data:', JSON.stringify(data));
    throw new Error(
      `generateLink failed for ${user.email}: ${error?.message ?? 'no hashed_token returned'} | raw: ${fullErrorDump}`,
    );
  }
  if (data.user?.id) createdUserIds.set(user.email, data.user.id);

  const expectedPath = next.startsWith('/') ? next : '/library';
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=email&next=${encodeURIComponent(next)}`);

  // Verify auth succeeded and we landed on the expected page, not redirected to /signin
  const finalUrl = page.url();
  if (finalUrl.includes('/signin')) {
    throw new Error(
      `auth/confirm redirect failed for ${user.email}: ended up at ${finalUrl} instead of ${expectedPath}. Token hash may be invalid or session setup failed.`
    );
  }
  if (!finalUrl.includes(expectedPath)) {
    throw new Error(
      `auth/confirm redirect went to wrong page for ${user.email}: expected ${expectedPath} but got ${finalUrl}`
    );
  }
}

// Best-effort teardown. Some rows are deliberately undeletable (scores
// and other append-only audit data referencing the user); that is by
// design (D11) and failures here are swallowed, never worked around.
export async function deleteTestUser(email: string): Promise<void> {
  const id = createdUserIds.get(email);
  if (!id) return;
  const admin = adminClient();
  await admin.auth.admin.deleteUser(id).catch(() => {
    // Deliberately undeletable in some cases; not a bug to route around.
  });
}
