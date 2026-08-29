#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
  values: { "seccion-titulo": roundTripText }
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

runNode("Applying approved content twice was not idempotent", [applyContent, ...contentArgs]);

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

if (failures.length) {
  console.error("\nRepository validation failed:\n");
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`\nRepository validation passed (${files.length} files checked).`);
