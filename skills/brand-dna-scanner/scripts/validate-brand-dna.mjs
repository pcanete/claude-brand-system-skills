#!/usr/bin/env node

// Verifies the Brand DNA this skill produces. Schema validity is necessary
// but not sufficient: the gates check that the identity model is actually
// supported by the material that was inventoried.
//
// Usage:
//   node scripts/validate-brand-dna.mjs \
//     --dna BRAND_DNA.json --evidence BRAND_EVIDENCE.json
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
  verifyBrandContracts
} from "./lib/brand-contracts.mjs";

const cwd = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const strict = !process.argv.includes("--lenient");

const dnaFile = arg("dna", "BRAND_DNA.json");
const evidenceFile = arg("evidence", "BRAND_EVIDENCE.json");
const schemaDir = arg("schemas", path.resolve(scriptDir, "../schemas"));

async function main() {
  const [dna, evidence, dnaSchema, evidenceSchema] = await Promise.all([
    readJson(dnaFile, cwd),
    readJson(evidenceFile, cwd),
    readJson(path.join(schemaDir, "brand-dna.schema.json"), cwd),
    readJson(path.join(schemaDir, "brand-evidence.schema.json"), cwd)
  ]);

  const validators = createValidator({
    BRAND_DNA: dnaSchema,
    BRAND_EVIDENCE: evidenceSchema
  });

  const documents = {
    BRAND_DNA: dna,
    BRAND_EVIDENCE: evidence
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

  if (reportGroups(verifyBrandContracts(dna, evidence, { strict }))) {
    failed = true;
  }

  if (failed) {
    console.error(
      "\nBrand DNA rejected. Record the missing evidence or lower the claim."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nBrand DNA verified${strict ? "" : " (lenient: shape only)"}.`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
