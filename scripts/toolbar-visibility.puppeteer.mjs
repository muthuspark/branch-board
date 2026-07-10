import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import puppeteer from "puppeteer";

const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
const artifactDir = path.resolve("artifacts");
const screenshotPath = path.join(artifactDir, "toolbar-visibility.png");

await mkdir(artifactDir, { recursive: true });

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: "networkidle0" });
  await page.waitForSelector("#hud");

  const readToolbar = () => page.$eval("#hud", element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      width: rect.width,
      height: rect.height,
      buttonCount: element.querySelectorAll("button").length,
      labels: [...element.querySelectorAll("button")].map(button => button.getAttribute("aria-label")),
      buttonsOnScreen: [...element.querySelectorAll("button")].every(button => {
        const buttonRect = button.getBoundingClientRect();
        return buttonRect.width > 0
          && buttonRect.height > 0
          && buttonRect.right > 0
          && buttonRect.bottom > 0
          && buttonRect.left < window.innerWidth
          && buttonRect.top < window.innerHeight;
      })
    };
  });

  const transformBeforeWheel = await page.$eval("#world", element => element.style.transform);
  await page.mouse.move(400, 400);
  await page.mouse.wheel({ deltaY: -200 });
  await page.keyboard.down("Control");
  await page.mouse.wheel({ deltaY: 200 });
  await page.keyboard.up("Control");
  const transformAfterWheel = await page.$eval("#world", element => element.style.transform);

  await page.click("#btn-zoomout");
  const transformAfterButton = await page.$eval("#world", element => element.style.transform);
  await page.click("#btn-zoomin");
  const toolbar = await readToolbar();

  await page.screenshot({ path: screenshotPath, fullPage: true });

  assert.notEqual(toolbar.display, "none", "canvas toolbar must be displayed");
  assert.notEqual(toolbar.visibility, "hidden", "canvas toolbar must be visible");
  assert.notEqual(toolbar.opacity, "0", "canvas toolbar must be opaque");
  assert.ok(toolbar.width > 0 && toolbar.height > 0, "canvas toolbar must occupy visible space");
  assert.equal(toolbar.buttonsOnScreen, true, "every canvas control must remain on-screen after zooming");
  assert.equal(toolbar.buttonCount, 4, "canvas toolbar must expose all four controls");
  assert.deepEqual(toolbar.labels, ["Show all", "Smaller", "Bigger", "Center"]);
  assert.equal(transformAfterWheel, transformBeforeWheel, "wheel and pinch gestures must not zoom the canvas");
  assert.notEqual(transformAfterButton, transformBeforeWheel, "zoom buttons must still change the canvas scale");

  console.log(JSON.stringify({ baseUrl, screenshotPath, toolbar }, null, 2));
} finally {
  await browser.close();
}
