import { existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { test, expect, type Page, type BrowserContext, type Locator } from '@playwright/test';
import { signInAsTestUser, testEmail, deleteTestUser, runId } from './helpers/auth';
import { DEFAULT_ANCHORS } from '../../src/lib/rubric';

// PRD Section 8, Goal 3: touch parity on the same live-interview surface
// covered by interview-keyboard.spec.ts. Every interaction here is a
// real touch event (locator.tap() against a hasTouch context) or, for
// text entry, a tap-to-focus followed by keyboard.type() the way a real
// on-screen keyboard ultimately dispatches key events once a field has
// focus. No .click() and no keyboard Enter/Space activation anywhere in
// this file.

const envFile = path.resolve('.env.local');
if (existsSync(envFile) && !process.env.SUPABASE_SECRET_KEY) {
  process.loadEnvFile(envFile);
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (see .env.local); fixture setup cannot run without them.',
    );
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function tapAndVerify(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.tap();
}

const email = testEmail('touch');
const qstackTitle = `E2E ${runId} Touch QStack`;
const candidateName = `E2E ${runId} Touch Candidate`;
const responseText = `E2E ${runId} touch response: walked through a concrete example, start to finish, with a measurable outcome.`;

let context: BrowserContext;
let page: Page;
let orgId: string;
let userId: string;
let qstackId: string;
let questionOneText: string;
let questionTwoText: string;

test.describe.serial('Full interview session, touch only', () => {
  test.beforeAll(async ({ browser }) => {
    // hasTouch is what makes locator.tap() legal; without it Playwright
    // throws "The page does not support tap".
    context = await browser.newContext({ hasTouch: true });
    page = await context.newPage();

    await signInAsTestUser(page, { email, firstName: 'Toni' }, '/library');

    const admin = adminClient();

    const { data: userRow, error: userErr } = await admin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (userErr || !userRow) throw new Error(`could not resolve test user row: ${userErr?.message}`);
    userId = userRow.id as string;

    const { data: membership, error: memberErr } = await admin
      .from('org_members')
      .select('org_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (memberErr || !membership) throw new Error(`could not resolve org membership: ${memberErr?.message}`);
    orgId = membership.org_id as string;

    const { data: questions, error: qErr } = await admin
      .from('questions')
      .select('id, text')
      .eq('screening_status', 'passed')
      .limit(2);
    if (qErr) throw new Error(`could not query questions: ${qErr.message}`);
    if (!questions || questions.length < 2) {
      throw new Error(
        `fixture needs at least 2 screening_status='passed' questions to exercise prev/next navigation; found ${questions?.length ?? 0}. Seed the question bank first.`,
      );
    }
    questionOneText = questions[0]!.text as string;
    questionTwoText = questions[1]!.text as string;

    const { data: qstack, error: qsErr } = await admin
      .from('qstacks')
      .insert({ org_id: orgId, owner_id: userId, title: qstackTitle })
      .select('id')
      .single();
    if (qsErr || !qstack) throw new Error(`could not create fixture QStack: ${qsErr?.message}`);
    qstackId = qstack.id as string;

    const { error: itemsErr } = await admin.from('qstack_items').insert([
      {
        qstack_id: qstackId,
        question_id: questions[0]!.id,
        position: 0,
        rubric: { anchors: DEFAULT_ANCHORS },
        followups: [],
      },
      {
        qstack_id: qstackId,
        question_id: questions[1]!.id,
        position: 1,
        rubric: { anchors: DEFAULT_ANCHORS },
        followups: [],
      },
    ]);
    if (itemsErr) throw new Error(`could not create fixture qstack_items: ${itemsErr.message}`);

    const { error: ivErr } = await admin
      .from('interviews')
      .insert({ org_id: orgId, qstack_id: qstackId, candidate_name: candidateName });
    if (ivErr) throw new Error(`could not create fixture interview: ${ivErr.message}`);
  });

  test.afterAll(async () => {
    await deleteTestUser(email);
    await context?.close();
  });

  test('a full session runs start to finish using only touch', async () => {
    await test.step('1. reach the interview from /interviews and start the session via tap', async () => {
      await page.goto('/interviews');
      const row = page.getByTestId('interview-row').filter({ hasText: candidateName });
      await expect(row).toBeVisible();
      const startButton = row.getByTestId('start-session');
      await tapAndVerify(startButton);
      await page.waitForURL(/\/live\//);
    });

    await test.step('2. pass the consent gate via tap only', async () => {
      const interviewerCheckbox = page.getByTestId('consent-party-interviewer');
      await tapAndVerify(interviewerCheckbox);
      await expect(interviewerCheckbox).toBeChecked();

      const candidateCheckbox = page.getByTestId('consent-party-candidate');
      await tapAndVerify(candidateCheckbox);
      await expect(candidateCheckbox).toBeChecked();

      const confirmButton = page.getByTestId('consent-confirm');
      await tapAndVerify(confirmButton);

      await expect(page.getByTestId('response-field')).toBeVisible();
      await expect(page.getByTestId('live-question')).toBeVisible();
    });

    await test.step('3. navigate between questions with prev-question / next-question via tap', async () => {
      await expect(page.getByTestId('live-question')).toContainText(questionOneText);

      const nextButton = page.getByTestId('next-question');
      await tapAndVerify(nextButton);
      await expect(page.getByTestId('live-question')).toContainText(questionTwoText);

      const prevButton = page.getByTestId('prev-question');
      await tapAndVerify(prevButton);
      await expect(page.getByTestId('live-question')).toContainText(questionOneText);
    });

    await test.step('4. capture a response: tap to focus response-field, then type', async () => {
      const responseField = page.getByTestId('response-field');
      await tapAndVerify(responseField);
      await expect(responseField).toBeFocused();
      await page.keyboard.type(responseText);
      // Debounced save, ~500ms.
      await expect(page.getByTestId('response-saved')).toBeVisible();
    });

    await test.step('5. apply a score via a score-anchor button, via tap', async () => {
      const scoreThree = page.getByTestId('score-anchor-3');
      await tapAndVerify(scoreThree);
      await expect(page.getByTestId('score-saved')).toBeVisible();
      await expect(scoreThree).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('6. override the score via tap; history preserves both entries', async () => {
      const overrideButton = page.getByTestId('override-score');
      await tapAndVerify(overrideButton);

      const scoreOne = page.getByTestId('score-anchor-1');
      await tapAndVerify(scoreOne);
      await expect(page.getByTestId('score-saved')).toBeVisible();
      await expect(scoreOne).toHaveAttribute('aria-pressed', 'true');

      const historyEntries = page.getByTestId('score-history-entry');
      await expect(historyEntries).toHaveCount(2);
      await expect(historyEntries.first()).toContainText('3');
      await expect(historyEntries.first()).toContainText('superseded');
      await expect(historyEntries.last()).toContainText('1');
    });

    await test.step('7. end the session via tap and reach the ended view', async () => {
      const endButton = page.getByTestId('end-session');
      await tapAndVerify(endButton);
      await expect(page.getByText('Session ended')).toBeVisible();
      await expect(page.getByTestId('generate-brief')).toBeVisible();
    });
  });
});
