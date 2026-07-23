/**
 * Inspect existing Cabina chart config and try switch click without force.
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
    let style = document.getElementById("force-hide-mobile");
    if (!style) {
      style = document.createElement("style");
      style.id = "force-hide-mobile";
      style.textContent = ".fixed.inset-0.z-9999{display:none!important}";
      document.head.appendChild(style);
    }
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await login(page);
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  await hideMobile(page);

  const body = await page.locator("body").innerText();
  const names = [
    "Jerarquía - Cabina",
    "Jerarquía - Categoría AR Plus",
    "Jerarquía - por Fuente de feedback",
    "Jerarquía - Aeropuerto Destino",
    "Jerarquía - Aeropuerto Origen",
    "Jerarquía - Ruta",
    "Jerarquía - Red",
    "Filtro - Red",
  ];
  for (const n of names) {
    console.log(n, body.includes(n.split(" - ")[1]) || body.includes(n) ? "FOUND-ish" : "missing");
    console.log("  exact:", body.includes(n));
  }

  // Open Cabina edit and dump filter/dimension config from dialog text
  const row = page
    .locator("div.grid")
    .filter({ hasText: "Jerarquía - Cabina" })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  if (await row.count()) {
    await row.getByRole("button", { name: /Abrir opciones/i }).click();
    await sleep(400);
    await page.getByRole("menuitem", { name: /Editar|Edit/i }).click();
    await sleep(2500);
    await hideMobile(page);
    const dialog = page.locator('[role="dialog"]').last();
    const text = await dialog.innerText();
    console.log("\n=== CABINA DIALOG ===\n");
    console.log(text.slice(0, 2000));
    await page.keyboard.press("Escape");
    await sleep(500);
  } else {
    console.log("Cabina row not found");
  }

  // Fresh create: click switch via role without force, after clicking heading first
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1500);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Gráfico de barras" }).click();
  await sleep(400);
  let combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
  await combo.click();
  await combo.pressSequentially("Respuestas", { delay: 15 });
  await sleep(400);
  await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
  await sleep(600);
  // click outside into measures heading to close popover naturally
  await dialog.getByRole("heading", { name: /Medidas|Measures/i }).click();
  await sleep(400);

  const dialogStill = await page.locator('[role="dialog"]').count();
  console.log("dialogs after measure:", dialogStill);

  const sw = dialog.getByRole("switch").first();
  console.log("switch aria before", await sw.getAttribute("aria-checked"));
  await sw.click();
  await sleep(800);
  console.log("switch aria after", await sw.getAttribute("aria-checked"));
  console.log(
    "dim combo",
    await dialog.locator('[role="combobox"][placeholder*="dimensi" i]').count()
  );
  console.log("dialogs after switch:", await page.locator('[role="dialog"]').count());

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
