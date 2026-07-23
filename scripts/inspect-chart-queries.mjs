/**
 * Inspect saved query for hierarchy charts via network interception.
 */
import { chromium } from "playwright";

const BASE = "http://vps-6119855-x.dattaweb.com:3000";
const WORKSPACE = "cmqzlt2ib000301mqf7hgk228";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UUID_POLYFILL = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return;
  const g = typeof globalThis !== "undefined" ? globalThis : window;
  if (!g.crypto) g.crypto = {};
  g.crypto.randomUUID = function randomUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
};

const TARGETS = [
  "Jerarquía - Aeropuerto Destino",
  "Jerarquía - Cabina",
  "Jerarquía - Red (Cabotaje / Regional / Internacional)",
];

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  if (page.url().includes("/workspaces/")) return;
  const btn = page.getByRole("button", { name: /correo electrónico|email/i }).first();
  if (await btn.count()) {
    await btn.click();
    await sleep(500);
  }
  await page.locator('input[type="email"]').fill("rgarro@deltree.com.ar");
  await page.locator('input[type="password"]').fill("Password1");
  await page.locator('button[type="submit"]').click();
  await sleep(3500);
}

async function hideMobile(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.inset-0.z-9999").forEach((e) => e.remove());
  });
}

async function inspect(page, name) {
  console.log("\n==>", name);
  const queries = [];
  const onReq = async (request) => {
    if (request.method() !== "POST") return;
    const url = request.url();
    if (!url.includes(BASE)) return;
    const post = request.postData() || "";
    if (post.includes("FeedbackRecords") || post.includes("fieldLabel") || post.includes("executeQuery")) {
      queries.push({ url: url.slice(0, 120), body: post.slice(0, 2500) });
    }
  };
  page.on("request", onReq);

  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await hideMobile(page);
  const row = page
    .locator("div.grid")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  await row.getByRole("button", { name: /Abrir opciones/i }).click();
  await sleep(400);
  await page.getByRole("menuitem", { name: /Editar|Edit/i }).click();
  await sleep(4000);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByText("Datos", { exact: true }).click().catch(() => {});
  await sleep(2000);

  // Extract filter UI + top data rows
  const info = await dialog.evaluate(() => {
    const text = document.body.innerText;
    const filterMatch = text.match(/Pregunta[\s\S]{0,80}es igual a[\s\S]{0,80}/);
    const table = document.querySelector('[role="dialog"] table');
    const rows = table
      ? [...table.querySelectorAll("tr")]
          .slice(0, 12)
          .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "))
      : [];
    return { filterMatch: filterMatch?.[0], rows };
  });
  console.log("UI filter:", info.filterMatch?.replace(/\s+/g, " "));
  console.log("DATA rows:");
  for (const r of info.rows) console.log(" ", r);

  console.log("Captured POSTs:", queries.length);
  for (const q of queries.slice(-3)) {
    console.log("---", q.url);
    // Try to find JSON query blobs
    const m = q.body.match(/\{[^{}]*"measures"[^]{0,800}/);
    console.log(m ? m[0].slice(0, 700) : q.body.slice(0, 700));
  }

  page.off("request", onReq);
  await page.keyboard.press("Escape");
  await sleep(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await login(page);
  for (const name of TARGETS) {
    await inspect(page, name);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
