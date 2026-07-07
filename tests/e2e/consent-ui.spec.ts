import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { signInAsTestUser, testEmail, deleteTestUser, runId } from './helpers/auth';

// PRD Section 8.5, UI path: the consent gate must be unbypassable from
// the DOM's point of view. Behavioral guarantee 1 (surface contract):
// the response field and scoring controls do not exist in the DOM
// until session state is `capturing`; consent-confirm is the only UI
// path there. This spec proves the DOM absence, not just that the
// visible panel says "consent needed."

const email = testEmail('consent');
const qstackTitle = `E2E ${runId} Consent Gate QStack`;

let context: BrowserContext;
let page: Page;
let sessionId: string;

test.describe.serial('Consent gate blocks capture until consent-confirm', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await signInAsTestUser(page, { email, firstName: 'Casey' }, '/library');

    // A QStack with one bank question, the minimum an interview needs.
    await page.goto('/qstacks/new');
    await page.getByTestId('qstack-title-input').fill(qstackTitle);
    await page.getByTestId('qstack-save').click();
    await page.getByTestId('bank-search-submit').click();
    await page.getByTestId('bank-result').first().getByTestId('bank-add-to-qstack').click();

    // An interview against that QStack, then start the session.
    await page.goto('/interviews');
    await page.getByTestId('new-interview').click();
    await page.getByTestId('interview-candidate-name').fill('Consent Gate Candidate');
    await page.getByTestId('interview-qstack').selectOption({ label: qstackTitle });
    await page.getByTestId('interview-save').click();
    await page.getByTestId('start-session').click();
    await page.waitForURL(/\/live\//);
    sessionId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
  });

  test.afterAll(async () => {
    await deleteTestUser(email);
    await context?.close();
  });

  test('consent gate is unbypassable in the DOM', async () => {
    await test.step('1. session in state created: consent-panel present, no capture controls in the DOM', async () => {
      await expect(page.getByTestId('consent-panel')).toBeVisible();
      await expect(page.getByTestId('response-field')).toHaveCount(0);
      await expect(page.getByTestId('score-anchor-1')).toHaveCount(0);
    });

    await test.step('2. a direct navigation to the live URL pre-consent never exposes capture controls', async () => {
      await page.goto(`/live/${sessionId}`);
      await expect(page.getByTestId('consent-panel')).toBeVisible();
      await expect(page.getByTestId('response-field')).toHaveCount(0);
      await expect(page.getByTestId('score-anchor-1')).toHaveCount(0);
    });

    await test.step('3. consent-confirm is the only UI path to capture; a reload after is allowed to show it', async () => {
      await page.getByTestId('consent-party-interviewer').click();
      await page.getByTestId('consent-party-candidate').click();
      await page.getByTestId('consent-confirm').click();

      await expect(page.getByTestId('response-field')).toBeVisible();
      await expect(page.getByTestId('live-question')).toBeVisible();

      await page.reload();
      await expect(page.getByTestId('response-field')).toBeVisible();
    });
  });
});
