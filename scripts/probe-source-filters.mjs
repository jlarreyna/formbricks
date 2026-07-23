/**
 * Probe Destino/Origen/Ruta/Cabina with sourceName filter.
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

const SOURCES = [
  "Datos operacionales del pasajero AR Plus",
  "Datos operacionales del pasajero CRM Integrated",
];

const QUESTIONS = ["Destino", "Origen", "Numero de vuelo", "Cabina", "Categoria de socio AR Plus", "Red de viaje"];

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

async function dismiss(dialog) {
  await dialog.getByRole("heading", { name: /Medidas/i }).click().catch(() => {});
  await sleep(200);
}

async function readDataRows(dialog) {
  await dialog.getByText("Datos", { exact: true }).click().catch(() => {});
  await sleep(2000);
  return dialog.evaluate(() => {
    const table = document.querySelector('[role="dialog"] table');
    if (!table) return [];
    return [...table.querySelectorAll("tr")]
      .slice(0, 12)
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
  });
}

async function pickFilterValue(page, dialog, index, field, value) {
  const fieldBtns = dialog
    .locator("button")
    .filter({ hasText: /Tipo de origen|Pregunta|Valor|Nombre de origen|Fuente|Sentimiento/i });
  await fieldBtns.nth(index).click();
  await sleep(300);
  await page.getByRole("option", { name: new RegExp(`^${field.replace(/[()]/g, "\\$&")}$`) }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').nth(index).click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill(value);
  await sleep(1000);
  const items = page.locator("[cmdk-item]");
  let ok = false;
  for (let j = 0; j < (await items.count()); j++) {
    const line = (await items.nth(j).innerText()).split("\n")[0].trim();
    if (line === value) {
      await items.nth(j).click();
      ok = true;
      break;
    }
  }
  if (!ok && (await items.count())) {
    await items.first().click();
  }
  await dismiss(dialog);
}

async function probe(page, question, source) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await hideMobile(page);
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1200);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Gráfico de barras" }).click();
  await sleep(350);

  let combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
  await combo.click();
  await combo.pressSequentially("Respuestas", { delay: 8 });
  await sleep(250);
  await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
  await sleep(250);
  await dismiss(dialog);

  await dialog.getByRole("switch").nth(0).click();
  await sleep(500);
  combo = dialog.locator('[role="combobox"][placeholder*="dimensi" i]');
  await combo.click();
  await combo.pressSequentially("Valor (Texto)", { delay: 8 });
  await sleep(250);
  await page.locator("[cmdk-item]").filter({ hasText: "Valor (Texto)" }).first().click();
  await sleep(250);
  await dismiss(dialog);

  await page.locator("#chart-filters-toggle").click();
  await sleep(700);
  await pickFilterValue(page, dialog, 0, "Pregunta", question);

  await dialog.getByRole("button", { name: /Añadir filtro/i }).click();
  await sleep(600);
  await pickFilterValue(page, dialog, 1, "Nombre de origen", source);

  await sleep(2000);
  const rows = await readDataRows(dialog);
  await page.keyboard.press("Escape");
  await sleep(350);
  return rows;
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(35000);
  await login(page);

  for (const source of SOURCES) {
    for (const q of QUESTIONS) {
      console.log(`\n=== ${q} | ${source.slice(0, 40)} ===`);
      try {
        const rows = await probe(page, q, source);
        for (const r of rows) console.log(r);
      } catch (e) {
        console.error("FAIL", e.message.split("\n")[0]);
        await page.keyboard.press("Escape").catch(() => {});
        await sleep(400);
      }
    }
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
