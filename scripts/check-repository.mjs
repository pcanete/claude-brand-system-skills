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
  "reference-scanner",
  "reference-to-astro",
  "site-tuner",
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

runNode("Scan artifacts fixture rejected by reference-scanner", [
  scannerValidator,
  ...webFixtures("reference-system")
]);

runNode("Reference scanner behavior gate tests failed", [scannerBehaviorTests]);

runNode("Reference-system fixture rejected by reference-to-astro", [
  builderValidator,
  ...webFixtures("reference-system"),
  "--content",
  path.join(root, "tests", "reference-system", "CONTENT_MANIFEST.json")
]);

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

// --- site-tuner --------------------------------------------------------
// El contrato del calibrador es lo único que separa una herramienta acotada
// de un editor de CSS con pasos extra. El ejemplo tiene que pasar, y un
// contrato incoherente tiene que fallar.
const tuningValidator = path.join(
  root,
  "skills",
  "site-tuner",
  "scripts",
  "validate-tuning.mjs"
);

runNode("Tuning example rejected by its own validator", [
  tuningValidator,
  "--schema",
  path.join(root, "skills", "site-tuner", "assets", "tuning.schema.example.json"),
  "--values",
  path.join(root, "skills", "site-tuner", "assets", "tuning.values.example.json")
]);

const incoherentTuning = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "cbss-tuning-")),
  "tuning.schema.json"
);

fs.writeFileSync(
  incoherentTuning,
  JSON.stringify({
    version: "1.0",
    id: "incoherente",
    title: "Incoherente",
    groups: [
      {
        id: "g",
        label: "G",
        controls: [
          // Sin efecto declarado: ocupa lugar en el panel y no hace nada.
          { id: "muerto", kind: "boolean", label: "Sin efecto", default: false }
        ]
      }
    ]
  })
);

// El generador tiene que producir un contrato que su propio validador acepte.
// Si el contrato generado no valida, la cadena se corta justo donde debía
// encadenarse.
const generatedTuning = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "cbss-generated-")),
  "tuning.schema.json"
);

runNode("Tuning generator failed on the fixture project", [
  path.join(root, "skills", "site-tuner", "scripts", "generate-tuning.mjs"),
  "--project",
  path.join(root, "tests", "tuning-fixture"),
  "--out",
  generatedTuning
]);

runNode("Generated tuning contract rejected by its own validator", [
  tuningValidator,
  "--schema",
  generatedTuning,
  "--lenient"
]);

runNode(
  "Incoherent tuning contract was accepted: the tuner gate is not working",
  [tuningValidator, "--schema", incoherentTuning, "--lenient"],
  { expect: "fail" }
);

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
