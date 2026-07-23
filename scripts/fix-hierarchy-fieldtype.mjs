/**
 * Add fieldType=categorical to Destino/Origen/Ruta charts to drop open-text pollution.
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

const UPDATES = [
  {
    name: "Jerarquía - Aeropuerto Destino",
    type: "bar",
    fieldId: "destination",
    tryTypes: ["categorical", "text"],
  },
  {
    name: "Jerarquía - Aeropuerto Origen",
    type: "bar",
    fieldId: "origin",
    tryTypes: ["categorical", "text"],
  },
  {
    name: "Jerarquía - Ruta (Número de vuelo)",
    type: "bar",
    fieldId: "flight_number",
    tryTypes: ["text", "categorical"],
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

async function captureActions(page) {
  let createHdr = null;
  let updateHdr = null;
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const body = req.postData() || "";
    const headers = req.headers();
    if (!headers["next-action"]) return;
    if (body.includes("chartInput") && body.includes("feedbackDirectoryId")) {
      createHdr = { url: req.url(), action: headers["next-action"], body };
    }
    if (body.includes("chartUpdateInput") || body.includes("chartId")) {
      updateHdr = { url: req.url(), action: headers["next-action"], body };
    }
  });

  // Trigger a create to get create action id (reuse from prior if needed)
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  await hideMobile(page);

  // Open Destino edit and save to capture update action
  const row = page
    .locator("div.grid")
    .filter({ hasText: "Jerarquía - Aeropuerto Destino" })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  await row.getByRole("button", { name: /Abrir opciones/i }).click();
  await sleep(350);
  await page.getByRole("menuitem", { name: /Editar|Edit/i }).click();
  await sleep(3000);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  // Touch name to enable dirty save
  const nameInput = dialog.getByPlaceholder("Nombre del gráfico");
  const cur = await nameInput.inputValue();
  await nameInput.fill(cur + " ");
  await nameInput.fill(cur);
  await sleep(2000);
  const saveBtn = dialog.getByRole("button", { name: /Guardar gráfico/i });
  if (await saveBtn.isEnabled()) {
    await saveBtn.click();
    await sleep(2500);
  } else {
    await page.keyboard.press("Escape");
    await sleep(400);
  }

  return { createHdr, updateHdr };
}

function scoreRows(rows, kind) {
  const values = rows.slice(1).map((r) => r.split(" | ")[0]);
  const junk = /Parcial|Completo|experiencia|demoras|Excelente|recomend|Hubo |Falto |Cumplio|Muy buena|Todo bien|No disponible/i;
  const airport = /^[A-Z]{3}$/;
  const flight = /^AR?\d+/i;
  let good = 0;
  let bad = 0;
  for (const v of values) {
    if (!v || v === "Valor (Texto)") continue;
    if (junk.test(v)) bad++;
    else if (kind === "airport" && airport.test(v)) good++;
    else if (kind === "flight" && (flight.test(v) || /^[A-Z]{2}\d+/.test(v))) good++;
    else if (kind === "airport" || kind === "flight") bad++;
    else good++;
  }
  return { good, bad, values: values.slice(0, 8) };
}

async function verifyViaEdit(page, name) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  await hideMobile(page);
  const row = page
    .locator("div.grid")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  await row.getByRole("button", { name: /Abrir opciones/i }).click();
  await sleep(350);
  await page.getByRole("menuitem", { name: /Editar|Edit/i }).click();
  await sleep(3500);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByText("Datos", { exact: true }).click().catch(() => {});
  await sleep(2000);
  const rows = await dialog.evaluate(() => {
    const table = document.querySelector('[role="dialog"] table');
    if (!table) return [];
    return [...table.querySelectorAll("tr")]
      .slice(0, 12)
      .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
  });
  await page.keyboard.press("Escape");
  await sleep(400);
  return rows;
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await login(page);

  const { updateHdr, createHdr } = await captureActions(page);
  console.log("update action", updateHdr?.action, "create", createHdr?.action);

  // Prefer recreate via create action (we know it works)
  let createAction = createHdr?.action;
  if (!createAction) {
    // Fallback hardcode from previous run may change on deploy; capture via probe
    console.log("Need create action - quick probe");
  }

  // Recreate each chart with best fieldType using create+delete, probing via temporary names
  // Use previous create action from network if we do a mini probe

  // Mini probe create
  let capturedCreate = createHdr;
  if (!capturedCreate) {
    page.on("request", (req) => {
      const body = req.postData() || "";
      if (req.method() === "POST" && body.includes("chartInput") && req.headers()["next-action"]) {
        capturedCreate = { url: req.url(), action: req.headers()["next-action"], body };
      }
    });
  }

  // Use execute by recreate: delete + create with dual filter, then verify
  // First ensure we have create action id from last successful script - re-probe quickly
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await hideMobile(page);
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1400);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Número grande" }).click();
  await sleep(350);
  let combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
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

  // find captured
  for (let i = 0; i < 15 && !capturedCreate; i++) await sleep(200);
  if (!capturedCreate) {
    console.error("no create capture");
    process.exit(1);
  }
  console.log("create action", capturedCreate.action);

  // delete probe
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  const prow = page
    .locator("div.grid")
    .filter({ hasText: probe })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  if (await prow.count()) {
    await prow.getByRole("button", { name: /Abrir opciones/i }).click();
    await sleep(300);
    await page.getByRole("menuitem", { name: /Eliminar|Delete|Borrar/i }).click();
    await sleep(400);
    await page.getByRole("button", { name: /Eliminar|Delete|Confirmar/i }).last().click();
    await sleep(1200);
  }

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  async function apiCreate(name, type, query) {
    const body = JSON.stringify([
      {
        workspaceId: WORKSPACE,
        chartInput: {
          name,
          type,
          query,
          config: {},
          feedbackDirectoryId: DIR,
        },
      },
    ]);
    const res = await page.request.post(capturedCreate.url || `${BASE}/workspaces/${WORKSPACE}/charts`, {
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "next-action": capturedCreate.action,
        cookie: cookieHeader,
      },
      data: body,
    });
    const text = await res.text();
    const ok = res.status() === 200 && text.includes(name);
    return { ok, text: text.slice(0, 200) };
  }

  async function apiDeleteByUi(name) {
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

  for (const cfg of UPDATES) {
    console.log("\n==>", cfg.name);
    let best = null;
    for (const ft of cfg.tryTypes) {
      const tmpName = `__tmp_${cfg.fieldId}_${ft}`;
      const query = {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.valueText"],
        filters: [
          { member: "FeedbackRecords.fieldId", operator: "equals", values: [cfg.fieldId] },
          { member: "FeedbackRecords.fieldType", operator: "equals", values: [ft] },
        ],
      };
      await apiDeleteByUi(tmpName);
      const created = await apiCreate(tmpName, "bar", query);
      console.log("  try", ft, created.ok, created.text.slice(0, 80));
      if (!created.ok) continue;
      const rows = await verifyViaEdit(page, tmpName);
      const kind = cfg.name.includes("Ruta") ? "flight" : "airport";
      const score = scoreRows(rows, kind);
      console.log("  score", score);
      await apiDeleteByUi(tmpName);
      if (!best || score.good - score.bad > best.score.good - best.score.bad) {
        best = { ft, query, score };
      }
    }

    if (!best) {
      console.log("  no best, skip");
      continue;
    }
    console.log("  chosen fieldType", best.ft, best.score);
    await apiDeleteByUi(cfg.name);
    const r = await apiCreate(cfg.name, cfg.type, best.query);
    console.log("  recreated", r.ok);

    // re-link 4.13
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

    const finalRows = await verifyViaEdit(page, cfg.name);
    console.log("  final:\n", finalRows.join("\n"));
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
