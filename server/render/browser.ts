import puppeteer, { type Browser } from "puppeteer-core";
import { config } from "../config.ts";
import { log } from "../log.ts";

let browserPromise: Promise<Browser> | null = null;

/** Shared headless Chromium/Edge instance used for preview, pagination and PDF output. */
export async function getBrowser(): Promise<Browser> {
  if (!config.browserPath) throw new Error("No Chromium-based browser found. Set CHROME_PATH to a Chrome/Edge/Chromium executable.");
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: config.browserPath,
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none", "--allow-file-access-from-files"],
      })
      .then((b) => {
        b.on("disconnected", () => {
          browserPromise = null;
        });
        return b;
      })
      .catch((err) => {
        browserPromise = null;
        log("error", "browser.launch_failed", { error: String(err) });
        throw err;
      });
  }
  return browserPromise;
}

export async function browserAvailable(): Promise<boolean> {
  try {
    const b = await getBrowser();
    return b.connected;
  } catch {
    return false;
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close().catch(() => {});
  }
}
