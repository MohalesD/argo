import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signInAsTestUser, testEmail, deleteTestUser, runId, type TestUser } from './helpers/auth';

// Goal 2 could-not-verify item 2 (buildlog/goal2-build-log.md, echoed in
// docs/qa/goal3-hardening-inventory-2026-07-12.md item 1.2): the unique
// index plus the maintain_star_count trigger (migrations 0005, 0008,
// 0016) make over-counting structurally impossible, and a single-user
// path was already proven, but a genuinely concurrent multi-client race
// was never actually driven. This spec drives it for real: multiple
// independent browser contexts (real sessions, real cookies) firing the
// production star-button click via Promise.all, not sequential requests
// dressed up as concurrent.
//
// Read-only verification queries below use the service-role client to
// read ground truth directly from `stars` and `qstacks.star_count`
// after each race settles; they never write through it. Writes only
// ever happen through the real authenticated session, same code path
// (app/market/page.tsx toggleStar) end users hit.

function adminDataClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.local); concurrency verification cannot read ground truth without them.',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const owner: TestUser = { email: testEmail('starOwner'), firstName: 'Star' };
const distinctTitle = `E2E ${runId} Concurrent Distinct Stars QStack`;
const duplicateTitle = `E2E ${runId} Concurrent Duplicate Star QStack`;

const distinctStarrers: TestUser[] = Array.from({ length: 4 }, (_, i) => ({
  email: testEmail(`starrer${i}`),
  firstName: `Starrer${i}`,
}));
const dupUser: TestUser = { email: testEmail('dupStarrer'), firstName: 'DupStarrer' };

const openContexts: BrowserContext[] = [];

test.afterAll(async () => {
  await deleteTestUser(owner.email);
  for (const u of distinctStarrers) await deleteTestUser(u.email);
  await deleteTestUser(dupUser.email);
  await Promise.all(openContexts.map((c) => c.close()));
});

// Creates a QStack as the given (already signed-in) page and publishes
// it public, mirroring launch-of-friends.spec.ts step 10's own publish
// interaction so this fixture setup exercises the same real flow.
async function createAndPublishQStack(page: Page, title: string): Promise<string> {
  await page.goto('/qstacks/new');
  await page.getByTestId('qstack-title-input').fill(title);
  await page.getByTestId('qstack-save').click();
  await page.waitForURL(/\/qstacks\/[0-9a-f]{8}-[0-9a-f-]{27,}$/);
  const qstackId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;

  await page.getByTestId('qstack-visibility').click();
  await expect(page.getByTestId('go-public-prompt')).toBeVisible();
  await page.getByTestId('go-public-prompt').getByRole('button').first().click();

  return qstackId;
}

test('concurrent starring: N distinct users racing the same QStack land exactly N stars, no over- or under-count', async ({
  browser,
}) => {
  test.setTimeout(120_000);

  const ownerContext = await browser.newContext();
  openContexts.push(ownerContext);
  const ownerPage = await ownerContext.newPage();
  await signInAsTestUser(ownerPage, owner, '/library');
  const qstackId = await createAndPublishQStack(ownerPage, distinctTitle);

  const starrerPages: Page[] = [];
  for (const u of distinctStarrers) {
    const ctx = await browser.newContext();
    openContexts.push(ctx);
    const p = await ctx.newPage();
    await signInAsTestUser(p, u, '/market');
    starrerPages.push(p);
  }

  const cards = starrerPages.map((p) => p.getByTestId('market-card').filter({ hasText: distinctTitle }));
  await Promise.all(cards.map((c) => expect(c).toBeVisible()));

  // The actual race: N independent sessions, N independent network
  // stacks, firing the real star-button click at effectively the same
  // time.
  await Promise.all(cards.map((c) => c.getByTestId('star-button').click()));

  // market/page.tsx has no realtime subscription: each page's own
  // star-count is a locally cached snapshot plus its own optimistic
  // delta, never a live view of other sessions' inserts. All four
  // users are distinct, so no unique-constraint rejection is expected
  // here (that race is the second test below) -- each page's own
  // insert should simply succeed, moving its own count from 0 to 1.
  // This is the correct settle signal before reading aggregate ground
  // truth from the database below.
  await Promise.all(cards.map((c) => expect(c.getByTestId('star-count')).toHaveText('1', { timeout: 15_000 })));

  const admin = adminDataClient();
  const { data: starRows, error: starRowsError } = await admin
    .from('stars')
    .select('user_id')
    .eq('qstack_id', qstackId);
  if (starRowsError) throw starRowsError;
  expect(starRows).toHaveLength(distinctStarrers.length);
  expect(new Set((starRows ?? []).map((r) => r.user_id)).size).toBe(distinctStarrers.length);

  const { data: qstackRow, error: qstackError } = await admin
    .from('qstacks')
    .select('star_count')
    .eq('id', qstackId)
    .single();
  if (qstackError) throw qstackError;
  expect(qstackRow?.star_count).toBe(distinctStarrers.length);
});

test('concurrent starring: the same user racing two sessions against the same QStack lands exactly one star, the unique constraint rejects the loser', async ({
  browser,
}) => {
  test.setTimeout(60_000);

  const ownerContext = await browser.newContext();
  openContexts.push(ownerContext);
  const ownerPage = await ownerContext.newPage();
  await signInAsTestUser(ownerPage, owner, '/library');
  const qstackId = await createAndPublishQStack(ownerPage, duplicateTitle);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  openContexts.push(ctxA, ctxB);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  // Same user, two independent sessions -- the actual scarcity the
  // unique index (user_id, qstack_id) exists to enforce.
  await signInAsTestUser(pageA, dupUser, '/market');
  await signInAsTestUser(pageB, dupUser, '/market');

  const cardA = pageA.getByTestId('market-card').filter({ hasText: duplicateTitle });
  const cardB = pageB.getByTestId('market-card').filter({ hasText: duplicateTitle });
  await expect(cardA).toBeVisible();
  await expect(cardB).toBeVisible();

  await Promise.all([cardA.getByTestId('star-button').click(), cardB.getByTestId('star-button').click()]);

  // Whichever session's insert lost the race hits the unique
  // violation and reconciles via toggleStar's own error branch
  // (`await load()`), not a silent no-op that could mask over-counting.
  await expect(cardA.getByTestId('star-count')).toHaveText('1', { timeout: 15_000 });
  await expect(cardB.getByTestId('star-count')).toHaveText('1', { timeout: 15_000 });

  const admin = adminDataClient();
  const { data: starRows, error: starRowsError } = await admin
    .from('stars')
    .select('id, user_id')
    .eq('qstack_id', qstackId);
  if (starRowsError) throw starRowsError;
  expect(starRows).toHaveLength(1);

  const { data: qstackRow, error: qstackError } = await admin
    .from('qstacks')
    .select('star_count')
    .eq('id', qstackId)
    .single();
  if (qstackError) throw qstackError;
  expect(qstackRow?.star_count).toBe(1);
});
