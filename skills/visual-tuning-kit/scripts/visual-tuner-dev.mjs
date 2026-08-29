import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

const readBody = (request) => new Promise((resolve, reject) => {
  let data = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    data += chunk;
    if (data.length > 262144) reject(new Error("Payload too large"));
  });
  request.on("end", () => resolve(data));
  request.on("error", reject);
});

const allControls = (schema) => schema.groups.flatMap((group) => group.controls);

const isInside = (parent, candidate) => {
  const relative = path.relative(parent, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const hydrateImageControls = async (schema, cwd) => {
  const publicRoot = path.resolve(cwd, "public");
  const hydrated = structuredClone(schema);
  for (const control of allControls(hydrated)) {
    if (control.kind !== "image") continue;
    const folder = path.resolve(cwd, control.target?.asset_folder || "");
    if (!isInside(publicRoot, folder)) throw new Error(`Unsafe asset folder: ${control.id}`);
    const names = (await readdir(folder, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    const publicBase = String(control.target?.public_base || "").replace(/\/$/, "");
    control.asset_options = names.map((name) => ({ value: `${publicBase}/${name}`, label: name, src: `${publicBase}/${name}` }));
  }
  return hydrated;
};

const validNavigationHref = (control, href) => {
  if (typeof href !== "string" || href.length < 1 || href.length > 500) return false;
  if (control.allow_hash !== false && /^#[A-Za-z][A-Za-z0-9:._-]*$/.test(href)) return true;
  if (control.allow_relative !== false && /^\/(?!\/)[^\s]*$/.test(href)) return true;
  try {
    const url = new URL(href);
    return ["http:", "https:"].includes(url.protocol)
      && (control.allowed_hosts || []).some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

export const validNavigation = (control, value) => {
  if (!Array.isArray(value) || value.length < (control.min_items || 1) || value.length > (control.max_items || 12)) return false;
  const ids = new Set();
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "") || ids.has(item.id)) return false;
    ids.add(item.id);
    return typeof item.label === "string"
      && item.label.trim().length > 0
      && item.label.length <= (control.max_length || 60)
      && validNavigationHref(control, item.href)
      && ["_self", "_blank"].includes(item.target)
      && typeof item.visible === "boolean";
  });
};

const valid = (control, value) => {
  if (control.kind === "range") return typeof value === "number" && Number.isFinite(value) && value >= control.min && value <= control.max;
  if (control.kind === "select") return typeof value === "string" && control.options.some((option) => option.value === value);
  if (control.kind === "boolean") return typeof value === "boolean";
  if (control.kind === "text") return typeof value === "string" && value.length <= control.max_length;
  if (control.kind === "text-lines") return Array.isArray(value) && value.length > 0 && value.every((line) => typeof line === "string") && value.join("\n").length <= control.max_length;
  if (control.kind === "image") return typeof value === "string" && control.asset_options?.some((option) => option.value === value);
  if (control.kind === "section-order") {
    const allowed = control.options.map((option) => option.value);
    return Array.isArray(value) && value.length === allowed.length && new Set(value).size === allowed.length && value.every((item) => allowed.includes(item));
  }
  if (control.kind === "navigation") return validNavigation(control, value);
  return false;
};

export default function visualTunerDev(options = {}) {
  const cwd = options.root || process.cwd();
  const schemaPath = path.resolve(cwd, options.schema || "src/tuning/tuning.schema.json");
  const valuesPath = path.resolve(cwd, options.values || "src/tuning/tuning.values.json");
  const changesPath = path.resolve(cwd, options.changes || "src/tuning/TUNING_CHANGESET.json");
  const localClient = path.resolve(here, "visual-tuner-client.js");
  const bundledClient = path.resolve(here, "../assets/visual-tuner-client.js");
  let clientPath = options.client ? path.resolve(cwd, options.client) : localClient;
  const prefix = options.prefix || "/__visual-tuner";
  const matches = (pathname, suffix) => pathname === suffix || pathname === `${prefix}${suffix}`;

  return {
    name: "visual-tuning-kit",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(prefix, async (request, response, next) => {
        const url = new URL(request.url, "http://localhost");
        response.setHeader("Cache-Control", "no-store");
        try {
          if (request.method === "GET" && matches(url.pathname, "/client.js")) {
            if (!options.client) {
              try { await access(clientPath); } catch { clientPath = bundledClient; }
            }
            response.setHeader("Content-Type", "text/javascript; charset=utf-8");
            return response.end(await readFile(clientPath, "utf8"));
          }

          const rawSchema = JSON.parse(await readFile(schemaPath, "utf8"));
          const schema = await hydrateImageControls(rawSchema, cwd);
          const approved = JSON.parse(await readFile(valuesPath, "utf8"));

          if (request.method === "GET" && matches(url.pathname, "/config")) {
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            return response.end(JSON.stringify({ schema, approved }));
          }

          if (request.method === "POST" && matches(url.pathname, "/save")) {
            const payload = JSON.parse(await readBody(request));
            if (payload.schema !== schema.id || !payload.values) throw new Error("Invalid schema or values");
            const byId = new Map(allControls(schema).map((control) => [control.id, control]));
            const sanitized = {};
            for (const [id, value] of Object.entries(payload.values)) {
              const control = byId.get(id);
              if (!control || !valid(control, value)) throw new Error(`Invalid value: ${id}`);
              sanitized[id] = value;
            }
            for (const control of byId.values()) {
              if (!(control.id in sanitized)) throw new Error(`Missing value: ${control.id}`);
            }
            const before = approved.values || {};
            const changed = Object.fromEntries(Object.entries(sanitized).filter(([id, value]) => JSON.stringify(before[id]) !== JSON.stringify(value)));
            const output = { version: schema.version, schema: schema.id, status: "draft", values: sanitized, approved_by: null, approved_at: null };
            await writeFile(valuesPath, `${JSON.stringify(output, null, 2)}\n`);
            await writeFile(changesPath, `${JSON.stringify({ version: "0.2", schema: schema.id, generated_at: new Date().toISOString(), changed }, null, 2)}\n`);
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            return response.end(JSON.stringify({ ok: true, changed: Object.keys(changed).length }));
          }

          return next();
        } catch (error) {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Invalid request" }));
        }
      });
    },
  };
}
