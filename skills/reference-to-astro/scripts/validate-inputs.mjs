#!/usr/bin/env node

// Verifies the inputs this skill is about to build from. Run it before any
// construction work: a contract that cannot be trusted produces a site that
// cannot be defended.
//
// Usage:
//   node scripts/validate-inputs.mjs --style STYLE_DNA.json \
//     --evidence REFERENCE_EVIDENCE.json --content CONTENT_MANIFEST.json
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
  evidence: arg("evidence", "REFERENCE_EVIDENCE.json"),
  content: arg("content", "CONTENT_MANIFEST.json")
};

const schemaDir = arg("schemas", path.resolve(scriptDir, "../schemas"));

function unique(values) {
  return new Set(values).size === values.length;
}

function checkAssetIds(content) {
  const ids = (content.assets || []).map((asset) => asset.id);
  if (unique(ids)) return [];

  const seen = new Set();
  const duplicates = new Set();

  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  return [...duplicates].map((id) => `duplicate asset id '${id}'`);
}

function checkSectionAssets(content) {
  const known = new Set((content.assets || []).map((asset) => asset.id));
  const issues = [];

  for (const [pageId, page] of Object.entries(content.pages || {})) {
    for (const section of page.sections || []) {
      for (const assetId of section.media || []) {
        if (!known.has(assetId)) {
          issues.push(`${pageId}/${section.id}: unknown asset '${assetId}'`);
        }
      }
    }
  }

  return issues;
}

async function main() {
  const [
    style,
    evidence,
    content,
    styleSchema,
    evidenceSchema,
    contentSchema
  ] = await Promise.all([
    readJson(files.style, cwd),
    readJson(files.evidence, cwd),
    readJson(files.content, cwd),
    readJson(path.join(schemaDir, "style-dna.schema.json"), cwd),
    readJson(path.join(schemaDir, "reference-evidence.schema.json"), cwd),
    readJson(path.join(schemaDir, "content-manifest.schema.json"), cwd)
  ]);

  const validators = createValidator({
    STYLE_DNA: styleSchema,
    REFERENCE_EVIDENCE: evidenceSchema,
    CONTENT_MANIFEST: contentSchema
  });

  const documents = {
    STYLE_DNA: style,
    REFERENCE_EVIDENCE: evidence,
    CONTENT_MANIFEST: content
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

  const groups = [
    ...verifyWebContracts(style, evidence, { strict }),
    // The builder verifies what it receives. A scan that promised behavior
    // forensics and delivered prose is caught here, not after the site is
    // built on it.
    {
      label: "Behavior audits are temporal and cross-device",
      issues: strict ? checkBehaviorAuditQuality(evidence) : []
    },
    {
      label: "Asset ids are unique",
      issues: checkAssetIds(content)
    },
    {
      label: "Section media resolve to assets",
      issues: checkSectionAssets(content)
    }
  ];

  if (reportGroups(groups)) failed = true;

  if (failed) {
    console.error(
      "\nInputs rejected. Do not build on a contract that is not supported."
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\nReference Web System inputs verified${
      strict ? "" : " (lenient: shape only)"
    }.`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
