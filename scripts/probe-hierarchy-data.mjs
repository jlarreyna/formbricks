/**
 * Probe: which Pregunta/Fuente combos yield clean hierarchy values.
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
  await sleep(250);
}

async function readDataRows(dialog) {
  await dialog.getByText("Datos", { exact: true }).click().catch(() => {});
  await sleep(2000);
  return dialog.evaluate(() => {
    const table = document.querySelector('[role="dialog"] table');
    if (!table) return [];
    return [...table.querySelectorAll("tr")]
      .slice(0, 15)
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
  });
}

async function buildChart(page, { dim, filters }) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  await hideMobile(page);
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1400);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Gráfico de barras" }).click();
  await sleep(400);

  // measure
  let combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
  await combo.click();
  await combo.pressSequentially("Respuestas", { delay: 10 });
  await sleep(300);
  await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
  await sleep(300);
  await dismiss(dialog);

  // dim
  await dialog.getByRole("switch").nth(0).click();
  await sleep(600);
  combo = dialog.locator('[role="combobox"][placeholder*="dimensi" i]');
  await combo.click();
  await combo.pressSequentially(dim, { delay: 10 });
  await sleep(300);
  await page.locator("[cmdk-item]").filter({ hasText: dim }).first().click();
  await sleep(300);
  await dismiss(dialog);

  // filters
  await page.locator("#chart-filters-toggle").click();
  await sleep(800);

  for (let i = 0; i < filters.length; i++) {
    const { field, value } = filters[i];
    if (i > 0) {
      await dialog.getByRole("button", { name: /Añadir filtro|Add filter/i }).click();
      await sleep(600);
    }
    // Each filter row has a field button — pick the last incomplete one
    const fieldBtns = dialog.locator("button").filter({ hasText: /Tipo de origen|Pregunta|Valor|Nombre|Fuente|Sentimiento/i });
    const fieldBtn = fieldBtns.nth(i);
    await fieldBtn.click();
    await sleep(300);
    await page.getByRole("option", { name: new RegExp(`^${field.replace(/[()]/g, "\\$&")}$`) }).click();
    await sleep(700);

    // value picker - last listbox button in this filter area
    const listboxes = dialog.locator('button[aria-haspopup="listbox"]');
    await listboxes.nth(i).click();
    await sleep(400);
    await page.locator('input[type="search"]').last().fill(value);
    await sleep(1000);
    const items = page.locator("[cmdk-item]");
    let clicked = false;
    for (let j = 0; j < (await items.count()); j++) {
      const line = (await items.nth(j).innerText()).split("\n")[0].trim();
      if (line === value) {
        await items.nth(j).click();
        clicked = true;
        console.log(`  filter[${i}] ${field}=${line}`);
        break;
      }
    }
    if (!clicked && (await items.count())) {
      const line = (await items.first().innerText()).split("\n")[0].trim();
      await items.first().click();
      console.log(`  filter[${i}] ${field}~${line}`);
    }
    await dismiss(dialog);
    await sleep(400);
  }

  await sleep(2500);
  const rows = await readDataRows(dialog);
  await page.keyboard.press("Escape");
  await sleep(400);
  return rows;
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(40000);
  await login(page);

  const probes = [
    {
      name: "Red corta",
      dim: "Valor (Texto)",
      filters: [{ field: "Pregunta", value: "Red de viaje" }],
    },
    {
      name: "Red larga",
      dim: "Valor (Texto)",
      filters: [{ field: "Pregunta", value: "Red de viaje (Cabotaje/Regional/Internacional)" }],
    },
    {
      name: "Fuentes",
      dim: "Nombre de origen",
      filters: [],
    },
    {
      name: "Destino only",
      dim: "Valor (Texto)",
      filters: [{ field: "Pregunta", value: "Destino" }],
    },
    {
      name: "Cabotaje reverse",
      dim: "Pregunta",
      filters: [{ field: "Valor (Texto)", value: "Cabotaje" }],
    },
    {
      name: "EZE reverse",
      dim: "Pregunta",
      filters: [{ field: "Valor (Texto)", value: "EZE" }],
    },
    {
      name: "Parcial reverse",
      dim: "Pregunta",
      filters: [{ field: "Valor (Texto)", value: "Parcial" }],
    },
  ];

  for (const p of probes) {
    console.log(`\n=== ${p.name} ===`);
    try {
      // special case no filters
      if (p.filters.length === 0) {
        await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
        await sleep(1200);
        await hideMobile(page);
        await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
        await sleep(1400);
        const dialog = page.locator('[role="dialog"]').last();
        await dialog.getByRole("button", { name: "Gráfico de barras" }).click();
        await sleep(400);
        let combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
        await combo.click();
        await combo.pressSequentially("Respuestas", { delay: 10 });
        await sleep(300);
        await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
        await sleep(300);
        await dismiss(dialog);
        await dialog.getByRole("switch").nth(0).click();
        await sleep(600);
        combo = dialog.locator('[role="combobox"][placeholder*="dimensi" i]');
        await combo.click();
        await combo.pressSequentially(p.dim, { delay: 10 });
        await sleep(300);
        await page.locator("[cmdk-item]").filter({ hasText: p.dim }).first().click();
        await sleep(2500);
        for (const r of await readDataRows(dialog)) console.log(r);
        await page.keyboard.press("Escape");
        await sleep(400);
        continue;
      }
      const rows = await buildChart(page, p);
      for (const r of rows) console.log(r);
    } catch (e) {
      console.error("FAIL", e.message.split("\n")[0]);
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(500);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
