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
  try { return JSON.parse(await fs.readFile(absolute, "utf8")); }
  catch (error) { throw new Error(`Unable to read JSON: ${absolute}\n${error.message}`); }
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, key) => value?.[key], object);
}

function collectIds(node, ids = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) collectIds(item, ids);
  } else if (node && typeof node === "object") {
    if (typeof node.id === "string") ids.add(node.id);
    for (const value of Object.values(node)) collectIds(value, ids);
  }
  return ids;
}

export async function validateLab({ styleFile, evidenceFile, specFile, allowDraft = false }) {
  const [style, evidence, spec, schema] = await Promise.all([
    readJson(styleFile), readJson(evidenceFile), readJson(specFile),
    readJson(path.join(root, "schemas", "reference-lab-spec.schema.json"))
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(spec)) {
    const details = (validate.errors || []).map((error) => `  - ${error.instancePath || "/"}: ${error.message}`).join("\n");
    throw new Error(`REFERENCE_LAB_SPEC schema invalid\n${details}`);
  }

  const issues = [];
  const evidenceIds = collectIds(evidence);
  const demoIds = new Set();
  const reviewIds = new Set();
  const itemKinds = new Set(["filter", "media-sequence", "marquee"]);

  for (const demo of spec.demos) {
    if (demoIds.has(demo.id)) issues.push(`duplicate demo id '${demo.id}'`);
    demoIds.add(demo.id);
    for (const sourcePath of demo.source_paths) {
      if (getPath(style, sourcePath) === undefined) issues.push(`demo:${demo.id}: unknown STYLE_DNA path '${sourcePath}'`);
    }
    for (const ref of demo.evidence_refs) {
      if (!evidenceIds.has(ref)) issues.push(`demo:${demo.id}: unknown evidence reference '${ref}'`);
    }
    if (itemKinds.has(demo.kind) && (!Array.isArray(demo.config.items) || demo.config.items.length < 2)) {
      issues.push(`demo:${demo.id}: kind '${demo.kind}' requires at least two config.items`);
    }
  }

  for (const item of spec.review.checklist) {
    if (reviewIds.has(item.id)) issues.push(`duplicate review item '${item.id}'`);
    reviewIds.add(item.id);
  }

  if (!allowDraft) {
    if (spec.review.status !== "approved") issues.push("review.status must be 'approved'");
    if (!spec.review.approved_by) issues.push("review.approved_by is required");
    if (!spec.review.approved_at) issues.push("review.approved_at is required");
    for (const item of spec.review.checklist) if (item.status !== "accepted") issues.push(`review item '${item.id}' is not accepted`);
  }

  if (issues.length) throw new Error(`Reference lab gate failed\n${issues.map((item) => `  - ${item}`).join("\n")}`);
  return { style, evidence, spec };
}

async function main() {
  const styleFile = arg("--style");
  const evidenceFile = arg("--evidence");
  const specFile = arg("--spec");
  const allowDraft = process.argv.includes("--allow-draft");
  if (!styleFile || !evidenceFile || !specFile) throw new Error("Usage: validate-lab.mjs --style STYLE_DNA.json --evidence REFERENCE_EVIDENCE.json --spec REFERENCE_LAB_SPEC.json [--allow-draft]");
  await validateLab({ styleFile, evidenceFile, specFile, allowDraft });
  console.log(`✓ REFERENCE_LAB_SPEC valid${allowDraft ? " (draft allowed)" : " and approved"}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}

