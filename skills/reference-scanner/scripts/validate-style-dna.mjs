#!/usr/bin/env node

// Verifies the artifacts this skill produces, before they are handed to an
// implementer. Schema validity is necessary but not sufficient: the gates
// also check that the contract is actually supported by recorded evidence.
//
// Usage:
//   node scripts/validate-style-dna.mjs \
//     --style STYLE_DNA.json --evidence REFERENCE_EVIDENCE.json
//
//   --lenient   check shape and reference integrity only
//   --schemas   override the schema directory

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createValidator,
  formatSchemaErrors,
  readJson,
  reportGroups,
  verifyWebContracts
} from "./lib/web-contracts.mjs";
import { checkBehaviorAuditQuality } from "./lib/behavior-gates.mjs";
import { checkEvidenceFiles, checkBehaviorInventory } from "./lib/evidence-integrity.mjs";

const cwd = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const strict = !process.argv.includes("--lenient");

const files = {
  style: arg("style", "STYLE_DNA.json"),
  evidence: arg("evidence", "REFERENCE_EVIDENCE.json")
};

const schemaDir = arg("schemas", path.resolve(scriptDir, "../schemas"));

async function main() {
  const [style, evidence, styleSchema, evidenceSchema] = await Promise.all([
    readJson(files.style, cwd),
    readJson(files.evidence, cwd),
    readJson(path.join(schemaDir, "style-dna.schema.json"), cwd),
    readJson(path.join(schemaDir, "reference-evidence.schema.json"), cwd)
  ]);

  const validators = createValidator({
    STYLE_DNA: styleSchema,
    REFERENCE_EVIDENCE: evidenceSchema
  });

  const documents = {
    STYLE_DNA: style,
    REFERENCE_EVIDENCE: evidence
  };

  let failed = false;

  for (const [name, validate] of Object.entries(validators)) {
    if (validate(documents[name])) {
      console.log(`✓ ${name} schema valid`);
    } else {
      failed = true;
      console.error(`\n✗ ${name} schema validation failed`);
      console.error(formatSchemaErrors(validate.errors));
    }
  }

  if (reportGroups(verifyWebContracts(style, evidence, { strict }))) {
    failed = true;
  }

  if (
    strict &&
    reportGroups([
      {
        label: "Behavior audits are temporal and cross-device",
        issues: checkBehaviorAuditQuality(evidence)
      }
    ])
  ) {
    failed = true;
  }

  if (strict && reportGroups([
    { label: "Captured evidence exists and matches", issues: await checkEvidenceFiles(evidence, path.dirname(path.resolve(cwd, files.evidence))) },
    { label: "Initial behavior inventory is covered", issues: checkBehaviorInventory(evidence) }
  ])) failed = true;

  if (failed) {
    console.error(
      "\nScan artifacts rejected. Record the missing evidence or lower the claim."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nScan artifacts verified${strict ? "" : " (lenient: shape only)"}.`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
