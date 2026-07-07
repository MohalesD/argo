import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { signInAsTestUser, testEmail, deleteTestUser, runId, type TestUser } from './helpers/auth';

// PRD Section 10, success criterion 1: the launch-of-friends loop, end
// to end, one serial flow. Every assertion targets a data-testid or
// route from docs/argo-goal2-surface-contract-v1_0-2026-07-07.md.
//
// A few contract-underspecified interactions required a single,
// committed interpretation rather than defensive fallbacks; see
// .claude/handoff/navigator-e2e.md for the full list (bank-add
// embedded in the QStack editor rather than a separate /bank visit,
// override-score reusing the score-anchor-N controls, the interview-
// qstack control as a native <select> keyed by QStack id, share-link
// read as element text, and the market-card -> profile link located
// by href rather than a dedicated testid).

const userA: TestUser = { email: testEmail('userA'), firstName: 'Ari' };
const userB: TestUser = { email: testEmail('userB'), firstName: 'Bri' };
const originalTitle = `E2E ${runId} Launch Loop QStack`;
const candidateName = `E2E ${runId} Candidate`;
const responseText = `E2E ${runId} response: gave a specific example of resolving a stakeholder conflict.`;

let contextB: BrowserContext | undefined;

test.afterAll(async () => {
  await deleteTestUser(userA.email);
  await deleteTestUser(userB.email);
  await contextB?.close();
});

test('launch-of-friends: signup, clone, interview, score, brief, share, second signup, star, follow', async ({
  page,
  browser,
}) => {
  // 7 minutes for the whole 10-step test: two live model pipelines
  // (brief drafting plus per-claim grounding checks) legitimately
  // spend minutes of wall clock inside step 6 alone.
  test.setTimeout(420_000);

  let originalQStackUrl = '';
  let clonedQStackId = '';
  let sessionId = '';
  let shareLinkUrl = '';
  let shareTokenPath = '';
  let pageB: Page;

  await test.step('1. user A signs up via /signin (first name + email only) and lands in a usable workspace', async () => {
    await page.goto('/signin');
    await page.getByTestId('signin-first-name').fill(userA.firstName);
    await page.getByTestId('signin-email').fill(userA.email);
    await page.getByTestId('signin-submit').click();

    // The hosted project's built-in mailer has a low hourly send cap
    // (verified live: 429 over_email_send_rate_limit), so a real send
    // cannot anchor a rerunnable assertion. The form renders one of
    // two honest terminal states: signin-sent on success, or
    // signin-rate-limited when GoTrue returns that 429. Either proves
    // the form wired a real GoTrue call, which is all this step
    // asserts about the form itself.
    await expect(
      page.getByTestId('signin-sent').or(page.getByTestId('signin-rate-limited')),
    ).toBeVisible();

    // Whichever terminal state the mailer produced, mint an
    // equivalent confirm link for the same address instead of reading
    // real email.
    await signInAsTestUser(page, userA, '/library');
    await expect(page).toHaveURL(/\/library/);
    await expect(page.getByTestId('new-qstack')).toBeVisible();
  });

  await test.step('2. A creates a QStack with 2 bank questions, then clones it; fork lineage is visible', async () => {
    await page.goto('/qstacks/new');
    await page.getByTestId('qstack-title-input').fill(originalTitle);
    await page.getByTestId('qstack-save').click();
    // Wait for a uuid-shaped QStack path specifically: a plain
    // /\/qstacks\// check also matches /qstacks/new and passes before
    // the post-save client-side route change, capturing a stale URL
    // that step 10 would later navigate back to.
    await page.waitForURL(/\/qstacks\/[0-9a-f]{8}-[0-9a-f-]{27,}$/);
    originalQStackUrl = page.url();

    await page.getByTestId('bank-search-submit').click();
    const bankResults = page.getByTestId('bank-result');
    await bankResults.nth(0).getByTestId('bank-add-to-qstack').click();
    await bankResults.nth(1).getByTestId('bank-add-to-qstack').click();
    await expect(page.getByTestId('qstack-question-row')).toHaveCount(2);

    await page.getByTestId('clone-qstack').click();
    await expect(page).not.toHaveURL(originalQStackUrl);
    await expect(page.getByTestId('fork-lineage')).toBeVisible();
    await expect(page.getByTestId('fork-lineage')).toContainText(originalTitle);

    clonedQStackId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
  });

  await test.step('3. A creates an interview against the cloned QStack and starts a session', async () => {
    await page.goto('/interviews');
    await page.getByTestId('new-interview').click();
    await page.getByTestId('interview-candidate-name').fill(candidateName);
    await page.getByTestId('interview-qstack').selectOption({ value: clonedQStackId });
    await page.getByTestId('interview-save').click();
    await page.getByTestId('start-session').click();
    await page.waitForURL(/\/live\//);
    sessionId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
    expect(sessionId).toBeTruthy();
  });

  await test.step('4. consent gate: panel blocks capture, confirming both parties reveals it', async () => {
    await expect(page.getByTestId('consent-panel')).toBeVisible();
    await expect(page.getByTestId('response-field')).toHaveCount(0);

    await page.getByTestId('consent-party-interviewer').click();
    await page.getByTestId('consent-party-candidate').click();
    await page.getByTestId('consent-confirm').click();

    await expect(page.getByTestId('response-field')).toBeVisible();
  });

  await test.step('5. A responds, stars, scores 3, then overrides to 2; history preserves the original', async () => {
    await page.getByTestId('response-field').fill(responseText);
    await expect(page.getByTestId('response-saved')).toBeVisible();

    await page.getByTestId('star-response').click();

    await page.getByTestId('score-anchor-3').click();
    await expect(page.getByTestId('score-saved')).toBeVisible();

    await page.getByTestId('override-score').click();
    await page.getByTestId('score-anchor-2').click();
    await expect(page.getByTestId('score-saved')).toBeVisible();

    const historyEntries = page.getByTestId('score-history-entry');
    await expect(historyEntries).toHaveCount(2);
    await expect(historyEntries.first()).toContainText('3');
    await expect(historyEntries.last()).toContainText('2');
  });

  await test.step('6. A ends the session and generates a brief; every claim carries a citation that resolves to real response text', async () => {
    await page.getByTestId('end-session').click();
    await page.getByTestId('generate-brief').click();

    const claims = page.getByTestId('brief-claim');
    // Live draft plus grounding gate, with a possible second
    // tighter-grounding regeneration pass when the first draft loses
    // claims; not mocked, so this legitimately spends minutes.
    await expect(claims.first()).toBeVisible({ timeout: 150_000 });
    const claimCount = await claims.count();
    expect(claimCount).toBeGreaterThan(0);

    for (let i = 0; i < claimCount; i++) {
      const claim = claims.nth(i);
      const citation = claim.getByTestId('brief-citation').first();
      await expect(citation).toBeVisible();
      await citation.click();
      await expect(citation).toContainText(responseText.slice(0, 24));
    }
  });

  await test.step("7. A finalizes and opens the share dialog; expiry and revoke sit next to the copyable link", async () => {
    await page.getByTestId('finalize-brief').click();
    await page.getByTestId('share-brief').click();

    await expect(page.getByTestId('share-expiry')).toBeVisible();
    await expect(page.getByTestId('share-revoke')).toBeVisible();

    const shareLinkText = (await page.getByTestId('share-link').textContent())?.trim();
    if (!shareLinkText) throw new Error('share-link had no readable text; cannot recover the share URL');
    shareLinkUrl = shareLinkText;
    shareTokenPath = new URL(shareLinkUrl, 'http://localhost:3000').pathname;

    await page.getByTestId('share-copy').click();
  });

  await test.step('8. a new anonymous browser context opens the share link and sees the brief without an account', async () => {
    contextB = await browser.newContext();
    pageB = await contextB.newPage();
    await pageB.goto(shareLinkUrl);
    await expect(pageB.getByTestId('shared-brief-view')).toBeVisible();
  });

  await test.step('9. the anon viewer is prompted to sign up with exactly first name + email; completing it records the conversion', async () => {
    await pageB.getByTestId('share-interact').first().click();
    await expect(pageB.getByTestId('share-signup-first-name')).toBeVisible();
    await expect(pageB.getByTestId('share-signup-email')).toBeVisible();

    await pageB.getByTestId('share-signup-first-name').fill(userB.firstName);
    await pageB.getByTestId('share-signup-email').fill(userB.email);
    await pageB.getByTestId('share-signup-submit').click();

    await signInAsTestUser(pageB, userB, shareTokenPath);

    // Conversion recorded: the same interaction no longer gates behind
    // the signup form.
    await pageB.getByTestId('share-interact').first().click();
    await expect(pageB.getByTestId('share-signup-first-name')).not.toBeVisible();
  });

  await test.step("10. A publishes the original QStack public; B stars it from /market and follows A from A's public profile", async () => {
    await page.goto(originalQStackUrl);
    await page.getByTestId('qstack-visibility').click();
    await expect(page.getByTestId('go-public-prompt')).toBeVisible();
    await page.getByTestId('go-public-prompt').getByRole('button').first().click();

    await pageB.goto('/market');
    const marketCard = pageB.getByTestId('market-card').filter({ hasText: originalTitle });
    await expect(marketCard).toBeVisible();

    const starCountBefore = (await marketCard.getByTestId('star-count').textContent())?.trim() ?? '';
    await marketCard.getByTestId('star-button').click();
    await expect(marketCard.getByTestId('star-count')).not.toHaveText(starCountBefore);

    const profileHref = await marketCard.locator('a[href^="/profiles/"]').first().getAttribute('href');
    if (!profileHref) throw new Error("No /profiles/ link found on A's market card; cannot reach A's public profile");
    await pageB.goto(profileHref);
    await pageB.getByTestId('follow-button').click();
  });
});
