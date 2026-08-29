#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function readJson(file) {
  const absolute = path.resolve(process.cwd(), file);
  try {
    return JSON.parse(await fs.readFile(absolute, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read JSON: ${absolute}\n${error.message}`);
  }
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => {
    if (value === null || value === undefined) return undefined;
    return value[key];
  }, object);
}

function collectEvidenceIds(evidence) {
  return new Set((evidence.evidence || []).map((item) => item?.id).filter(Boolean));
}

export async function validateManual({ dnaFile, evidenceFile, specFile, allowDraft = false }) {
  const [dna, evidence, spec, schema] = await Promise.all([
    readJson(dnaFile),
    readJson(evidenceFile),
    readJson(specFile),
    readJson(path.join(root, "schemas", "brand-manual-spec.schema.json"))
  ]);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(spec)) {
    const details = (validate.errors || [])
      .map((error) => `  - ${error.instancePath || "/"}: ${error.message}`)
      .join("\n");
    throw new Error(`BRAND_MANUAL_SPEC schema invalid\n${details}`);
  }

  const issues = [];
  const sectionIds = new Set();
  const knownEvidence = collectEvidenceIds(evidence);

  for (const section of spec.sections) {
    if (sectionIds.has(section.id)) issues.push(`duplicate section id '${section.id}'`);
    sectionIds.add(section.id);

    for (const sourcePath of section.source_paths) {
      if (getPath(dna, sourcePath) === undefined) {
        issues.push(`section:${section.id}: unknown BRAND_DNA path '${sourcePath}'`);
      }
    }

    for (const ref of section.evidence_refs) {
      if (!knownEvidence.has(ref)) {
        issues.push(`section:${section.id}: unknown evidence reference '${ref}'`);
      }
    }
  }

  const reviewIds = new Set();
  for (const item of spec.review.checklist) {
    if (reviewIds.has(item.id)) issues.push(`duplicate review item '${item.id}'`);
    reviewIds.add(item.id);
  }

  if (!allowDraft) {
    if (spec.review.status !== "approved") issues.push("review.status must be 'approved'");
    if (!spec.review.approved_by) issues.push("review.approved_by is required");
    if (!spec.review.approved_at) issues.push("review.approved_at is required");
    for (const item of spec.review.checklist) {
      if (item.status !== "accepted") {
        issues.push(`review item '${item.id}' is not accepted`);
      }
    }
  }

  if (issues.length) {
    throw new Error(`Brand manual gate failed\n${issues.map((item) => `  - ${item}`).join("\n")}`);
  }

  return { dna, evidence, spec };
}

async function main() {
  const dnaFile = arg("--dna");
  const evidenceFile = arg("--evidence");
  const specFile = arg("--spec");
  const allowDraft = process.argv.includes("--allow-draft");

  if (!dnaFile || !evidenceFile || !specFile) {
    throw new Error("Usage: validate-manual.mjs --dna BRAND_DNA.json --evidence BRAND_EVIDENCE.json --spec BRAND_MANUAL_SPEC.json [--allow-draft]");
  }

  await validateManual({ dnaFile, evidenceFile, specFile, allowDraft });
  console.log(`✓ BRAND_MANUAL_SPEC valid${allowDraft ? " (draft allowed)" : " and approved"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

