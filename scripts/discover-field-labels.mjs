/**
 * Discover which fieldLabels hold hierarchy values (Cabotaje, EZE, AR####, Economy).
 */
import { chromium } from "playwright";

const BASE = "http://vps-6119855-x.dattaweb.com:3000";
const WORKSPACE = "cmqzlt2ib000301mqf7hgk228";
const DIR = "cmrtn8ksu000k01pcdeh70mk8";
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

async function openBuilder(page) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await hideMobile(page);
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1500);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Gráfico de barras" }).click();
  await sleep(400);
  return dialog;
}

async function dismiss(page, dialog) {
  await dialog.getByRole("heading", { name: /Medidas/i }).click().catch(() => {});
  await sleep(250);
}

async function selectMeasure(page, dialog) {
  const combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
  await combo.click();
  await combo.pressSequentially("Respuestas", { delay: 10 });
  await sleep(300);
  await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
  await sleep(300);
  await dismiss(page, dialog);
}

async function enableDim(page, dialog, dimLabel) {
  if ((await dialog.locator('[role="combobox"][placeholder*="dimensi" i]').count()) === 0) {
    await dialog.getByRole("switch").nth(0).click();
    await sleep(600);
  }
  const combo = dialog.locator('[role="combobox"][placeholder*="dimensi" i]');
  await combo.click();
  await combo.pressSequentially(dimLabel, { delay: 10 });
  await sleep(300);
  await page.locator("[cmdk-item]").filter({ hasText: dimLabel }).first().click();
  await sleep(300);
  await dismiss(page, dialog);
}

async function setFilter(page, dialog, fieldLabel, value) {
  const filterSwitch = page.locator("#chart-filters-toggle");
  if ((await filterSwitch.getAttribute("aria-checked")) !== "true") {
    await filterSwitch.click();
    await sleep(800);
  }
  // field select
  const fieldBtn = dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta|Fuente|Valor|Source/i }).first();
  await fieldBtn.click();
  await sleep(300);
  await page.getByRole("option", { name: new RegExp(`^${fieldLabel}$`, "i") }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').last().click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill(value);
  await sleep(900);
  const items = page.locator("[cmdk-item]");
  for (let j = 0; j < (await items.count()); j++) {
    const line = (await items.nth(j).innerText()).split("\n")[0].trim();
    if (line === value || line.includes(value)) {
      await items.nth(j).click();
      console.log("  selected filter value:", line);
      break;
    }
  }
  await dismiss(page, dialog);
  await sleep(2500);
}

async function readData(dialog) {
  await dialog.getByText("Datos", { exact: true }).click().catch(() => {});
  await sleep(1500);
  return dialog.evaluate(() => {
    const table = document.querySelector('[role="dialog"] table');
    if (!table) return [];
    return [...table.querySelectorAll("tr")]
      .slice(0, 25)
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await login(page);

  // 1) All questions (Pregunta dimension)
  console.log("\n=== ALL PREGUNTAS ===");
  let dialog = await openBuilder(page);
  await selectMeasure(page, dialog);
  await enableDim(page, dialog, "Pregunta");
  await sleep(3000);
  for (const r of await readData(dialog)) console.log(r);
  await page.keyboard.press("Escape");
  await sleep(500);

  // 2) Find which question has Cabotaje
  console.log("\n=== VALUE Cabotaje -> which Pregunta? ===");
  dialog = await openBuilder(page);
  await selectMeasure(page, dialog);
  await enableDim(page, dialog, "Pregunta");
  await setFilter(page, dialog, "Valor \\(Texto\\)", "Cabotaje");
  // field might need exact - try Valor (Texto)
  for (const r of await readData(dialog)) console.log(r);
  await page.keyboard.press("Escape");
  await sleep(500);

  // Retry Cabotaje properly
  console.log("\n=== VALUE filter Cabotaje (retry) ===");
  dialog = await openBuilder(page);
  await selectMeasure(page, dialog);
  await enableDim(page, dialog, "Pregunta");
  // manual filter Valor (Texto)
  const filterSwitch = page.locator("#chart-filters-toggle");
  await filterSwitch.click();
  await sleep(800);
  await dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta/i }).first().click();
  await sleep(300);
  await page.getByRole("option", { name: /Valor \(Texto\)/i }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').last().click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill("Cabotaje");
  await sleep(1000);
  const items = page.locator("[cmdk-item]");
  console.log("cabotaje options:");
  for (let j = 0; j < Math.min(await items.count(), 10); j++) {
    console.log(" -", (await items.nth(j).innerText()).split("\n")[0].trim());
  }
  if (await items.count()) {
    await items.first().click();
    await sleep(2500);
    for (const r of await readData(dialog)) console.log(r);
  }
  await page.keyboard.press("Escape");
  await sleep(500);

  // 3) Find EZE
  console.log("\n=== VALUE EZE -> Pregunta ===");
  dialog = await openBuilder(page);
  await selectMeasure(page, dialog);
  await enableDim(page, dialog, "Pregunta");
  await page.locator("#chart-filters-toggle").click();
  await sleep(800);
  await dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta/i }).first().click();
  await sleep(300);
  await page.getByRole("option", { name: /Valor \(Texto\)/i }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').last().click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill("EZE");
  await sleep(1000);
  const items2 = page.locator("[cmdk-item]");
  if (await items2.count()) {
    await items2.first().click();
    await sleep(2500);
    for (const r of await readData(dialog)) console.log(r);
  } else console.log("no EZE");
  await page.keyboard.press("Escape");
  await sleep(500);

  // 4) Search question labels containing Red / Destino / Origen / vuelo
  console.log("\n=== Pregunta picker search Red/Destino/Origen/vuelo/Cabina ===");
  dialog = await openBuilder(page);
  await selectMeasure(page, dialog);
  await page.locator("#chart-filters-toggle").click();
  await sleep(800);
  await dialog.locator("button").filter({ hasText: /Tipo de origen/i }).first().click();
  await sleep(300);
  await page.getByRole("option", { name: /^Pregunta$/i }).click();
  await sleep(700);
  for (const term of ["Red", "Destino", "Origen", "vuelo", "Cabina", "Categoria", "Fuente"]) {
    await dialog.locator('button[aria-haspopup="listbox"]').last().click();
    await sleep(300);
    await page.locator('input[type="search"]').last().fill(term);
    await sleep(900);
    console.log("term", term);
    const its = page.locator("[cmdk-item]");
    for (let j = 0; j < Math.min(await its.count(), 15); j++) {
      console.log(" -", (await its.nth(j).innerText()).split("\n")[0].trim());
    }
    await page.keyboard.press("Escape");
    await sleep(200);
  }

  console.log("dir", DIR);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
