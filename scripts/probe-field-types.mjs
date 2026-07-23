/**
 * Probe fieldType / fieldId under Destino, Origen, Cabina.
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
      .slice(0, 20)
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
  });
}

async function chart(page, { dim, question }) {
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
  await combo.pressSequentially(dim, { delay: 8 });
  await sleep(250);
  await page.locator("[cmdk-item]").filter({ hasText: dim }).first().click();
  await sleep(250);
  await dismiss(dialog);

  await page.locator("#chart-filters-toggle").click();
  await sleep(700);
  await dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta/i }).first().click();
  await sleep(300);
  await page.getByRole("option", { name: /^Pregunta$/i }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').last().click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill(question);
  await sleep(900);
  const items = page.locator("[cmdk-item]");
  for (let j = 0; j < (await items.count()); j++) {
    const line = (await items.nth(j).innerText()).split("\n")[0].trim();
    if (line === question) {
      await items.nth(j).click();
      break;
    }
  }
  await dismiss(dialog);
  await sleep(2500);
  const rows = await readDataRows(dialog);
  await page.keyboard.press("Escape");
  await sleep(350);
  return rows;
}

async function chartWithType(page, question, fieldType) {
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
  // Pregunta
  await dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta/i }).first().click();
  await sleep(300);
  await page.getByRole("option", { name: /^Pregunta$/i }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').last().click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill(question);
  await sleep(900);
  let items = page.locator("[cmdk-item]");
  for (let j = 0; j < (await items.count()); j++) {
    const line = (await items.nth(j).innerText()).split("\n")[0].trim();
    if (line === question) {
      await items.nth(j).click();
      break;
    }
  }
  await dismiss(dialog);

  // Add Tipo de campo filter
  await dialog.getByRole("button", { name: /Añadir filtro/i }).click();
  await sleep(700);
  // second field button - look for default Tipo de origen on new row
  const fieldBtns = dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta|Tipo de campo|Field Type/i });
  await fieldBtns.last().click();
  await sleep(300);
  await page.getByRole("option", { name: /Tipo de campo|Field Type/i }).click();
  await sleep(700);
  await dialog.locator('button[aria-haspopup="listbox"]').last().click();
  await sleep(400);
  await page.locator('input[type="search"]').last().fill(fieldType);
  await sleep(900);
  items = page.locator("[cmdk-item]");
  for (let j = 0; j < (await items.count()); j++) {
    const line = (await items.nth(j).innerText()).split("\n")[0].trim();
    if (line === fieldType) {
      await items.nth(j).click();
      break;
    }
  }
  await dismiss(dialog);
  await sleep(2500);
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

  for (const q of ["Destino", "Origen", "Cabina", "Numero de vuelo"]) {
    console.log(`\n=== fieldType for ${q} ===`);
    try {
      for (const r of await chart(page, { dim: "Tipo de campo", question: q })) console.log(r);
    } catch (e) {
      console.error("FAIL", e.message.split("\n")[0]);
      await page.keyboard.press("Escape").catch(() => {});
    }

    console.log(`\n=== fieldId for ${q} ===`);
    try {
      for (const r of await chart(page, { dim: "ID de campo/ID de pregunta", question: q })) console.log(r);
    } catch (e) {
      // try English-ish
      try {
        for (const r of await chart(page, { dim: "Field ID", question: q })) console.log(r);
      } catch (e2) {
        console.error("FAIL", e.message.split("\n")[0]);
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  }

  // Try Destino + fieldType openText vs multipleChoiceSelection etc
  console.log("\nListing field type options under Destino...");
  // from first probe we know types

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
