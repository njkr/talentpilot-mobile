#!/usr/bin/env node
// Captures phone-sized screenshots of the app (light + dark) for the README.
//
//   TEST_EMAIL=... TEST_PASSWORD=... VITE_API_BASE_URL=http://localhost:3010/api/v1 bun run screenshots
//
// - Needs the API running and reachable at VITE_API_BASE_URL, and a test account that has at
//   least one resume, one job and one completed analysis (see "Testing" in the README).
// - Uses the app on http://localhost:8080 (starts `bun run dev` itself if nothing is listening).
// - Output: docs/screenshots/{light,dark}/<name>.png (412px wide, optimised).
// - Refuses to save anything if a screen shows personal data (see checkPrivacy).
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:8080";
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const OUT = join(ROOT, "docs", "screenshots");
const WIDTH = 412;

// Anything matching these on a screen aborts the run. Extend via SCREENSHOT_BLOCKLIST="a,b".
const BLOCKLIST = (process.env.SCREENSHOT_BLOCKLIST ?? "jenkins,jenraj,njkr,jenkinsraj")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const ALLOWED_EMAILS = new Set([EMAIL?.toLowerCase(), "john.carter@example.com"].filter(Boolean));

const SCREENS_PUBLIC = [{ name: "login", path: "/login" }];
const TABS = ["report", "suggestions", "cover-letter", "interview", "salary"];

const die = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

if (!EMAIL || !PASSWORD)
  die("Set TEST_EMAIL and TEST_PASSWORD (the seeded test account) in the environment.");

async function reachable(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

let devServer = null;
async function ensureServer() {
  if (await reachable(BASE_URL)) return;
  if (!process.env.VITE_API_BASE_URL)
    die(
      "Nothing is listening on " +
        BASE_URL +
        ". Set VITE_API_BASE_URL so I can start `bun run dev`, or start it yourself.",
    );
  console.log("Starting dev server…");
  devServer = spawn("bun", ["run", "dev"], {
    cwd: ROOT,
    shell: true,
    stdio: "ignore",
    env: process.env,
  });
  for (let i = 0; i < 60; i++) {
    if (await reachable(BASE_URL)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  die("The dev server did not start within 60s.");
}

const NO_MOTION_CSS = `
  *,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
  [data-sonner-toaster]{display:none!important}
  vite-error-overlay{display:none!important}
`;

/** Wait for the app shell, network idle and no skeletons. */
async function settle(page, { authed = true } = {}) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  if (authed) await page.waitForSelector('nav a[href="/me"]', { timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector(".tp-shimmer"), null, {
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(400);
}

/** Abort if the visible text contains personal data other than the test account / fictional resume. */
async function checkPrivacy(page, label) {
  const text = await page.evaluate(() => document.body.innerText);
  const problems = [];
  for (const m of text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [])
    if (!ALLOWED_EMAILS.has(m.toLowerCase())) problems.push(`email ${m}`);
  for (const m of text.match(/(\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) ?? [])
    if (!/\b555\b/.test(m)) problems.push(`phone ${m}`);
  const lower = text.toLowerCase();
  for (const w of BLOCKLIST) if (lower.includes(w)) problems.push(`blocked word "${w}"`);
  if (problems.length)
    die(
      `Possible personal data on "${label}": ${problems.join("; ")}\nNothing from this run was kept for that screen. Fix the test account data (or SCREENSHOT_BLOCKLIST) and re-run.`,
    );
}

async function optimise(buf, file) {
  await sharp(buf)
    .resize({ width: WIDTH })
    .png({ compressionLevel: 9, palette: true, quality: 82, effort: 8 })
    .toFile(file);
}

async function firstHref(page, selector, exclude) {
  const hrefs = await page.$$eval(selector, (els) => els.map((e) => e.getAttribute("href")));
  const href = hrefs.find((h) => h && !(exclude && h.endsWith(exclude)));
  if (!href)
    die(
      `No item found for ${selector}. The test account needs at least one resume, one job and one completed analysis.`,
    );
  return href;
}

async function run() {
  await ensureServer();
  rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch();
  const written = [];

  try {
    for (const theme of ["light", "dark"]) {
      const dir = join(OUT, theme);
      mkdirSync(dir, { recursive: true });
      const ctx = await browser.newContext({
        ...devices["Pixel 7"],
        deviceScaleFactor: 2,
        colorScheme: theme,
        reducedMotion: "reduce",
        locale: "en-US",
        timezoneId: "America/Chicago",
      });
      await ctx.addInitScript(
        ([themeValue, css]) => {
          try {
            localStorage.setItem("tp-theme", themeValue);
          } catch {
            /* ignore */
          }
          const add = () => {
            const s = document.createElement("style");
            s.textContent = css;
            (document.head ?? document.documentElement).appendChild(s);
          };
          if (document.head) add();
          else document.addEventListener("DOMContentLoaded", add);
        },
        [theme, NO_MOTION_CSS],
      );
      const page = await ctx.newPage();

      const shot = async (name, label = name) => {
        await checkPrivacy(page, `${theme}/${label}`);
        const buf = await page.screenshot({ type: "png" }); // viewport only
        const file = join(dir, `${name}.png`);
        await optimise(buf, file);
        written.push(`docs/screenshots/${theme}/${name}.png`);
        console.log(`  ✓ ${theme}/${name}`);
      };
      const go = async (path, opts) => {
        await page.goto(BASE_URL + path, { waitUntil: "domcontentloaded" });
        await settle(page, opts);
      };

      console.log(`\n${theme}:`);
      for (const s of SCREENS_PUBLIC) {
        await go(s.path, { authed: false });
        await page.waitForSelector('input[type="email"]');
        await shot(s.name);
      }

      // Log in through the UI.
      await page.fill('input[type="email"]', EMAIL);
      await page.fill('input[type="password"]', PASSWORD);
      await page.click('button[type="submit"]');
      try {
        await page.waitForSelector('nav a[href="/me"]', { timeout: 30_000 });
      } catch {
        die(
          "Login failed (the app never reached the signed-in shell). Is the API running at VITE_API_BASE_URL and are TEST_EMAIL/TEST_PASSWORD correct?",
        );
      }
      await settle(page);

      await go("/");
      await shot("home");

      await go("/resumes");
      await shot("resumes");
      const resumeHref = await firstHref(page, 'a[href^="/resumes/"]');
      await go(resumeHref);
      await shot("resume-detail");

      await go("/jobs");
      await shot("jobs");
      const jobHref = await firstHref(page, 'a[href^="/jobs/"]', "/new");
      await go(jobHref);
      await shot("job-detail");

      await go("/analyses");
      await shot("analyses");
      const analysisHref = await firstHref(page, 'a[href^="/analyses/"]');
      for (const tab of TABS) {
        await go(`${analysisHref}?tab=${tab}`);
        await shot(tab);
      }

      await go("/me");
      await shot("me");
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (devServer) devServer.kill();
  }

  // Report sizes.
  let total = 0;
  for (const f of written) total += statSync(join(ROOT, f)).size;
  console.log(`\n${written.length} screenshots, ${(total / 1024 / 1024).toFixed(2)} MB total:`);
  for (const theme of ["light", "dark"])
    console.log(`  ${theme}: ${readdirSync(join(OUT, theme)).join(", ")}`);
  if (total > 5 * 1024 * 1024)
    console.warn("⚠ Total size is over 5 MB; consider reducing the number of screens.");
}

run().catch((e) => die(e.stack ?? String(e)));
