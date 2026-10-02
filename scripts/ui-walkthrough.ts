/**
 * Drives the real UI in headless Chromium: sign in → OCR → Print → upload →
 * book type → settings → analyze → review → preview → export, saving a
 * screenshot per step. Requires the app (vite) and API server running.
 *
 *   node scripts/ui-walkthrough.ts <appUrl> <file.pdf> <outDir>
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer, { type Page } from "puppeteer-core";
import { config } from "../server/config.ts";

const [appUrl = "http://localhost:5199", file, outDir = "ui-shots"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: config.browserPath!, headless: true, defaultViewport: { width: 1500, height: 940 } });
const page = await browser.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

async function clickText(p: Page, text: string, selector = "button") {
  const ok = await p.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.textContent?.trim().includes(t));
      el?.click();
      return !!el;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`No ${selector} containing "${text}"`);
}
const shot = (name: string) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
const waitText = (t: string, timeout = 60_000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t);

await page.goto(appUrl, { waitUntil: "networkidle0" });
await clickText(page, "Sign in").catch(() => {});
await new Promise((r) => setTimeout(r, 500));
await clickText(page, "OCR → Print");
await waitText("OpenAI:");
await shot("01-list");

await clickText(page, "New book from files");
const input = await page.waitForSelector('input[type="file"]');
await (input as unknown as { uploadFile(p: string): Promise<void> }).uploadFile(file);
await waitText(path.basename(file));
await shot("02-upload");
await clickText(page, "Continue");
await clickText(page, "Auto detect");
await shot("03-type");
await clickText(page, "Continue");
await page.type('input[placeholder="e.g. Karthikeyan Analysis Study Circle"]', "Karthikeyan Analysis Study Circle");
await shot("04-settings");
await clickText(page, "Analyze document");
await waitText("Processing document", 30_000).catch(() => {});
await shot("05-progress");
await waitText("Review issues", 180_000);
await new Promise((r) => setTimeout(r, 800));
await shot("06-review");

// Select first flagged/any block on the source page, edit, approve.
await page.evaluate(() => (document.querySelector('ul li button') as HTMLElement | null)?.click());
await new Promise((r) => setTimeout(r, 400));
await shot("07-review-selected");

await clickText(page, "Book preview");
await page.waitForFunction(() => /\d+ pages/.test(document.body.innerText), { timeout: 60_000 });
await new Promise((r) => setTimeout(r, 1200));
await shot("08-preview");

await clickText(page, "Export");
await clickText(page, "Generate print PDF");
await page.waitForFunction(() => /READY FOR PRINT/.test(document.body.innerText), { timeout: 180_000 });
await shot("09-export");

console.log(errors.length ? `Browser errors:\n${errors.join("\n")}` : "No browser errors.");
await browser.close();
