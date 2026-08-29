#!/usr/bin/env node

// Checks a finished piece against BRAND_RULES.json before it ships.
//
// The alternative is what usually happens: whoever wrote the piece also
// decides whether it respects the brand, and marks their own checklist. That
// check always passes.
//
// Usage:
//   node scripts/check-piece.mjs --piece caption.md --rules BRAND_RULES.json
//
//   --json      machine-readable report
//   --strict    manual rules count as failures until a reviewer answers them

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const cwd = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const asJson = process.argv.includes("--json");
const strict = process.argv.includes("--strict");

const pieceFile = arg("piece", null);
const rulesFile = arg("rules", "BRAND_RULES.json");
const schemaDir = arg("schemas", path.resolve(scriptDir, "../schemas"));

async function readText(file) {
  return fs.readFile(path.resolve(cwd, file), "utf8");
}

async function readJson(file) {
  return JSON.parse(await readText(file));
}

// A piece is not one blob. Rules about openings and closings need to know
// where those are, and a rule scoped to the opening must not fire on a
// quotation buried in the middle.
function segment(text) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const prose = blocks.filter((block) => !/^[#>|`-]/.test(block));
  const body = prose.length ? prose : blocks;

  return {
    all: text,
    opening: body[0] || "",
    closing: body[body.length - 1] || "",
    headline: (text.match(/^#{1,2}\s+(.+)$/m) || [])[1] || body[0] || "",
    body: body.join("\n\n"),
    caption: text,
    cta: body[body.length - 1] || ""
  };
}

function targetsFor(rule, segments) {
  const scopes = rule.scope?.length ? rule.scope : ["all"];
  return scopes.map((scope) => ({
    scope,
    text: segments[scope] ?? segments.all
  }));
}

function evaluate(rule, segments) {
  const severity = rule.severity || "block";

  if (rule.detect.type === "manual") {
    return {
      id: rule.id,
      statement: rule.statement,
      severity,
      status: "unverified",
      asks: rule.detect.asks || rule.statement,
      detail: "Needs judgement. Not checkable by pattern."
    };
  }

  let expression;

  try {
    expression = new RegExp(rule.detect.pattern, rule.detect.flags ?? "i");
  } catch (error) {
    return {
      id: rule.id,
      statement: rule.statement,
      severity,
      status: "error",
      detail: `Invalid pattern: ${error.message}`
    };
  }

  for (const { scope, text } of targetsFor(rule, segments)) {
    const match = expression.exec(text);
    const matched = Boolean(match);
    const violates = rule.kind === "forbid" ? matched : !matched;

    if (violates) {
      return {
        id: rule.id,
        statement: rule.statement,
        severity,
        status: "violation",
        scope,
        detail:
          rule.kind === "forbid"
            ? `Found in ${scope}: "${match[0].slice(0, 80)}"`
            : `Required pattern absent from ${scope}`
      };
    }
  }

  return {
    id: rule.id,
    statement: rule.statement,
    severity,
    status: "pass"
  };
}

async function main() {
  if (!pieceFile) {
    throw new Error("Pass the piece to check with --piece <file>.");
  }

  const [text, rules, schema] = await Promise.all([
    readText(pieceFile),
    readJson(rulesFile),
    readJson(path.join(schemaDir, "brand-rules.schema.json"))
  ]);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(rules)) {
    console.error("\n✗ BRAND_RULES schema validation failed");
    for (const error of validate.errors || []) {
      console.error(`  - ${error.instancePath || "/"}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const segments = segment(text);
  const results = rules.rules.map((rule) => evaluate(rule, segments));

  const violations = results.filter(
    (result) => result.status === "violation" && result.severity === "block"
  );
  const warnings = results.filter(
    (result) => result.status === "violation" && result.severity === "warn"
  );
  const unverified = results.filter((result) => result.status === "unverified");
  const errors = results.filter((result) => result.status === "error");

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          piece: pieceFile,
          brand: rules.brand?.name,
          checked_at: new Date().toISOString(),
          results,
          summary: {
            passed: results.filter((r) => r.status === "pass").length,
            violations: violations.length,
            warnings: warnings.length,
            unverified: unverified.length
          }
        },
        null,
        2
      )
    );
  } else {
    for (const result of results.filter((r) => r.status === "pass")) {
      console.log(`✓ ${result.id}`);
    }

    for (const result of warnings) {
      console.log(`! ${result.id} — ${result.statement}\n    ${result.detail}`);
    }

    for (const result of violations) {
      console.error(`✗ ${result.id} — ${result.statement}\n    ${result.detail}`);
    }

    for (const result of errors) {
      console.error(`✗ ${result.id} — ${result.detail}`);
    }

    // Reported, never silently passed. An unchecked rule that prints nothing
    // is how a checklist starts lying.
    for (const result of unverified) {
      console.log(`? ${result.id} — needs judgement: ${result.asks}`);
    }

    console.log(
      `\n${results.length} rules · ${violations.length} blocking · ` +
        `${warnings.length} warnings · ${unverified.length} need judgement`
    );
  }

  if (violations.length || errors.length || (strict && unverified.length)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
