/**
 * Restore Destino/Origen to fieldId-only filters (categorical is empty for those ids).
 * Keep Ruta as fieldId=flight_number (+ optionally fieldType=text).
 * Re-verify Red/Cabina/Categoria still good.
 */
import { chromium } from "playwright";

const BASE = "http://vps-6119855-x.dattaweb.com:3000";
const WORKSPACE = "cmqzlt2ib000301mqf7hgk228";
const DIR = "cmrtn8ksu000k01pcdeh70mk8";
const EMAIL = "rgarro@deltree.com.ar";
const PASSWORD = "Password1";
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

const CHARTS = [
  {
    name: "Jerarquía - Aeropuerto Destino",
    type: "bar",
    dash: "4.13",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["destination"] }],
    },
  },
  {
    name: "Jerarquía - Aeropuerto Origen",
    type: "bar",
    dash: "4.13",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["origin"] }],
    },
  },
  {
    name: "Jerarquía - Ruta (Número de vuelo)",
    type: "bar",
    dash: "4.13",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["flight_number"] },
        { member: "FeedbackRecords.fieldType", operator: "equals", values: ["text"] },
      ],
    },
  },
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
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await sleep(3500);
}

async function hideMobile(page) {
  await page.evaluate(() => {
    document.querySelectorAll(".fixed.inset-0.z-9999").forEach((e) => e.remove());
  });
}

async function deleteChart(page, name) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await hideMobile(page);
  const row = page
    .locator("div.grid")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  if (!(await row.count())) return;
  await row.getByRole("button", { name: /Abrir opciones/i }).click();
  await sleep(300);
  await page.getByRole("menuitem", { name: /Eliminar|Delete|Borrar/i }).click();
  await sleep(400);
  await page.getByRole("button", { name: /Eliminar|Delete|Confirmar/i }).last().click();
  await sleep(1200);
}

async function verify(page, name) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await hideMobile(page);
  const row = page
    .locator("div.grid")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  if (!(await row.count())) {
    console.log("  MISSING");
    return;
  }
  await row.getByRole("button", { name: /Abrir opciones/i }).click();
  await sleep(300);
  await page.getByRole("menuitem", { name: /Editar|Edit/i }).click();
  await sleep(3000);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  const ui = (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 280);
  await dialog.getByText("Datos", { exact: true }).click().catch(() => {});
  await sleep(1800);
  const rows = await dialog.evaluate(() => {
    const table = document.querySelector('[role="dialog"] table');
    if (!table) return [];
    return [...table.querySelectorAll("tr")]
      .slice(0, 10)
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
  });
  console.log("  UI:", ui);
  console.log("  DATA:\n   ", rows.join("\n    "));
  await page.keyboard.press("Escape");
  await sleep(350);
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await login(page);

  let createAction = null;
  let createUrl = `${BASE}/workspaces/${WORKSPACE}/charts`;
  page.on("request", (req) => {
    const body = req.postData() || "";
    if (req.method() === "POST" && body.includes("chartInput") && req.headers()["next-action"]) {
      createAction = req.headers()["next-action"];
      createUrl = req.url();
    }
  });

  // probe create
  await page.goto(createUrl, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await hideMobile(page);
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1400);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Número grande" }).click();
  await sleep(350);
  const combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
  await combo.click();
  await combo.pressSequentially("Respuestas", { delay: 8 });
  await sleep(250);
  await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
  await sleep(250);
  await dialog.getByRole("heading", { name: /Medidas/i }).click().catch(() => {});
  const probe = `__probe_${Date.now()}`;
  await dialog.getByPlaceholder("Nombre del gráfico").fill(probe);
  await sleep(3500);
  const saveBtn = dialog.getByRole("button", { name: /Guardar gráfico/i });
  for (let i = 0; i < 30; i++) {
    if (await saveBtn.isEnabled()) break;
    await sleep(300);
  }
  await saveBtn.click();
  await sleep(2500);
  for (let i = 0; i < 20 && !createAction; i++) await sleep(200);
  if (!createAction) throw new Error("no create action");
  await deleteChart(page, probe);
  console.log("createAction", createAction);

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  for (const cfg of CHARTS) {
    console.log("\nRecreate", cfg.name);
    await deleteChart(page, cfg.name);
    const res = await page.request.post(createUrl, {
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "next-action": createAction,
        cookie: cookieHeader,
      },
      data: JSON.stringify([
        {
          workspaceId: WORKSPACE,
          chartInput: {
            name: cfg.name,
            type: cfg.type,
            query: cfg.query,
            config: {},
            feedbackDirectoryId: DIR,
          },
        },
      ]),
    });
    console.log("  status", res.status(), (await res.text()).includes(cfg.name));

    await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
    await sleep(1000);
    await hideMobile(page);
    const row = page
      .locator("div.grid")
      .filter({ hasText: cfg.name })
      .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
      .first();
    await row.getByRole("button", { name: /Abrir opciones/i }).click();
    await sleep(300);
    await page.getByRole("menuitem", { name: /Añadir al panel/i }).click();
    await sleep(800);
    const d = page.locator('[role="dialog"]').last();
    await d.locator("button[role='combobox'], #dashboard-select").first().click();
    await sleep(300);
    const opt = page.getByRole("option", { name: /4\.13/ }).first();
    if ((await opt.getAttribute("aria-disabled")) !== "true") {
      await opt.click();
      await sleep(200);
      await d.getByRole("button", { name: /Añadir|Agregar/i }).last().click();
      await sleep(1500);
      console.log("  linked");
    } else {
      console.log("  already linked");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    }
  }

  const verifyList = [
    "Jerarquía - Aeropuerto Destino",
    "Jerarquía - Aeropuerto Origen",
    "Jerarquía - Ruta (Número de vuelo)",
    "Jerarquía - Red (Cabotaje / Regional / Internacional)",
    "Jerarquía - Cabina",
    "Jerarquía - Categoría AR Plus",
    "Filtro - Red de viaje (Cabotaje/Regional/Internacional)",
    "Jerarquía - por Fuente de feedback",
  ];
  for (const name of verifyList) {
    console.log("\nVERIFY", name);
    await verify(page, name);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
