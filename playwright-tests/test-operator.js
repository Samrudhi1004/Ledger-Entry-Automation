/**
 * Inspection Hub – Operator Testing Script (Headed Mode)
 * Runs Playwright in a VISIBLE browser so you can watch every step.
 *
 * Usage:  node test-operator.js
 *
 * Credentials: operator / operator123
 * App URL:     http://localhost:8090
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Config ────────────────────────────────────────────────────────────────
const APP_URL     = 'http://localhost:8090';
const USERNAME    = 'operator';
const PASSWORD    = 'operator123';
const VIEWPORT    = { width: 412, height: 915 };           // Pixel 6 mobile
const SLOW_MO     = 600;                                    // ms between actions – easy to watch
const SCREENSHOT_DIR = join('..', 'screenshots');
const ISSUES_FILE    = join('..', 'TESTING_ISSUES.md');

// ─── Helpers ───────────────────────────────────────────────────────────────
let issueCount = 0;
const issues   = [];

function logIssue({ title, screen, severity, description, expected }) {
  issueCount++;
  issues.push({ issueCount, title, screen, severity, description, expected });
  console.log(`\n⚠️  ISSUE #${issueCount}: ${title}`);
  console.log(`   Screen: ${screen} | Severity: ${severity}`);
  console.log(`   ${description}`);
}

async function shot(page, name) {
  const file = join(SCREENSHOT_DIR, `${String(issueCount + 100).slice(1)}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`📸  ${name}.png`);
  return file;
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main ──────────────────────────────────────────────────────────────────
(async () => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  console.log('🚀  Launching headed Chromium at mobile size …');
  const browser = await chromium.launch({
    headless: false,
    slowMo: SLOW_MO,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,           // retina – makes mobile look sharp
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 Chrome/112.0 Mobile Safari/537.36',
  });

  const page = await context.newPage();

  // ── 1. Splash / Login ─────────────────────────────────────────────────
  console.log('\n── Step 1: Splash & Login ──');
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await wait(3000);
  await shot(page, '01-splash');

  // Check splash loaded at all
  const title = await page.title();
  console.log(`   Page title: "${title}"`);
  if (!title) {
    logIssue({
      title: 'App title missing',
      screen: 'Splash',
      severity: 'Low',
      description: 'Page <title> is empty.',
      expected: 'Title should be "Inspection Hub"',
    });
  }

  // Wait for login form (Flutter may take a moment to hydrate)
  console.log('   Waiting for login form …');
  try {
    // Flutter web renders into a canvas or DOM – try both approaches
    await page.waitForSelector('flt-text-editing-host, input[type="text"], flt-semantics-placeholder', {
      timeout: 15_000,
    });
  } catch {
    console.log('   ℹ️  No standard input found yet – Flutter may use canvas rendering.');
  }
  await shot(page, '02-login-screen');

  // Try clicking username field (Flutter web uses semantic overlays)
  console.log('   Attempting login …');
  try {
    // Enable accessibility / semantic tree in Flutter web
    // Flutter exposes an accessibility tree that Playwright can interact with
    await page.keyboard.press('F1');   // sometimes opens flutter inspector – harmless
    await wait(500);

    // Click where the username field should be visually
    // On mobile viewport 412×915, username field is roughly in the upper-center
    await page.mouse.click(206, 400);
    await wait(500);
    await page.keyboard.type(USERNAME, { delay: 100 });
    await wait(400);

    // Tab to password
    await page.keyboard.press('Tab');
    await wait(400);
    await page.keyboard.type(PASSWORD, { delay: 100 });
    await wait(400);

    await shot(page, '03-credentials-entered');

    // Press Enter or click Login button
    await page.keyboard.press('Enter');
    await wait(5000);   // give API time to respond
    await shot(page, '04-after-login');

  } catch (err) {
    logIssue({
      title: 'Login interaction failed',
      screen: 'LoginScreen',
      severity: 'Critical',
      description: `Could not type into login fields: ${err.message}`,
      expected: 'Username and password fields should accept keyboard input.',
    });
    await shot(page, '04-login-error');
  }

  // ── 2. Home Screen ────────────────────────────────────────────────────
  console.log('\n── Step 2: Operator Home Screen ──');
  await wait(3000);
  await shot(page, '05-home-screen');

  const bodyText = await page.evaluate(() => document.body.innerText || '');
  if (bodyText.includes('error') || bodyText.includes('Exception')) {
    logIssue({
      title: 'Error text visible on Home Screen',
      screen: 'Home',
      severity: 'High',
      description: `Page contains error text: ${bodyText.slice(0, 200)}`,
      expected: 'Home screen should show 5 operator module cards.',
    });
  }

  // ── 3. Module Cards – iterate by coordinate ───────────────────────────
  // On a 412-wide screen the 2-column grid places cards at roughly:
  //  Row1: Machine (100,320)  |  Resume Entry (310,320)
  //  Row2: Daily Report(100,480)| JH-Inspect (310,480)
  //  Row3: Doc Control(206,640)
  const modules = [
    { name: 'Machine',                x: 100, y: 320 },
    { name: 'Resume Entry',           x: 310, y: 320 },
    { name: 'Daily Production Report',x: 100, y: 480 },
    { name: 'JH-Inspection',         x: 310, y: 480 },
    { name: 'Document Control',       x: 206, y: 640 },
  ];

  for (const [idx, mod] of modules.entries()) {
    console.log(`\n── Step 3.${idx + 1}: ${mod.name} ──`);
    try {
      // Go back to home if we navigated away
      await page.goBack({ timeout: 5000 }).catch(() => {});
      await wait(1500);

      // Click the module card
      await page.mouse.click(mod.x, mod.y);
      await wait(3500);
      await shot(page, `06-module-${idx + 1}-${mod.name.replace(/ /g, '-')}`);

      const modText = await page.evaluate(() => document.body.innerText || '');
      if (modText.includes('error') || modText.includes('Exception') || modText.includes('failed')) {
        logIssue({
          title: `${mod.name} module shows error`,
          screen: mod.name,
          severity: 'High',
          description: `Error content after opening ${mod.name}: ${modText.slice(0, 300)}`,
          expected: `${mod.name} screen should load its data from the API.`,
        });
      }
    } catch (err) {
      logIssue({
        title: `${mod.name} navigation failed`,
        screen: mod.name,
        severity: 'High',
        description: `Navigation to ${mod.name} threw: ${err.message}`,
        expected: 'Tapping a module card should open its screen.',
      });
      await shot(page, `06-module-${idx + 1}-ERROR`);
    }
  }

  // ── 4. Bottom Nav – Tasks tab ─────────────────────────────────────────
  console.log('\n── Step 4: Tasks Tab (bottom nav) ──');
  try {
    await page.goBack({ timeout: 5000 }).catch(() => {});
    await wait(1000);
    // Tasks tab is the middle bottom nav item on 412px wide screen ≈ x:206, y:880
    await page.mouse.click(206, 880);
    await wait(2500);
    await shot(page, '07-tasks-tab');
  } catch (err) {
    logIssue({
      title: 'Tasks tab navigation failed',
      screen: 'Tasks',
      severity: 'Medium',
      description: err.message,
      expected: 'Tasks tab should show assigned tasks.',
    });
  }

  // ── 5. Bottom Nav – About/Account tab ────────────────────────────────
  console.log('\n── Step 5: About/Account Tab ──');
  try {
    await page.mouse.click(380, 880);
    await wait(2500);
    await shot(page, '08-about-tab');

    const aboutText = await page.evaluate(() => document.body.innerText || '');
    if (!aboutText.includes('operator') && !aboutText.includes('Operator') && !aboutText.includes('John')) {
      logIssue({
        title: 'About tab does not show operator user info',
        screen: 'About/Profile',
        severity: 'Medium',
        description: 'About screen does not display the logged-in operator\'s name or username.',
        expected: 'Should show "John Operator" or "operator" user details.',
      });
    }
  } catch (err) {
    logIssue({
      title: 'About tab navigation failed',
      screen: 'About',
      severity: 'Medium',
      description: err.message,
      expected: 'About/Account tab should show user profile.',
    });
  }

  // ── 6. Chat / Messaging ───────────────────────────────────────────────
  console.log('\n── Step 6: Messaging ──');
  try {
    // Go back to home tab first
    await page.mouse.click(30, 880);
    await wait(1000);
    // Chat icon is in the top-right header area around x:356, y:50
    await page.mouse.click(356, 50);
    await wait(3000);
    await shot(page, '09-messaging');

    const msgText = await page.evaluate(() => document.body.innerText || '');
    if (msgText.includes('error') || msgText.includes('WebSocket') || msgText.includes('failed')) {
      logIssue({
        title: 'Messaging screen shows WebSocket or connection error',
        screen: 'Messaging',
        severity: 'High',
        description: `Text on messaging screen: ${msgText.slice(0, 300)}`,
        expected: 'Messages screen should list conversations.',
      });
    }
  } catch (err) {
    logIssue({
      title: 'Messaging screen failed to open',
      screen: 'Messaging',
      severity: 'High',
      description: err.message,
      expected: 'Chat icon should open the messages screen.',
    });
  }

  // ── 7. Write Issues Report ────────────────────────────────────────────
  console.log('\n\n════════════════════════════════════════');
  console.log(`  TESTING COMPLETE  –  ${issueCount} issue(s) found`);
  console.log('════════════════════════════════════════\n');

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines = [
    `# Inspection Hub – Operator Testing Issues`,
    ``,
    `**Tested by:** Automated Playwright (headed)  `,
    `**Date:** ${now}  `,
    `**Role:** Operator (username: \`operator\`)  `,
    `**App URL:** ${APP_URL}  `,
    `**Viewport:** 412 × 915 (Pixel 6 mobile)  `,
    ``,
    `---`,
    ``,
    `## Summary`,
    ``,
    `| #  | Screen | Severity | Title |`,
    `|----|--------|----------|-------|`,
    ...issues.map(i =>
      `| ${i.issueCount} | ${i.screen} | ${i.severity} | ${i.title} |`
    ),
    ``,
    `---`,
    ``,
    `## Detailed Issues`,
    ``,
    ...issues.flatMap(i => [
      `## Issue #${i.issueCount}: ${i.title}`,
      `**Screen:** ${i.screen}  `,
      `**Severity:** ${i.severity}  `,
      `**Description:** ${i.description}  `,
      `**Expected:** ${i.expected}  `,
      ``,
    ]),
    issueCount === 0 ? `*No issues detected during automated run.*` : '',
    ``,
    `---`,
    ``,
    `## Pre-Existing Code Issues (from source review)`,
    ``,
    `## Issue #P1: Hardcoded Inspector Name`,
    `**Screen:** Operator Home Screen  `,
    `**Severity:** Medium  `,
    `**Description:** \`operator_home_screen.dart\` hardcodes \`_assignedInspectorName = 'Samruddhi Bartakke'\` — value never fetched from API.  `,
    `**Expected:** Inspector name should be fetched from the backend assignment API.  `,
    ``,
    `## Issue #P2: Hardcoded Part Number Fallback`,
    `**Screen:** App Home Screen  `,
    `**Severity:** Low  `,
    `**Description:** \`app_home_screen.dart\` falls back to \`partNumber = 'FBT00222'\` when no part is selected.  `,
    `**Expected:** App should prompt user to select a part if none is assigned.  `,
    ``,
    `## Issue #P3: flutter_secure_storage on Web Uses localStorage`,
    `**Screen:** Login / Auth  `,
    `**Severity:** Medium  `,
    `**Description:** JWT token stored in browser \`localStorage\` (unencrypted) when running as Flutter Web. On Android it uses \`EncryptedSharedPreferences\`.  `,
    `**Expected:** Web sessions should either use sessionStorage or warn that web mode is less secure.  `,
    ``,
  ];

  writeFileSync(ISSUES_FILE, lines.join('\n'), 'utf8');
  console.log(`📝  Issues written to: ${ISSUES_FILE}`);
  console.log(`📸  Screenshots in:    ${SCREENSHOT_DIR}`);

  // Keep the browser open for 30 s so user can inspect it
  console.log('\n⏳  Browser stays open for 60 s so you can inspect it …');
  await wait(60_000);

  await browser.close();
  console.log('✅  Done.');
})();
