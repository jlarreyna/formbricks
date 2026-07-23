/**
 * Recreate hierarchy charts via Next.js server action HTTP calls (reliable).
 * 1) Capture createChartAction request format from one UI save
 * 2) POST remaining charts with correct Cube queries (fieldId filters)
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
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["flight_number"] }],
    },
  },
  {
    name: "Jerarquía - Red (Cabotaje / Regional / Internacional)",
    type: "pie",
    dash: "4.13",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["travel_network"] },
      ],
    },
  },
  {
    name: "Filtro - Red de viaje (Cabotaje/Regional/Internacional)",
    type: "bar",
    dash: "4.12",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["travel_network"] },
      ],
    },
  },
  {
    name: "Jerarquía - Cabina",
    type: "bar",
    dash: "4.13",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [{ member: "FeedbackRecords.fieldId", operator: "equals", values: ["cabin"] }],
    },
  },
  {
    name: "Jerarquía - Categoría AR Plus",
    type: "bar",
    dash: "4.13",
    query: {
      measures: ["FeedbackRecords.count"],
      dimensions: ["FeedbackRecords.valueText"],
      filters: [
        { member: "FeedbackRecords.fieldId", operator: "equals", values: ["ar_plus_category"] },
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

async function dismiss(dialog) {
  await dialog.getByRole("heading", { name: /Medidas/i }).click().catch(() => {});
  await sleep(200);
}

/** Create a throwaway chart via UI and capture the next-action request. */
async function captureCreateAction(page) {
  let captured = null;
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    const body = req.postData() || "";
    if (body.includes("createChartAction") || body.includes('"chartInput"') || body.includes("feedbackDirectoryId")) {
      const headers = req.headers();
      if (headers["next-action"] || body.includes("chartInput") || body.includes('"name"')) {
        captured = {
          url: req.url(),
          headers: {
            "content-type": headers["content-type"],
            "next-action": headers["next-action"],
            "next-router-state-tree": headers["next-router-state-tree"],
            cookie: headers["cookie"],
          },
          body,
        };
      }
    }
  });

  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await hideMobile(page);
  await page.getByRole("button", { name: /Crear gráfico/i }).first().click();
  await sleep(1500);
  await hideMobile(page);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.getByRole("button", { name: "Número grande" }).click();
  await sleep(400);

  const combo = dialog.locator('[role="combobox"][placeholder*="medida" i]');
  await combo.click();
  await combo.pressSequentially("Respuestas", { delay: 10 });
  await sleep(300);
  await page.locator("[cmdk-item]").filter({ hasText: /^Respuestas/ }).first().click();
  await sleep(300);
  await dismiss(dialog);

  const probeName = `__probe_create_${Date.now()}`;
  await dialog.getByPlaceholder("Nombre del gráfico").fill(probeName);
  await sleep(4000);
  const saveBtn = dialog.getByRole("button", { name: /Guardar gráfico/i });
  for (let i = 0; i < 40; i++) {
    if (await saveBtn.isEnabled()) break;
    await sleep(400);
  }
  await saveBtn.click();
  await sleep(3000);

  // wait for capture
  for (let i = 0; i < 20 && !captured; i++) await sleep(200);
  return { captured, probeName };
}

async function deleteChartByName(page, name) {
  await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
  await sleep(1200);
  await hideMobile(page);
  const row = page
    .locator("div.grid")
    .filter({ hasText: name })
    .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
    .first();
  if (!(await row.count())) return;
  await row.getByRole("button", { name: /Abrir opciones/i }).click();
  await sleep(350);
  await page.getByRole("menuitem", { name: /Eliminar|Delete|Borrar/i }).click();
  await sleep(500);
  const confirm = page.getByRole("button", { name: /Eliminar|Delete|Confirmar/i }).last();
  if (await confirm.count()) {
    await confirm.click();
    await sleep(1500);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(UUID_POLYFILL);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  await login(page);

  console.log("Capturing createChartAction...");
  const { captured, probeName } = await captureCreateAction(page);
  if (!captured) {
    console.error("Failed to capture create action");
    await browser.close();
    process.exit(1);
  }
  console.log("captured url", captured.url);
  console.log("next-action", captured.headers["next-action"]);
  console.log("body sample", captured.body.slice(0, 400));

  // Delete probe chart
  await deleteChartByName(page, probeName);

  // Parse body - next-safe-action typically sends JSON array
  let templateArgs;
  try {
    templateArgs = JSON.parse(captured.body);
  } catch {
    console.error("non-JSON body", captured.body.slice(0, 200));
    await browser.close();
    process.exit(1);
  }
  console.log("template args keys", Object.keys(templateArgs[0] || templateArgs));

  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  for (const cfg of CHARTS) {
    console.log("\nCreating", cfg.name);
    // Check if exists
    await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
    await sleep(1000);
    if ((await page.locator("body").innerText()).includes(cfg.name)) {
      console.log("  exists, deleting first");
      await deleteChartByName(page, cfg.name);
    }

    const payload = [
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
    ];

    // Prefer reusing exact shape from template if nested differently
    let body = JSON.stringify(payload);
    if (Array.isArray(templateArgs) && templateArgs[0]?.chartInput) {
      body = JSON.stringify([
        {
          ...templateArgs[0],
          workspaceId: WORKSPACE,
          chartInput: {
            ...templateArgs[0].chartInput,
            name: cfg.name,
            type: cfg.type,
            query: cfg.query,
            config: {},
            feedbackDirectoryId: DIR,
          },
        },
      ]);
    }

    const res = await page.request.post(captured.url, {
      headers: {
        "content-type": captured.headers["content-type"] || "text/plain;charset=UTF-8",
        "next-action": captured.headers["next-action"],
        ...(captured.headers["next-router-state-tree"]
          ? { "next-router-state-tree": captured.headers["next-router-state-tree"] }
          : {}),
        cookie: cookieHeader,
      },
      data: body,
    });
    const text = await res.text();
    console.log("  status", res.status(), text.slice(0, 300).replace(/\s+/g, " "));
  }

  // Link to dashboards via UI
  for (const cfg of CHARTS) {
    console.log("\nLink", cfg.name, "->", cfg.dash);
    try {
      await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
      await sleep(1200);
      await hideMobile(page);
      const row = page
        .locator("div.grid")
        .filter({ hasText: cfg.name })
        .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
        .first();
      if (!(await row.count())) {
        console.log("  missing");
        continue;
      }
      await row.getByRole("button", { name: /Abrir opciones/i }).click();
      await sleep(350);
      await page.getByRole("menuitem", { name: /Añadir al panel/i }).click();
      await sleep(900);
      await hideMobile(page);
      const dialog = page.locator('[role="dialog"]').last();
      await dialog.locator("button[role='combobox'], #dashboard-select").first().click();
      await sleep(350);
      const opt = page.getByRole("option", { name: new RegExp(cfg.dash) }).first();
      if ((await opt.getAttribute("aria-disabled")) === "true") {
        console.log("  already linked");
        await page.keyboard.press("Escape");
        await sleep(200);
        await page.keyboard.press("Escape");
        continue;
      }
      await opt.click();
      await sleep(250);
      await dialog.getByRole("button", { name: /Añadir|Agregar/i }).last().click();
      await sleep(1800);
      console.log("  linked");
    } catch (e) {
      console.error("  link fail", e.message.split("\n")[0]);
    }
  }

  // Verify Destino + Red data
  for (const name of ["Jerarquía - Aeropuerto Destino", "Jerarquía - Red (Cabotaje / Regional / Internacional)", "Jerarquía - Cabina"]) {
    console.log("\nVerify", name);
    await page.goto(`${BASE}/workspaces/${WORKSPACE}/charts`, { waitUntil: "domcontentloaded" });
    await sleep(1200);
    await hideMobile(page);
    const row = page
      .locator("div.grid")
      .filter({ hasText: name })
      .filter({ has: page.getByRole("button", { name: /Abrir opciones/i }) })
      .first();
    if (!(await row.count())) {
      console.log("  missing");
      continue;
    }
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
        .slice(0, 10)
        .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent?.trim()).join(" | "));
    });
    console.log(rows.join("\n"));
    await page.keyboard.press("Escape");
    await sleep(400);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
