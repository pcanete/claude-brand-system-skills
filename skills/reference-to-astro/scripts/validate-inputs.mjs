#!/usr/bin/env node

// Verifies the inputs this skill is about to build from. Run it before any
// construction work: a contract that cannot be trusted produces a site that
// cannot be defended.
//
// Usage:
//   node scripts/validate-inputs.mjs --style STYLE_DNA.json \
//     --evidence REFERENCE_EVIDENCE.json --content CONTENT_MANIFEST.json \
//     --blueprint SITE_BLUEPRINT.json
//
//   --lenient   check shape and reference integrity only
//   --schemas   override the schema directory

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createValidator,
  collectEvidenceIds,
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
  content: arg("content", "CONTENT_MANIFEST.json"),
  blueprint: arg("blueprint", "SITE_BLUEPRINT.json")
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

// El objetivo de fidelidad declarado gobierna cuánta ceremonia se exige, y solo
// eso. Las compuertas que impiden inventar —que el plan cubra el contenido y
// que cada patrón resuelva en una observación con evidencia— son iguales en los
// tres niveles. Bajar el objetivo baja el protocolo, nunca la honestidad.
//
//   directional  la referencia es un punto de partida. Los checkpoints pueden
//                quedar pendientes y las decisiones abiertas; una persona sigue
//                teniendo que aprobar el plan.
//   high         los checkpoints se resuelven —aprobados o saltados con motivo—
//                y no quedan decisiones abiertas.
//   forensic     como high, y además ningún patrón puede declararse `inferred`:
//                una reconstrucción forense no se apoya en conjeturas.
function ceremonyFor(blueprint) {
  const target = blueprint.project?.fidelity_target || "high";
  return {
    target,
    requiresResolvedCheckpoints: target !== "directional",
    requiresClosedDecisions: target !== "directional",
    forbidsInferredPatterns: target === "forensic"
  };
}

function checkBlueprintCheckpoints(blueprint, { strict }) {
  const ceremony = ceremonyFor(blueprint);
  const required = new Set([
    "brand-manual",
    "reference-lab",
    "content-architecture"
  ]);
  const seen = new Set();
  const issues = [];

  for (const checkpoint of blueprint.checkpoints || []) {
    if (seen.has(checkpoint.id)) {
      issues.push(`duplicate checkpoint '${checkpoint.id}'`);
    }
    seen.add(checkpoint.id);

    if (checkpoint.status === "waived" && !checkpoint.reason?.trim()) {
      issues.push(`${checkpoint.id}: waived checkpoint requires a reason`);
    }

    if (strict && ceremony.requiresResolvedCheckpoints && checkpoint.status === "pending") {
      issues.push(
        `${checkpoint.id}: checkpoint is still pending (fidelity_target '${ceremony.target}')`
      );
    }
  }

  for (const id of required) {
    if (!seen.has(id)) issues.push(`missing required checkpoint '${id}'`);
  }

  return issues;
}

function checkBlueprintApproval(blueprint, { strict }) {
  const issues = [];
  const decisions = blueprint.decisions || [];
  const ids = decisions.map((decision) => decision.id);

  if (!unique(ids)) issues.push("decision ids must be unique");

  const ceremony = ceremonyFor(blueprint);

  if (strict) {
    if (ceremony.requiresClosedDecisions) {
      for (const decision of decisions) {
        if (decision.status === "open") {
          issues.push(
            `${decision.id}: decision is still open (fidelity_target '${ceremony.target}')`
          );
        }
      }
    }

    if (blueprint.approval?.status !== "approved") {
      issues.push(
        `approval.status is '${blueprint.approval?.status || "missing"}', expected 'approved'`
      );
    }
  }

  if (strict && ceremony.forbidsInferredPatterns) {
    for (const [pageId, page] of Object.entries(blueprint.pages || {})) {
      for (const section of page.sections || []) {
        for (const pattern of section.reference_patterns || []) {
          if (pattern.mode === "inferred") {
            issues.push(
              `${pageId}/${section.id}: pattern '${pattern.style_path}' is 'inferred', ` +
                `which a forensic reconstruction cannot build on`
            );
          }
        }
      }
    }
  }

  return issues;
}

function checkBlueprintContentCoverage(blueprint, content) {
  const issues = [];
  const routes = new Set();

  for (const [pageId, page] of Object.entries(blueprint.pages || {})) {
    if (routes.has(page.route)) issues.push(`${pageId}: duplicate route '${page.route}'`);
    routes.add(page.route);

    const contentPage = content.pages?.[page.content_page];
    if (!contentPage) {
      issues.push(`${pageId}: unknown content page '${page.content_page}'`);
      continue;
    }

    if (contentPage.route !== page.route) {
      issues.push(
        `${pageId}: route '${page.route}' does not match CONTENT_MANIFEST route '${contentPage.route}'`
      );
    }

    const available = new Set((contentPage.sections || []).map((section) => section.id));
    const mapped = new Set();
    const sectionIds = new Set();

    for (const section of page.sections || []) {
      if (sectionIds.has(section.id)) {
        issues.push(`${pageId}: duplicate blueprint section id '${section.id}'`);
      }
      sectionIds.add(section.id);

      if (!available.has(section.content_section)) {
        issues.push(
          `${pageId}/${section.id}: unknown content section '${section.content_section}'`
        );
      }
      if (mapped.has(section.content_section)) {
        issues.push(
          `${pageId}: content section '${section.content_section}' is mapped more than once`
        );
      }
      mapped.add(section.content_section);
    }

    const excluded = new Set();
    for (const item of page.excluded_content_sections || []) {
      if (!available.has(item.id)) {
        issues.push(`${pageId}: excluded content section '${item.id}' does not exist`);
      }
      if (excluded.has(item.id)) {
        issues.push(`${pageId}: content section '${item.id}' is excluded more than once`);
      }
      excluded.add(item.id);
    }

    for (const id of available) {
      const destinations = Number(mapped.has(id)) + Number(excluded.has(id));
      if (destinations === 0) {
        issues.push(`${pageId}: content section '${id}' is neither mapped nor excluded`);
      }
      if (destinations > 1) {
        issues.push(`${pageId}: content section '${id}' is both mapped and excluded`);
      }
    }
  }

  return issues;
}

// El blueprint solo cita rutas del índice de observaciones: no alcanza con que
// la ruta exista como dato. Quien escribe el contrato no tiene cómo saber el
// nombre que el escáner le puso, así que se lo decimos.
function nearestPaths(wanted, available) {
  const parts = String(wanted).split(".");
  const leaf = parts[parts.length - 1];

  // Primero las que comparten la hoja —`motion.scroll.process` contra
  // `motion.process_cards`, que es el caso real— y después el resto de la zona.
  const scored = [...available]
    .map((candidate) => {
      const sharesLeaf = candidate.split(".").some((segment) => segment.includes(leaf) || leaf.includes(segment));
      const sharesRoot = candidate.split(".")[0] === parts[0];
      return { candidate, score: (sharesLeaf ? 2 : 0) + (sharesRoot ? 1 : 0) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return "";
  return `
      observaciones cercanas: ${scored.slice(0, 5).map((item) => item.candidate).join(", ")}`;
}

function checkBlueprintReferenceIntegrity(blueprint, style, evidence) {
  const issues = [];
  const stylePaths = new Set((style.observations || []).map((item) => item.path));
  const evidenceIds = collectEvidenceIds(evidence);
  const behaviorIds = new Set();

  for (const [pageId, page] of Object.entries(blueprint.pages || {})) {
    for (const section of page.sections || []) {
      for (const pattern of section.reference_patterns || []) {
        if (!stylePaths.has(pattern.style_path)) {
          issues.push(
            `${pageId}/${section.id}: unknown STYLE_DNA path '${pattern.style_path}'` +
              nearestPaths(pattern.style_path, stylePaths)
          );
        }
        for (const ref of pattern.evidence_refs || []) {
          if (!evidenceIds.has(ref)) {
            issues.push(`${pageId}/${section.id}: unknown evidence reference '${ref}'`);
          }
        }
      }

      for (const behavior of section.behaviors || []) {
        if (behaviorIds.has(behavior.id)) {
          issues.push(`duplicate blueprint behavior id '${behavior.id}'`);
        }
        behaviorIds.add(behavior.id);
        for (const ref of behavior.evidence_refs || []) {
          if (!evidenceIds.has(ref)) {
            issues.push(
              `${pageId}/${section.id}/${behavior.id}: unknown evidence reference '${ref}'`
            );
          }
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
    blueprint,
    styleSchema,
    evidenceSchema,
    contentSchema,
    blueprintSchema
  ] = await Promise.all([
    readJson(files.style, cwd),
    readJson(files.evidence, cwd),
    readJson(files.content, cwd),
    readJson(files.blueprint, cwd),
    readJson(path.join(schemaDir, "style-dna.schema.json"), cwd),
    readJson(path.join(schemaDir, "reference-evidence.schema.json"), cwd),
    readJson(path.join(schemaDir, "content-manifest.schema.json"), cwd),
    readJson(path.join(schemaDir, "site-blueprint.schema.json"), cwd)
  ]);

  const validators = createValidator({
    STYLE_DNA: styleSchema,
    REFERENCE_EVIDENCE: evidenceSchema,
    CONTENT_MANIFEST: contentSchema,
    SITE_BLUEPRINT: blueprintSchema
  });

  const documents = {
    STYLE_DNA: style,
    REFERENCE_EVIDENCE: evidence,
    CONTENT_MANIFEST: content,
    SITE_BLUEPRINT: blueprint
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
    },
    {
      label: "Blueprint checkpoints are explicit",
      issues: checkBlueprintCheckpoints(blueprint, { strict })
    },
    {
      label: "Blueprint has human approval",
      issues: checkBlueprintApproval(blueprint, { strict })
    },
    {
      label: "Blueprint covers the supplied content",
      issues: checkBlueprintContentCoverage(blueprint, content)
    },
    {
      label: "Blueprint patterns resolve to recorded reference evidence",
      issues: checkBlueprintReferenceIntegrity(blueprint, style, evidence)
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
