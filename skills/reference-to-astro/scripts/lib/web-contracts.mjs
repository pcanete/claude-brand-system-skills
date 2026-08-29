// Shared verification logic for the web reference contracts.
//
// This file is duplicated byte-identically in:
//   skills/reference-scanner/scripts/lib/web-contracts.mjs
//   skills/reference-to-astro/scripts/lib/web-contracts.mjs
//
// Both skills must stay independently installable, so the copy is deliberate.
// Repository CI fails when the two copies drift.

import fs from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

// Shared with the evidence model: 0.60 is the boundary between moderate
// evidence and weak inference. A claim at or above it must be supported.
export const SUPPORT_THRESHOLD = 0.6;

// Coverage dimensions map to the contract paths that can substantiate them.
const COVERAGE_PATHS = {
  visual: ["art_direction", "tokens.color", "tokens.surface", "components"],
  typography: ["typography", "tokens.typography"],
  layout: ["layout", "tokens.spacing", "tokens.grid"],
  media: ["media"],
  interaction: ["interaction"],
  motion: ["motion"],
  responsive: ["responsive"],
  transition: ["experience.transition", "experience.navigation", "motion.transition"],
  webgl: ["webgl"]
};

// Coverage dimensions that also require first-hand samples, not just claims.
const COVERAGE_COLLECTIONS = {
  interaction: "interactions",
  motion: "motion_samples",
  responsive: "responsive_samples"
};

const EVIDENCE_COLLECTIONS = [
  "captures",
  "interactions",
  "motion_samples",
  "responsive_samples",
  "runtime_observations",
  "technology_hypotheses",
  "accessibility_observations",
  "content_sources"
];

export async function readJson(file, cwd = process.cwd()) {
  const absolute = path.resolve(cwd, file);

  try {
    return JSON.parse(await fs.readFile(absolute, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read JSON: ${absolute}\n${error.message}`);
  }
}

export function formatSchemaErrors(errors = []) {
  return errors
    .map((error) => `  - ${error.instancePath || "/"}: ${error.message}`)
    .join("\n");
}

export function createValidator(schemas) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)])
  );
}

export function collectEvidenceIds(evidence) {
  const ids = new Set();

  for (const group of EVIDENCE_COLLECTIONS) {
    for (const item of evidence[group] || []) {
      if (item?.id) ids.add(item.id);
    }
  }

  return ids;
}

// Referential integrity: every reference points at recorded evidence.
export function checkEvidenceReferences(style, evidence) {
  const known = collectEvidenceIds(evidence);
  const issues = [];

  for (const observation of style.observations || []) {
    for (const ref of observation.evidence_refs || []) {
      if (!known.has(ref)) {
        issues.push(`${observation.path}: unknown evidence reference '${ref}'`);
      }
    }
  }

  return issues;
}

// GATE 1 — Support.
// An observation presented as observed or derived must carry evidence.
// Inferred, adaptive and unknown observations may stand without it: they do
// not claim to have been seen.
export function checkObservationSupport(style) {
  const issues = [];

  for (const observation of style.observations || []) {
    const supported = (observation.evidence_refs || []).length > 0;
    const claimsObservation =
      observation.mode === "exact" || observation.mode === "derived";

    if (claimsObservation && !supported) {
      issues.push(
        `${observation.path}: mode '${observation.mode}' without evidence_refs`
      );
      continue;
    }

    if (
      !supported &&
      typeof observation.confidence === "number" &&
      observation.confidence >= SUPPORT_THRESHOLD
    ) {
      issues.push(
        `${observation.path}: confidence ${observation.confidence} without evidence_refs`
      );
    }
  }

  return issues;
}

// GATE 2 — Substance.
// A contract that records nothing is not a contract.
export function checkNotEmpty(style, evidence) {
  const issues = [];

  if (!(style.observations || []).length) {
    issues.push("STYLE_DNA.observations is empty: nothing was recorded");
  }

  if (!(style.constraints?.must_preserve || []).length) {
    issues.push("STYLE_DNA.constraints.must_preserve is empty");
  }

  const recorded = EVIDENCE_COLLECTIONS.reduce(
    (total, group) => total + (evidence[group] || []).length,
    0
  );

  if (!recorded) {
    issues.push("REFERENCE_EVIDENCE records no observations of any kind");
  }

  return issues;
}

// GATE 3 — Coverage coherence.
// Declared coverage is written by the same agent that did the scan. It must
// be backed by what that scan actually recorded.
export function checkCoverageCoherence(style, evidence) {
  const issues = [];
  const coverage = evidence.coverage || {};
  const paths = (style.observations || []).map(
    (observation) => observation.path || ""
  );

  for (const [dimension, score] of Object.entries(coverage)) {
    if (typeof score !== "number" || score < SUPPORT_THRESHOLD) continue;

    const prefixes = COVERAGE_PATHS[dimension] || [dimension];
    const covered = paths.some((candidate) =>
      prefixes.some(
        (prefix) => candidate === prefix || candidate.startsWith(`${prefix}.`)
      )
    );

    if (!covered) {
      issues.push(
        `coverage.${dimension} is ${score} but no STYLE_DNA observation covers it`
      );
    }

    const collection = COVERAGE_COLLECTIONS[dimension];

    if (collection && !(evidence[collection] || []).length) {
      issues.push(
        `coverage.${dimension} is ${score} but REFERENCE_EVIDENCE.${collection} is empty`
      );
    }
  }

  return issues;
}

// GATE 4 — Salient claims are indexed.
// The thematic blocks are where a scan is tempting to over-write: they accept
// rich prose with a confidence attached and no trace of where it came from.
// Any claim the contract itself calls salient and confident must appear in
// `observations`, where gate 1 then demands evidence for it.
export function checkSalientClaimsIndexed(style) {
  const claims = [];

  const walk = (node, prefix) => {
    if (!node || typeof node !== "object") return;

    // A missing salience does not excuse a claim. Omitting a field must never
    // be cheaper than declaring one, or the gate teaches authors to write less.
    if (
      !Array.isArray(node) &&
      typeof node.confidence === "number" &&
      node.confidence >= SUPPORT_THRESHOLD &&
      (typeof node.salience !== "number" ||
        node.salience >= SUPPORT_THRESHOLD) &&
      prefix
    ) {
      claims.push({ prefix, id: node.id || null });
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "observations") continue;
      walk(value, Array.isArray(node) ? prefix : prefix ? `${prefix}.${key}` : key);
    }
  };

  walk(style, "");

  const indexed = (style.observations || []).map(
    (observation) => observation.path || ""
  );

  const issues = [];

  for (const claim of claims) {
    const covered = indexed.some(
      (candidate) =>
        candidate === claim.prefix || candidate.startsWith(`${claim.prefix}.`)
    );

    if (!covered) {
      issues.push(
        `${claim.prefix}${
          claim.id ? ` ('${claim.id}')` : ""
        }: salient claim missing from observations`
      );
    }
  }

  return issues;
}

// Blocks that describe the reference. Everything else in STYLE_DNA is
// metadata, synthesis or the observation index itself.
const CLAIM_BLOCKS = [
  "art_direction",
  "tokens",
  "layout",
  "typography",
  "components",
  "media",
  "interaction",
  "motion",
  "experience",
  "content_behavior",
  "responsive",
  "webgl"
];

// Keys that describe a claim rather than assert anything about the reference.
const META_KEYS = new Set([
  "confidence",
  "salience",
  "mode",
  "notes",
  "id",
  "source",
  "evidence_refs",
  "semantic_role"
]);

// Saying "unknown" is not a claim. It is the honest alternative to one.
const NON_CLAIMS = new Set(["unknown", "none", "n/a", "not observed", ""]);

function assertsSomething(node) {
  if (node === null || node === undefined) return false;

  if (Array.isArray(node)) return node.some(assertsSomething);

  if (typeof node === "object") {
    return Object.entries(node).some(
      ([key, value]) => !META_KEYS.has(key) && assertsSomething(value)
    );
  }

  if (typeof node === "string") {
    return !NON_CLAIMS.has(node.trim().toLowerCase());
  }

  if (typeof node === "number") return true;

  return node === true;
}

// GATE 5 — Claimed areas are backed.
//
// The gates above all read numbers the author wrote about their own work:
// confidence, salience, coverage. Anything driven by a self-reported score can
// be satisfied by reporting a lower score, which is why they were evadable —
// a contract asserting an exact typeface and a 12-column grid passed simply by
// declaring itself uncertain.
//
// This gate ignores the numbers. If a block asserts anything about the
// reference, that area needs at least one observation carrying evidence. The
// only ways through are to record where the claim came from, or to not make
// it.
export function checkClaimedAreasBacked(style) {
  const issues = [];

  const backed = (style.observations || []).filter(
    (observation) => (observation.evidence_refs || []).length > 0
  );

  for (const block of CLAIM_BLOCKS) {
    if (!(block in style)) continue;
    if (!assertsSomething(style[block])) continue;

    const covered = backed.some((observation) => {
      const path = observation.path || "";
      return path === block || path.startsWith(`${block}.`);
    });

    if (!covered) {
      issues.push(
        `${block}: asserts findings with no evidence-backed observation behind them`
      );
    }
  }

  return issues;
}

// Resuelve una ruta con puntos dentro del documento. Un segmento puede ser una
// clave de objeto o el `id` de un elemento de un arreglo, que es como el
// contrato guarda los componentes: `components.global-header.states`.
export function resolvePath(document, dottedPath) {
  let node = document;

  for (const segment of String(dottedPath).split(".")) {
    if (node && typeof node === "object" && !Array.isArray(node) && segment in node) {
      node = node[segment];
      continue;
    }

    if (Array.isArray(node)) {
      const match = node.find((item) => item && typeof item === "object" && item.id === segment);
      if (match !== undefined) {
        node = match;
        continue;
      }
    }

    return { found: false, stoppedAt: segment };
  }

  return { found: true, value: node };
}

// GATE 7 — Las observaciones apuntan a lo que el documento dice.
// `observations[].path` es la dirección que otros skills citan para justificar
// una decisión. Si no resuelve, el escáner afirmó algo que no escribió: el
// índice queda como una lista de etiquetas y quien cita no tiene dónde mirar.
//
// Incluye lo ausente. Observar que no hay video es un hallazgo, y el lugar de
// un hallazgo es el documento: se registra el dato y la observación lo señala.
export function checkObservationPathsResolve(style) {
  const issues = [];

  for (const observation of style.observations || []) {
    const { found, stoppedAt } = resolvePath(style, observation.path);
    if (!found) {
      issues.push(
        `${observation.path}: no resuelve en el documento (se corta en '${stoppedAt}')`
      );
    }
  }

  return issues;
}

export function verifyWebContracts(style, evidence, { strict = true } = {}) {
  const groups = [
    {
      label: "Evidence references resolve",
      issues: checkEvidenceReferences(style, evidence),
      strictOnly: false
    },
    {
      label: "Observations are supported",
      issues: checkObservationSupport(style),
      strictOnly: true
    },
    {
      label: "Contracts record substance",
      issues: checkNotEmpty(style, evidence),
      strictOnly: true
    },
    {
      label: "Declared coverage matches recorded evidence",
      issues: checkCoverageCoherence(style, evidence),
      strictOnly: true
    },
    {
      label: "Salient claims are indexed as observations",
      issues: checkSalientClaimsIndexed(style),
      strictOnly: true
    },
    {
      label: "Claimed areas are backed by evidence",
      issues: checkClaimedAreasBacked(style),
      strictOnly: true
    },
    {
      label: "Observation paths resolve in the document",
      issues: checkObservationPathsResolve(style),
      strictOnly: true
    }
  ];

  return groups.filter((group) => strict || !group.strictOnly);
}

export function reportGroups(groups) {
  let failed = false;

  for (const group of groups) {
    if (group.issues.length) {
      failed = true;
      console.error(`\n✗ ${group.label}`);
      for (const issue of group.issues) console.error(`  - ${issue}`);
    } else {
      console.log(`✓ ${group.label}`);
    }
  }

  return failed;
}
