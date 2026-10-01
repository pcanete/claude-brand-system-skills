#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const excluded = new Set([".git", "node_modules"]);
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(target));
    else files.push(target);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function runNode(label, args, { expect = "pass", cwd = root } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe"
  });

  const passed = result.status === 0;

  if (expect === "pass" && !passed) {
    fail(`${label}\n${result.stdout || ""}${result.stderr || ""}`);
    return;
  }

  if (expect === "fail" && passed) {
    fail(`${label}\n${result.stdout || ""}`);
    return;
  }

  if (expect === "pass" && result.stdout.trim()) {
    console.log(result.stdout.trim());
  }
}

const files = walk(root);

for (const file of files.filter((item) => item.endsWith(".json"))) {
  try {
    JSON.parse(read(file));
  } catch (error) {
    fail(`Invalid JSON: ${relative(file)}: ${error.message}`);
  }
}

for (const file of files.filter((item) => item.endsWith(".mjs"))) {
  runNode(`Invalid JavaScript: ${relative(file)}`, ["--check", file]);
}

const skillNames = [
  "brand-dna-scanner",
  "brand-manual-builder",
  "reference-scanner",
  "reference-lab-builder",
  "reference-to-astro",
  "visual-tuning-kit",
  "wordpress-publisher"
];

const declaredVersions = new Map();

for (const name of skillNames) {
  const skillRoot = path.join(root, "skills", name);
  const skillFile = path.join(skillRoot, "SKILL.md");
  const agentFile = path.join(skillRoot, "agents", "openai.yaml");

  if (!fs.existsSync(skillFile)) {
    fail(`Missing skills/${name}/SKILL.md`);
    continue;
  }

  if (!fs.existsSync(agentFile)) fail(`Missing skills/${name}/agents/openai.yaml`);

  const markdown = read(skillFile);
  const frontmatter = markdown.match(/^---[\s\S]*?^---/m)?.[0] || "";
  const declared = frontmatter.match(/^name:\s*([^\r\n]+)/m)?.[1]?.trim();

  if (declared !== name) {
    fail(`Skill name mismatch: directory ${name}, frontmatter ${declared || "missing"}`);
  }

  const description = frontmatter.match(/^description:\s*([^\r\n]+)/m)?.[1]?.trim();

  if (!description) {
    fail(`skills/${name}/SKILL.md has no description`);
  } else if (description.length > 1024) {
    fail(`skills/${name}/SKILL.md description exceeds 1024 characters`);
  }

  const version = frontmatter.match(/version:\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?/)?.[1];

  if (!version) {
    fail(`skills/${name}/SKILL.md declares no metadata.version`);
  } else {
    declaredVersions.set(name, version);
  }

  // Every companion file the skill ships must be reachable from its own
  // instructions, or it is dead weight the agent will never open.
  const bundled = ["references", "assets", "schemas", "scripts"];
  const prose = [
    markdown,
    ...(fs.existsSync(path.join(skillRoot, "references"))
      ? fs
          .readdirSync(path.join(skillRoot, "references"))
          .filter((entry) => entry.endsWith(".md"))
          .map((entry) => read(path.join(skillRoot, "references", entry)))
      : [])
  ].join("\n");

  for (const folder of bundled) {
    const directory = path.join(skillRoot, folder);
    if (!fs.existsSync(directory)) continue;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) continue;
      if (!prose.includes(entry.name)) {
        fail(
          `Unreferenced bundled file: skills/${name}/${folder}/${entry.name} ` +
            `is never mentioned by the skill`
        );
      }
    }
  }

  const linkPattern = /`((?:references|assets|schemas|scripts)\/[^`]+)`/g;

  for (const match of markdown.matchAll(linkPattern)) {
    const linked = path.join(skillRoot, ...match[1].split("/"));
    if (!fs.existsSync(linked)) {
      fail(`Broken local skill reference: skills/${name}/${match[1]}`);
    }
  }

  const packageFile = path.join(skillRoot, "package.json");

  if (fs.existsSync(packageFile) && version) {
    const pkg = JSON.parse(read(packageFile));
    if (pkg.version !== version) {
      fail(
        `Version drift: skills/${name}/SKILL.md says ${version}, package.json says ${pkg.version}`
      );
    }
  }
}

// Published version tables must agree with the skills themselves.
for (const document of ["README.md", "docs/versioning.md"]) {
  const file = path.join(root, document);
  if (!fs.existsSync(file)) continue;

  const rows = read(file)
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trimStart().startsWith("|") && /\d+\.\d+\.\d+/.test(line)
    );

  for (const [name, version] of declaredVersions) {
    for (const row of rows) {
      if (!row.includes(name)) continue;
      if (!row.includes(version)) {
        fail(`Version drift in ${document}: ${name} should read ${version}\n  ${row.trim()}`);
      }
    }
  }
}

// fs.cpSync aborta el proceso en algunos entornos Windows. Copiar a mano es
// menos elegante y funciona en todos.
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else fs.copyFileSync(source, target);
  }
}

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

// Duplicated on purpose so each skill installs alone. CI keeps the copies honest.
const duplicated = [
  ["schemas", "style-dna.schema.json"],
  ["schemas", "reference-evidence.schema.json"],
  ["scripts/lib", "web-contracts.mjs"],
  ["scripts/lib", "behavior-gates.mjs"]
];

for (const [folder, filename] of duplicated) {
  const scanner = path.join(root, "skills", "reference-scanner", folder, filename);
  const builder = path.join(root, "skills", "reference-to-astro", folder, filename);

  if (!fs.existsSync(scanner) || !fs.existsSync(builder)) {
    fail(`Missing shared web contract copy: ${folder}/${filename}`);
    continue;
  }

  if (digest(scanner) !== digest(builder)) {
    fail(`Shared web contract drift: ${folder}/${filename}`);
  }
}

// Public fixtures and examples must stay synthetic.
const publicFixtures = files.filter((file) => {
  const name = relative(file);
  return (
    name.startsWith("tests/") ||
    /^skills\/[^/]+\/(examples|assets)\//.test(name)
  );
});

const publicFixtureText = publicFixtures.map(read).join("\n");

if (/benchmark-/i.test(publicFixtureText)) {
  fail("Benchmark identifier leaked into public fixtures");
}

for (const match of publicFixtureText.matchAll(/https?:\/\/[^\s"'`)]+/gi)) {
  const url = match[0];
  const synthetic =
    // Namespaces XML: son identificadores, no direcciones que alguien visita.
    /^https?:\/\/www\.w3\.org\//i.test(url) ||
    /^https?:\/\/([a-z0-9-]+\.)*example\.invalid(\/|$)/i.test(url) ||
    /^http:\/\/localhost(:\d+)?(\/|$)/i.test(url) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?(\/|$)/i.test(url);

  if (!synthetic) {
    fail(`Non-synthetic URL leaked into public fixtures: ${url}`);
  }
}

const brandValidator = path.join(
  root,
  "skills",
  "brand-dna-scanner",
  "scripts",
  "validate-brand-dna.mjs"
);

const scannerValidator = path.join(
  root,
  "skills",
  "reference-scanner",
  "scripts",
  "validate-style-dna.mjs"
);

const scannerBehaviorTests = path.join(
  root,
  "skills",
  "reference-scanner",
  "scripts",
  "test-behavior-gates.mjs"
);

const builderValidator = path.join(
  root,
  "skills",
  "reference-to-astro",
  "scripts",
  "validate-inputs.mjs"
);

const manualValidator = path.join(
  root,
  "skills",
  "brand-manual-builder",
  "scripts",
  "validate-manual.mjs"
);

const manualBuilder = path.join(
  root,
  "skills",
  "brand-manual-builder",
  "scripts",
  "build-manual.mjs"
);

const labValidator = path.join(
  root,
  "skills",
  "reference-lab-builder",
  "scripts",
  "validate-lab.mjs"
);

const labBuilder = path.join(
  root,
  "skills",
  "reference-lab-builder",
  "scripts",
  "build-lab.mjs"
);

const approvedBlueprint = path.join(
  root,
  "skills",
  "reference-to-astro",
  "assets",
  "SITE_BLUEPRINT.example.json"
);

const brandExamples = [
  "--dna",
  path.join(root, "skills", "brand-dna-scanner", "examples", "BRAND_DNA.example.json"),
  "--evidence",
  path.join(root, "skills", "brand-dna-scanner", "examples", "BRAND_EVIDENCE.example.json")
];

const webFixtures = (directory) => [
  "--style",
  path.join(root, "tests", directory, "STYLE_DNA.json"),
  "--evidence",
  path.join(root, "tests", directory, "REFERENCE_EVIDENCE.json")
];

runNode("Brand DNA example rejected by its own validator", [
  brandValidator,
  ...brandExamples
]);

const manualExample = [
  "--dna",
  path.join(root, "skills", "brand-dna-scanner", "examples", "BRAND_DNA.example.json"),
  "--evidence",
  path.join(root, "skills", "brand-dna-scanner", "examples", "BRAND_EVIDENCE.example.json"),
  "--spec",
  path.join(root, "skills", "brand-manual-builder", "assets", "BRAND_MANUAL_SPEC.example.json")
];

// Cada contrato con aprobación se prueba en los dos sentidos: el borrador tiene
// que rechazarse cuando se lo presenta como aprobado, y tiene que pasar cuando
// se lo prepara. Probar un solo sentido deja pasar un validador que siempre
// dice que no.
runNode("Draft brand manual rejected in review mode", [
  manualValidator,
  ...manualExample
], { expect: "fail" });

runNode("Draft brand manual rejected in preparation mode", [
  manualValidator,
  ...manualExample,
  "--allow-draft"
]);

const manualBuildRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brand-manual-build-"));
runNode("Brand manual example failed to render", [
  manualBuilder,
  ...manualExample,
  "--out",
  manualBuildRoot
]);

if (!fs.existsSync(path.join(manualBuildRoot, "index.html"))) {
  fail("Brand manual builder produced no index.html");
}

if (!fs.existsSync(path.join(manualBuildRoot, "BRAND_MANUAL.json"))) {
  fail("Brand manual builder produced no BRAND_MANUAL.json");
}

fs.rmSync(manualBuildRoot, { recursive: true, force: true });

const labExample = [
  "--style",
  path.join(root, "tests", "reference-system", "STYLE_DNA.json"),
  "--evidence",
  path.join(root, "tests", "reference-system", "REFERENCE_EVIDENCE.json"),
  "--spec",
  path.join(root, "skills", "reference-lab-builder", "assets", "REFERENCE_LAB_SPEC.example.json")
];

runNode("Draft reference lab was accepted in approval mode", [
  labValidator,
  ...labExample
], { expect: "fail" });

runNode("Draft reference lab failed preparation validation", [
  labValidator,
  ...labExample,
  "--allow-draft"
]);

const labBuildRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reference-lab-build-"));
runNode("Reference lab example failed to render", [
  labBuilder,
  ...labExample,
  "--out",
  labBuildRoot
]);

if (!fs.existsSync(path.join(labBuildRoot, "index.html"))) {
  fail("Reference lab builder produced no index.html");
}

if (!fs.existsSync(path.join(labBuildRoot, "REFERENCE_LAB.json"))) {
  fail("Reference lab builder produced no REFERENCE_LAB.json");
}

fs.rmSync(labBuildRoot, { recursive: true, force: true });

runNode("Scan artifacts fixture rejected by reference-scanner", [
  scannerValidator,
  ...webFixtures("reference-system")
]);

runNode("Reference scanner behavior gate tests failed", [scannerBehaviorTests]);

runNode("Reference-system fixture rejected by reference-to-astro", [
  builderValidator,
  ...webFixtures("reference-system"),
  "--content",
  path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
  "--blueprint",
  approvedBlueprint
]);

// El borrador se fabrica degradando el ejemplo aprobado: así los dos fixtures
// no pueden diferir en nada más que el estado de aprobación.
const blueprintGateRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "site-blueprint-gate-")
);
const draftBlueprint = path.join(blueprintGateRoot, "SITE_BLUEPRINT.json");
const draftBlueprintDocument = JSON.parse(read(approvedBlueprint));
draftBlueprintDocument.approval = {
  status: "draft",
  approved_by: null,
  approved_at: null,
  notes: "Awaiting human review."
};
draftBlueprintDocument.checkpoints.find(
  (checkpoint) => checkpoint.id === "reference-lab"
).status = "pending";
fs.writeFileSync(
  draftBlueprint,
  `${JSON.stringify(draftBlueprintDocument, null, 2)}
`
);

const blueprintGateArgs = [
  builderValidator,
  ...webFixtures("reference-system"),
  "--content",
  path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
  "--blueprint",
  draftBlueprint
];

runNode(
  "Draft SITE_BLUEPRINT was accepted for construction",
  blueprintGateArgs,
  { expect: "fail" }
);

runNode("Draft SITE_BLUEPRINT cannot be validated as work in progress", [
  ...blueprintGateArgs,
  "--lenient"
]);

// Los campos de destino y de contenido en vivo son opcionales a proposito: un
// blueprint escrito antes de que existieran tiene que seguir validando, o se le
// rompe el trabajo a quien esta construyendo ahora mismo.
const sinCamposNuevos = path.join(blueprintGateRoot, "SITE_BLUEPRINT.sin-campos.json");
const documentoSinCampos = JSON.parse(read(approvedBlueprint));
delete documentoSinCampos.project.deployment;
for (const pagina of Object.values(documentoSinCampos.pages)) {
  for (const seccion of pagina.sections) delete seccion.runtime_content;
}
fs.writeFileSync(sinCamposNuevos, `${JSON.stringify(documentoSinCampos, null, 2)}
`);

runNode("A blueprint without the optional deployment fields was rejected", [
  builderValidator,
  ...webFixtures("reference-system"),
  "--content",
  path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
  "--blueprint",
  sinCamposNuevos
]);

// Pero declarar una region alimentada en vivo sin decir que tolera su forma es
// el hueco por el que entra "se rompio la web" cuando el cliente carga un
// titulo mas largo del previsto.
const sinTolerancia = path.join(blueprintGateRoot, "SITE_BLUEPRINT.sin-tolerancia.json");
const documentoSinTolerancia = JSON.parse(read(approvedBlueprint));
const primeraSeccion = Object.values(documentoSinTolerancia.pages)[0].sections[0];
if (!primeraSeccion.runtime_content) {
  fail("El ejemplo de SITE_BLUEPRINT ya no declara runtime_content: la prueba no comprueba nada");
}
delete primeraSeccion.runtime_content.tolerates;
fs.writeFileSync(sinTolerancia, `${JSON.stringify(documentoSinTolerancia, null, 2)}
`);

runNode(
  "A runtime-fed region was accepted without declaring what its shape tolerates",
  [
    builderValidator,
    ...webFixtures("reference-system"),
    "--content",
    path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
    "--blueprint",
    sinTolerancia
  ],
  { expect: "fail" }
);

// El objetivo de fidelidad gobierna la ceremonia y nada más. Un plan
// direccional construye con checkpoints pendientes; uno forense no construye
// sobre una conjetura. Las compuertas de invención son iguales en los tres.
const directionalBlueprint = path.join(blueprintGateRoot, "SITE_BLUEPRINT.directional.json");
const directionalDocument = JSON.parse(read(approvedBlueprint));
directionalDocument.project.fidelity_target = "directional";
directionalDocument.checkpoints.find(
  (checkpoint) => checkpoint.id === "reference-lab"
).status = "pending";
directionalDocument.decisions.push({
  id: "dec-open-on-purpose",
  topic: "Typeface",
  decision: "Still undecided while the site is used as a starting point.",
  rationale: "A directional build records the open question instead of pretending it is closed.",
  status: "open"
});
fs.writeFileSync(
  directionalBlueprint,
  `${JSON.stringify(directionalDocument, null, 2)}
`
);

runNode("A directional blueprint was blocked by ceremony it does not require", [
  builderValidator,
  ...webFixtures("reference-system"),
  "--content",
  path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
  "--blueprint",
  directionalBlueprint
]);

const forensicBlueprint = path.join(blueprintGateRoot, "SITE_BLUEPRINT.forensic.json");
const forensicDocument = JSON.parse(read(approvedBlueprint));
forensicDocument.project.fidelity_target = "forensic";
Object.values(forensicDocument.pages)[0].sections[0].reference_patterns[0].mode = "inferred";
fs.writeFileSync(forensicBlueprint, `${JSON.stringify(forensicDocument, null, 2)}
`);

runNode(
  "A forensic blueprint was allowed to build on an inferred pattern",
  [
    builderValidator,
    ...webFixtures("reference-system"),
    "--content",
    path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
    "--blueprint",
    forensicBlueprint
  ],
  { expect: "fail" }
);

fs.rmSync(blueprintGateRoot, { recursive: true, force: true });

// The gates are the product. These fixtures must fail, and must fail only
// because of the gates: in lenient mode they are well-formed.
const rejectedBrand = [
  "--dna",
  path.join(root, "tests", "rejected", "BRAND_DNA.json"),
  "--evidence",
  path.join(root, "tests", "rejected", "BRAND_EVIDENCE.json")
];

runNode(
  "Unsupported Brand DNA fixture was accepted: the brand gates are not working",
  [brandValidator, ...rejectedBrand],
  { expect: "fail" }
);

runNode("Rejected Brand DNA fixture is malformed beyond the gates", [
  brandValidator,
  ...rejectedBrand,
  "--lenient"
]);

runNode(
  "Unsupported STYLE_DNA fixture was accepted: the web gates are not working",
  [scannerValidator, ...webFixtures("rejected")],
  { expect: "fail" }
);

runNode("Rejected STYLE_DNA fixture is malformed beyond the gates", [
  scannerValidator,
  ...webFixtures("rejected"),
  "--lenient"
]);

// The evasive fixture makes no false statement and breaks no schema. Every
// claim in it is concrete, every self-reported score is modest, and no
// evidence exists anywhere. It passed every gate until the gates stopped
// reading the author own scores.
runNode(
  "Evasive STYLE_DNA fixture was accepted: the gates are reading self-reported scores again",
  [scannerValidator, ...webFixtures("rejected-evasive")],
  { expect: "fail" }
);

runNode("Evasive STYLE_DNA fixture is malformed beyond the gates", [
  scannerValidator,
  ...webFixtures("rejected-evasive"),
  "--lenient"
]);

const evasiveBrand = [
  "--dna",
  path.join(root, "tests", "rejected-evasive", "BRAND_DNA.json"),
  "--evidence",
  path.join(root, "tests", "rejected-evasive", "BRAND_EVIDENCE.json")
];

runNode(
  "Evasive Brand DNA fixture was accepted: the gates are reading self-reported scores again",
  [brandValidator, ...evasiveBrand],
  { expect: "fail" }
);

runNode("Evasive Brand DNA fixture is malformed beyond the gates", [
  brandValidator,
  ...evasiveBrand,
  "--lenient"
]);

// --- visual-tuning-kit -------------------------------------------------
// El contrato del calibrador es lo único que separa una herramienta acotada
// de un editor de CSS con pasos extra. Derivarlo del proyecto tiene que
// producir algo que su propio validador acepte: si no, la cadena se corta
// justo donde debía encadenarse.
const kitScripts = path.join(root, "skills", "visual-tuning-kit", "scripts");
const derivedDir = fs.mkdtempSync(path.join(os.tmpdir(), "cbss-derive-"));
const derivedSchema = path.join(derivedDir, "TUNING_SCHEMA.json");
const derivedValues = path.join(derivedDir, "TUNING_VALUES.json");

runNode("Schema derivation failed on the fixture project", [
  path.join(kitScripts, "derive-schema.mjs"),
  "--project",
  path.join(root, "tests", "tuning-fixture"),
  "--id",
  "fixture-home",
  "--out",
  derivedSchema,
  "--values-out",
  derivedValues
]);

runNode("Derived tuning contract rejected by the kit's own validator", [
  path.join(kitScripts, "validate-tuning.mjs"),
  "--schema",
  derivedSchema,
  "--values",
  derivedValues,
  "--allow-draft"
]);

// Los valores se emiten en borrador y sin firmar. Que pasen como aprobados
// sería la herramienta aprobando en nombre del usuario.
runNode(
  "Draft values were accepted as approved: the approval gate is not working",
  [
    path.join(kitScripts, "validate-tuning.mjs"),
    "--schema",
    derivedSchema,
    "--values",
    derivedValues
  ],
  { expect: "fail" }
);

// El circuito del contenido: un texto aprobado tiene que volver al contrato, y
// un borrador no puede tocarlo.
const contentRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cbss-content-"));
const contentSchema = path.join(contentRoot, "TUNING_SCHEMA.json");
const contentValues = path.join(contentRoot, "TUNING_VALUES.json");
const contentDraft = path.join(contentRoot, "TUNING_VALUES.draft.json");
const contentManifest = path.join(contentRoot, "CONTENT_MANIFEST.json");

fs.copyFileSync(
  path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json"),
  contentManifest
);

const manifestDocument = JSON.parse(read(contentManifest));
const firstPageId = Object.keys(manifestDocument.pages)[0];
const firstPage = manifestDocument.pages[firstPageId];
const firstSection = firstPage.sections[0];

fs.writeFileSync(
  contentSchema,
  `${JSON.stringify(
    {
      version: "0.1",
      id: "content-roundtrip",
      title: "Contenido",
      query_parameter: "tune",
      development_only: true,
      groups: [
        {
          id: "contenido",
          label: "Contenido",
          controls: [
            {
              id: "menu-principal",
              kind: "navigation",
              label: "Primary navigation",
              rationale: "Destinations change when a section opens or closes.",
              max_length: 24,
              min_items: 1,
              max_items: 6,
              allowed_hosts: ["shop.example.invalid"],
              allow_relative: true,
              default: [
                { id: "work", label: "Work", href: "/work", target: "_self", visible: true }
              ],
              target: { content_path: "navigation", event_name: "nav:update" }
            },
            {
              id: "seccion-titulo",
              kind: "text",
              label: "Section heading",
              rationale: "The heading is the edit people make most often.",
              default: firstSection.heading ?? firstSection.title ?? "",
              target: {
                content_path: `pages.${firstPageId}.sections.${firstSection.id}.${
                  firstSection.heading !== undefined ? "heading" : "title"
                }`
              }
            }
          ]
        }
      ]
    },
    null,
    2
  )}
`
);

const roundTripText = "Edited through the review panel";
const approvedValues = {
  version: "0.1",
  schema: "content-roundtrip",
  status: "approved",
  approved_by: "repository check",
  approved_at: "2026-01-01T00:00:00Z",
  values: {
    "seccion-titulo": roundTripText,
    "menu-principal": [
      { id: "work", label: "Work", href: "/work", target: "_self", visible: true },
      { id: "shop", label: "Shop", href: "https://shop.example.invalid", target: "_blank", visible: false }
    ]
  }
};

fs.writeFileSync(contentValues, `${JSON.stringify(approvedValues, null, 2)}
`);
fs.writeFileSync(
  contentDraft,
  `${JSON.stringify(
    { ...approvedValues, status: "draft", approved_by: null, approved_at: null },
    null,
    2
  )}
`
);

const applyContent = path.join(kitScripts, "apply-content.mjs");
const contentArgs = ["--schema", contentSchema, "--values", contentValues, "--content", contentManifest];

runNode(
  "Draft values were allowed to edit the content contract",
  [applyContent, "--schema", contentSchema, "--values", contentDraft, "--content", contentManifest],
  { expect: "fail" }
);

runNode("Approved content values were not applied", [applyContent, ...contentArgs]);

const roundTripped = JSON.parse(read(contentManifest));
const roundTrippedSection = roundTripped.pages[firstPageId].sections.find(
  (item) => item.id === firstSection.id
);
const roundTrippedValue =
  firstSection.heading !== undefined ? roundTrippedSection.heading : roundTrippedSection.title;

if (roundTrippedValue !== roundTripText) {
  fail(
    `Content round trip lost the approved edit: expected "${roundTripText}", ` +
      `content says "${roundTrippedValue}"`
  );
}

if (roundTripped.pages[firstPageId].sections.length !== firstPage.sections.length) {
  fail("Content round trip changed how many sections the page has");
}

if (roundTripped.navigation?.length !== 2 || roundTripped.navigation[1].visible !== false) {
  fail("Content round trip did not write the approved navigation back into the contract");
}

runNode("Applying approved content twice was not idempotent", [applyContent, ...contentArgs]);

// Un destino mal formado no puede aplicarse a medias.
const brokenNav = path.join(contentRoot, "TUNING_VALUES.broken-nav.json");
fs.writeFileSync(
  brokenNav,
  `${JSON.stringify(
    {
      ...approvedValues,
      values: {
        ...approvedValues.values,
        "menu-principal": [
          { id: "work", label: "Work", href: "/work", target: "_parent", visible: true }
        ]
      }
    },
    null,
    2
  )}
`
);

runNode(
  "An invalid navigation target was written into the content contract",
  [applyContent, "--schema", contentSchema, "--values", brokenNav, "--content", contentManifest],
  { expect: "fail" }
);

fs.rmSync(contentRoot, { recursive: true, force: true });

// --- wordpress-publisher -----------------------------------------------
// Un paquete incompleto no falla al generarse: falla en la portada del
// cliente. El fixture recorre exportar y verificar de punta a punta.
const wordpressFixture = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "cbss-wordpress-")),
  "project"
);

copyTree(path.join(root, "tests", "wordpress-fixture"), wordpressFixture);

runNode(
  "WordPress export failed on the synthetic fixture",
  [
    path.join(root, "skills", "wordpress-publisher", "scripts", "export-plugin.mjs"),
    "--project",
    wordpressFixture
  ],
  { cwd: wordpressFixture }
);

const exportedPlugin = path.join(wordpressFixture, "wordpress", "build", "portada-fixture");

// La portada puede alojar componentes de WordPress a proposito, pero solo los
// declarados. Un handle mal escrito tiene que fallar al exportar: si no,
// no permite nada y el componente aparece sin estilos sin explicacion.
const configPath = path.join(wordpressFixture, "wordpress.config.json");
const baseConfig = JSON.parse(read(configPath));

fs.writeFileSync(
  configPath,
  `${JSON.stringify({ ...baseConfig, allowedStyles: ["elementor-frontend", "elementor-post-*"] }, null, 2)}
`
);

runNode(
  "Declared allowedStyles were not exported into the plugin",
  [
    path.join(root, "skills", "wordpress-publisher", "scripts", "export-plugin.mjs"),
    "--project",
    wordpressFixture
  ],
  { cwd: wordpressFixture }
);

const conAllowlist = read(path.join(exportedPlugin, "portada-fixture.php"));
if (!conAllowlist.includes("'elementor-frontend', 'elementor-post-*'")) {
  fail("allowedStyles did not reach the generated plugin");
}
if (!conAllowlist.includes("portada-fixture-styles")) {
  fail("The generated plugin cannot report which styles it removed");
}

fs.writeFileSync(
  configPath,
  `${JSON.stringify({ ...baseConfig, allowedStyles: ["../../evil"] }, null, 2)}
`
);

runNode(
  "An invalid style handle was accepted",
  [
    path.join(root, "skills", "wordpress-publisher", "scripts", "export-plugin.mjs"),
    "--project",
    wordpressFixture
  ],
  { expect: "fail", cwd: wordpressFixture }
);

fs.writeFileSync(configPath, `${JSON.stringify(baseConfig, null, 2)}
`);
runNode(
  "Re-export without allowedStyles failed",
  [
    path.join(root, "skills", "wordpress-publisher", "scripts", "export-plugin.mjs"),
    "--project",
    wordpressFixture
  ],
  { cwd: wordpressFixture }
);

// Un PHP que no parsea tiene que frenar el paquete. Paso lo contrario: un
// error de sintaxis atraveso las cinco comprobaciones de instalabilidad, se
// empaqueto y tiro un sitio en produccion.
// Se inyecta sobre el paquete exportado y se restaura, en vez de sobre una
// copia: una copia incompleta hace fallar la validacion por archivos ausentes,
// y entonces la prueba pasa por el motivo equivocado — que es exactamente como
// estaba escrita antes, dando por bueno un linter apagado.
const principal = path.join(exportedPlugin, "portada-fixture.php");
const sano = read(principal);
const marca = "defined( 'ABSPATH' ) || exit;";
if (!sano.includes(marca)) {
  fail("El fixture de WordPress cambio: no se puede inyectar el error de sintaxis");
}

// El mismo error que llego a produccion: una comilla del contenido corta la
// cadena PHP. Se arma con codigos de caracter para que ninguna capa de escapes
// lo desarme por el camino — asi fue como se genero el original.
const comilla = String.fromCharCode(39);
const dobleComilla = String.fromCharCode(34);
const salto = String.fromCharCode(10);
const inyectado =
  salto +
  '$x = ' + comilla + '<a onload=' + dobleComilla + 'f=' + comilla + 'y' + comilla +
  dobleComilla + '>' + comilla + ';';

fs.writeFileSync(principal, sano.replace(marca, marca + inyectado));

runNode(
  "A PHP syntax error was allowed into a package",
  [
    path.join(root, "skills", "wordpress-publisher", "scripts", "validate-plugin.mjs"),
    "--plugin",
    exportedPlugin
  ],
  { expect: "fail" }
);

// Restaurado. La comprobacion que sigue valida este mismo paquete y tiene que
// pasar: si no, el error quedo puesto.
fs.writeFileSync(principal, sano);

runNode("Exported WordPress plugin rejected by its own validator", [
  path.join(root, "skills", "wordpress-publisher", "scripts", "validate-plugin.mjs"),
  "--plugin",
  exportedPlugin
]);

// Sacarle la hoja de aislamiento deja un paquete que se instala y pelea con
// el tema del cliente. Tiene que ser rechazado.
fs.rmSync(path.join(exportedPlugin, "assets"), { recursive: true, force: true });

runNode(
  "Incomplete WordPress package was accepted: the packaging gate is not working",
  [
    path.join(root, "skills", "wordpress-publisher", "scripts", "validate-plugin.mjs"),
    "--plugin",
    exportedPlugin
  ],
  { expect: "fail" }
);

// --- wordpress-publisher: compatibilidad hacia atras ---------------------
// El modo `front-page` es el que esta instalado en sitios vivos. "No rompi
// nada" es una afirmacion que se mide o no vale nada: se compara archivo por
// archivo contra una linea base generada con la implementacion anterior al
// refactor por modos.
const { exportarFixture } = await import(
  pathToFileURL(path.join(root, "scripts", "snapshot-wordpress-front-page.mjs")).href
);

const lineaBase = JSON.parse(
  read(path.join(root, "tests", "wordpress-fixture", "expected", "front-page.json"))
).archivos;

const producido = exportarFixture();

for (const ruta of new Set([...Object.keys(lineaBase), ...Object.keys(producido)])) {
  if (lineaBase[ruta] === producido[ruta]) continue;

  fail(
    !lineaBase[ruta]
      ? `El modo front-page ahora produce un archivo que antes no existia: ${ruta}`
      : !producido[ruta]
        ? `El modo front-page dejo de producir ${ruta}`
        : `El modo front-page cambio el contenido de ${ruta}. Si el cambio es querido, regeneralo con scripts/snapshot-wordpress-front-page.mjs y que el diff quede en el commit.`
  );
}

// Una configuracion sin `mode` es una configuracion de portada, y el artefacto
// lo dice: el validador -y quien depure en produccion- leen el modo del archivo
// que efectivamente se instala.
const { modoDeclarado } = await import(
  pathToFileURL(path.join(root, "skills", "wordpress-publisher", "scripts", "validate-plugin.mjs")).href
);

if (modoDeclarado(read(path.join(exportedPlugin, "portada-fixture.php"))) !== "front-page") {
  fail("Un paquete generado sin `mode` no se declara como front-page");
}

// --- wordpress-publisher: los modos nuevos --------------------------------
const { resolveConfig } = await import(
  pathToFileURL(path.join(root, "skills", "wordpress-publisher", "lib", "config.mjs")).href
);

const exportador = path.join(root, "skills", "wordpress-publisher", "scripts", "export-plugin.mjs");
const validador = path.join(root, "skills", "wordpress-publisher", "scripts", "validate-plugin.mjs");

function proyectoDeModos(config) {
  const proyecto = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cbss-modos-")), "project");
  copyTree(path.join(root, "tests", "wordpress-modes-fixture"), proyecto);
  fs.writeFileSync(
    path.join(proyecto, "wordpress.config.json"),
    `${JSON.stringify(config, null, 2)}\n`
  );
  return proyecto;
}

const baseDeModos = {
  name: "Sistema",
  description: "Fixture sintetico de modos.",
  author: "Fixture",
  version: "0.1.0"
};

const paginasDeModos = [
  { id: "inicio", label: "Inicio compilado", source: "dist/index.html" },
  { id: "producto-x", label: "Producto X" }
];

const modosAVerificar = [
  {
    etiqueta: "page-template variante canvas",
    config: {
      ...baseDeModos,
      slug: "modo-canvas",
      mode: "page-template",
      variant: "canvas",
      pages: paginasDeModos
    },
    comprobar(pluginDir) {
      const principal = read(path.join(pluginDir, "modo-canvas.php"));
      if (!principal.includes("add_filter( 'theme_page_templates'")) {
        fail("El modo page-template no registra sus plantillas sin tema hijo");
      }
      // La plantilla imprime el cuerpo compilado sin preguntar nada: tomar una
      // pagina protegida seria publicar lo que el cliente decidio cerrar.
      if (!principal.includes("post_password_required()")) {
        fail("El modo page-template toma paginas protegidas con contraseña");
      }
      if (!principal.includes("is_singular( 'page' )")) {
        fail("El modo page-template no se limita a paginas");
      }
      const plantilla = read(path.join(pluginDir, "templates", "page-producto-x.php"));
      for (const hook of ["wp_head()", "wp_body_open()", "wp_footer()"]) {
        if (!plantilla.includes(hook)) fail(`La variante canvas perdio ${hook}`);
      }
    }
  },
  {
    etiqueta: "page-template variante theme",
    config: {
      ...baseDeModos,
      slug: "modo-tema",
      mode: "page-template",
      variant: "theme",
      pages: paginasDeModos
    },
    comprobar(pluginDir) {
      const plantilla = read(path.join(pluginDir, "templates", "page-producto-x.php"));
      for (const llamada of ["get_header()", "get_footer()"]) {
        if (!plantilla.includes(llamada)) {
          fail(`La variante theme no conserva ${llamada}: el tema pierde su cabecera o su pie`);
        }
      }
      const css = read(path.join(pluginDir, "dist", "_astro", "sistema.css"));
      if (/(^|\})\s*body\s*\{/.test(css)) {
        fail("La variante theme empaqueto CSS que todavia le habla al body de la pagina");
      }
    }
  },
  {
    etiqueta: "embedded-page",
    config: {
      ...baseDeModos,
      slug: "modo-embed",
      mode: "embedded-page",
      shortcode: "sistema_pieza",
      pages: paginasDeModos
    },
    comprobar(pluginDir) {
      const principal = read(path.join(pluginDir, "modo-embed.php"));
      if (!principal.includes("add_shortcode( 'sistema_pieza'")) {
        fail("El modo embedded-page no registra su shortcode");
      }
      const fragmento = read(path.join(pluginDir, "fragments", "inicio.php"));
      if (/<(?:html|head|body)\b/i.test(fragmento)) {
        fail("Un fragmento incrustado trae etiquetas de documento");
      }
      // Astro deja sus modulos cerrando el body. Si viajan adentro del
      // fragmento, dos inserciones en la misma pagina ejecutan el mismo
      // modulo dos veces.
      if (/<script[^>]+src=/i.test(fragmento)) {
        fail("El fragmento arrastra un script propio en vez de encolarlo");
      }
      if (!principal.includes("modo-embed-script-1")) {
        fail("El modulo de la pieza no quedo registrado para encolarse");
      }
    }
  },
  {
    etiqueta: "elementor-widgets",
    config: {
      ...baseDeModos,
      slug: "modo-widgets",
      mode: "elementor-widgets",
      widgets: [
        {
          id: "grilla-productos",
          label: "Grilla de productos",
          controls: [{ name: "titulo", type: "text", label: "Titulo", default: "Productos" }],
          data: [{ name: "productos", source: "woocommerce.products", limit: 8 }]
        }
      ]
    },
    comprobar(pluginDir) {
      const principal = read(path.join(pluginDir, "modo-widgets.php"));

      for (const enganche of [
        "did_action( 'elementor/loaded' )",
        "add_action( 'elementor/widgets/register'",
        "add_action( 'elementor/elements/categories_registered'"
      ]) {
        if (!principal.includes(enganche)) fail(`El modo elementor-widgets no usa ${enganche}`);
      }

      // Sin WooCommerce el widget devuelve una lista vacia; no rompe la pagina.
      if (!principal.includes("function_exists( 'wc_get_products' )")) {
        fail("El proveedor de productos no comprueba que WooCommerce este activo");
      }
      if (principal.includes("$wpdb")) {
        fail("El proveedor de datos consulta la base directamente en vez de usar las APIs");
      }

      const clase = read(path.join(pluginDir, "widgets", "class-grilla-productos.php"));
      if (!clase.includes("extends \\Elementor\\Widget_Base")) {
        fail("El widget generado no extiende Widget_Base");
      }
    }
  }
];

for (const caso of modosAVerificar) {
  const proyecto = proyectoDeModos(caso.config);
  const pluginDir = path.join(proyecto, "wordpress", "build", caso.config.slug);

  runNode(`El modo ${caso.etiqueta} no exporto`, [exportador, "--project", proyecto], {
    cwd: proyecto
  });

  if (!fs.existsSync(pluginDir)) {
    fail(`El modo ${caso.etiqueta} no dejo ningun paquete`);
    continue;
  }

  runNode(
    `El paquete de ${caso.etiqueta} fue rechazado por su propio validador`,
    [validador, "--plugin", pluginDir, "--config", path.join(proyecto, "wordpress.config.json")],
    { cwd: proyecto }
  );

  caso.comprobar(pluginDir);
}

// Que el CSS quede acotado no se declara: se mide. Se inyecta una regla que
// alcanza a toda la pagina y el paquete tiene que dejar de pasar.
const proyectoFuga = proyectoDeModos({
  ...baseDeModos,
  slug: "modo-fuga",
  mode: "embedded-page",
  pages: paginasDeModos
});

const pluginDeFuga = path.join(proyectoFuga, "wordpress", "build", "modo-fuga");
const configDeFuga = path.join(proyectoFuga, "wordpress.config.json");

runNode("La exportacion de la prueba de aislamiento fallo", [exportador, "--project", proyectoFuga], {
  cwd: proyectoFuga
});

const cssDeFuga = path.join(pluginDeFuga, "dist", "_astro", "sistema.css");
const cssSano = read(cssDeFuga);

fs.writeFileSync(cssDeFuga, `${cssSano}\nbody{color:red}\n`);

runNode(
  "Un CSS que le habla a toda la pagina entro en un paquete incrustable",
  [validador, "--plugin", pluginDeFuga, "--config", configDeFuga],
  { expect: "fail", cwd: proyectoFuga }
);

// Restaurado: la comprobacion que sigue valida el mismo paquete y tiene que
// pasar. Si no, el error quedo puesto y la anterior paso por otra razon.
fs.writeFileSync(cssDeFuga, cssSano);

runNode(
  "El paquete incrustable sano fue rechazado: la prueba de aislamiento paso por el motivo equivocado",
  [validador, "--plugin", pluginDeFuga, "--config", configDeFuga],
  { cwd: proyectoFuga }
);

// Medir el resultado no alcanza para todo. Hay formas de CSS que el auditor
// tampoco ve, y para esas el acotador tiene que negarse: si las transforma a
// ciegas, produce justo la fuga que las dos compuertas existen para evitar.
const { acotarCss } = await import(
  pathToFileURL(path.join(root, "skills", "wordpress-publisher", "lib", "css-scope.mjs")).href
);
const { auditar } = await import(
  pathToFileURL(
    path.join(root, "skills", "wordpress-publisher", "scripts", "audit-foreign-css.mjs")
  ).href
);

const cssQueDebeRechazarse = [
  ["un @import, que trae una hoja que nadie miro", '@import url("otra.css");.x{color:red}'],
  ["una regla anidada, que vive donde nadie mira", ".x{color:red;body{margin:0}}"],
  ["una at-rule que no sabe tratar", "@scope (.a) to (.b){body{margin:0}}"],
  ["un selector con dos raices", "html.dark body{color:red}"],
  ["una raiz envuelta con varios argumentos", ":where(html, body){margin:0}"]
];

for (const [etiqueta, css] of cssQueDebeRechazarse) {
  let acoto = false;
  try {
    acotarCss(css, ".r");
    acoto = true;
  } catch (error) {
    if (error.name !== "CssNoAcotable") {
      fail(`El acotador fallo por otra razon ante ${etiqueta}: ${error.message}`);
    }
  }
  if (acoto) fail(`El acotador de CSS acepto ${etiqueta} en vez de rechazarlo`);
}

// Y hace falta que se niegue, porque medir despues no lo detecta. Si alguna vez
// el auditor aprende a ver estos casos, esta comprobacion falla y el rechazo se
// puede aflojar — que es la unica razon honesta para aflojarlo.
for (const [etiqueta, css] of [
  ["una regla anidada", ".r .x{color:red;body{margin:0}}"],
  ["un selector con dos raices mal reescrito", ".r.dark body{color:red}"]
]) {
  if (auditar(css, { scope: ".r" }).globales !== 0) {
    fail(
      `El auditor ahora si ve ${etiqueta}: revisar si el rechazo del acotador sigue siendo necesario`
    );
  }
}

// De punta a punta: una hoja del build con un selector de dos raices tiene que
// frenar la exportacion, no colarse en el paquete.
const proyectoRaro = proyectoDeModos({
  ...baseDeModos,
  slug: "modo-raro",
  mode: "embedded-page",
  pages: paginasDeModos
});

const cssDelFixture = path.join(proyectoRaro, "dist", "_astro", "sistema.css");
fs.writeFileSync(cssDelFixture, `${read(cssDelFixture)}\nhtml.dark body{color:red}\n`);

runNode(
  "Una hoja que el acotador no entiende se exporto igual",
  [exportador, "--project", proyectoRaro],
  { expect: "fail", cwd: proyectoRaro }
);

// Las compuertas de la configuracion. Cada una existe por una razon que se
// puede nombrar; si alguna deja de rechazar, la razon se perdio.
const configuracionesQueDebenFallar = [
  [
    "un widget que se llama como un ladrillo de Elementor",
    { slug: "x-y", mode: "elementor-widgets", widgets: [{ id: "heading", label: "T", controls: [{ name: "t", type: "text" }] }] }
  ],
  [
    "un widget que no declara nada que cambie",
    { slug: "x-y", mode: "elementor-widgets", widgets: [{ id: "bloque-marca", label: "B", controls: [{ name: "c", type: "color" }] }] }
  ],
  [
    "una fuente de datos sin generador",
    { slug: "x-y", mode: "elementor-widgets", widgets: [{ id: "grilla-x", label: "G", data: [{ name: "d", source: "sql.directo" }] }] }
  ],
  ["un modo inexistente", { slug: "x-y", mode: "inventado" }],
  ["un nombre con comilla simple, que corta el PHP generado", { slug: "x-y", name: "Portada d'algo" }],
  ["una plantilla de pagina sin etiqueta visible", { slug: "x-y", mode: "page-template", pages: [{ id: "a" }] }],
  ["dos paginas con el mismo id", { slug: "x-y", mode: "embedded-page", pages: [{ id: "a" }, { id: "a" }] }]
];

for (const [etiqueta, configuracion] of configuracionesQueDebenFallar) {
  let acepto = false;
  try {
    resolveConfig(configuracion);
    acepto = true;
  } catch {
    acepto = false;
  }
  if (acepto) fail(`La configuracion acepto ${etiqueta}`);
}

// Una ruta fuera del build es un nombre de archivo valido, asi que no la puede
// atajar la configuracion: la ataja el lector, al exportar.
const proyectoFuera = proyectoDeModos({
  ...baseDeModos,
  slug: "modo-fuera",
  mode: "embedded-page",
  pages: [{ id: "a", source: "../wordpress.config.json" }]
});

runNode(
  "Se exporto una pagina que vive fuera del build",
  [exportador, "--project", proyectoFuera],
  { expect: "fail", cwd: proyectoFuera }
);

// El escapado del cuerpo de un widget se comprueba leyendo el PHP generado.
const { sinEscapar } = await import(
  pathToFileURL(path.join(root, "skills", "wordpress-publisher", "exporters", "elementor-widgets.mjs")).href
);

if (sinEscapar("<?php echo $ajustes['x']; ?>", "prueba.php").length === 0) {
  fail("El detector de impresiones sin escapar no ve un echo crudo");
}
if (sinEscapar("<?php echo esc_html( $ajustes['x'] ); ?>", "prueba.php").length !== 0) {
  fail("El detector de impresiones sin escapar marca un echo que si escapa");
}

if (failures.length) {
  console.error("\nRepository validation failed:\n");
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`\nRepository validation passed (${files.length} files checked).`);
