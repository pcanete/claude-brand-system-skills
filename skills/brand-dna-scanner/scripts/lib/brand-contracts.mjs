// Verification logic for the brand contracts.
//
// The skill's central rule is that a single execution never becomes Brand DNA.
// These gates are that rule made executable.

import fs from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

// Shared with the evidence model: below 0.60 a claim is a weak inference.
export const SUPPORT_THRESHOLD = 0.6;

// A characteristic claimed as recurrent must have been seen in more than one
// place, or the word means nothing.
export const RECURRENCE_THRESHOLD = 0.6;
export const RECURRENCE_MIN_SOURCES = 2;

// Coverage dimensions map to the contract paths that can substantiate them.
const COVERAGE_PATHS = {
  core: ["core", "positioning", "personality", "semantic_territory"],
  verbal: ["verbal", "semantic_territory"],
  visual: ["visual", "illustration", "iconography", "cgi_3d"],
  photography: ["photography"],
  motion: ["motion"],
  web: ["web_experience", "ui"],
  content: ["content", "storytelling"],
  social: ["social"],
  campaigns: ["campaigns"],
  product: ["product_packaging"],
  environmental: ["environmental"],
  sonic: ["sonic"],
  behavior: ["behavior"],
  competitive: ["competitive"],
  temporal: ["temporal"]
};

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

function evidenceIndex(evidence) {
  return new Map(
    (evidence.evidence || [])
      .filter((item) => item?.id)
      .map((item) => [item.id, item])
  );
}

// Referential integrity: every reference points at recorded evidence.
export function checkEvidenceReferences(dna, evidence) {
  const known = evidenceIndex(evidence);
  const issues = [];

  const inspect = (node, label) => {
    for (const ref of node.evidence_refs || []) {
      if (!known.has(ref)) {
        issues.push(`${label}: unknown evidence reference '${ref}'`);
      }
    }
  };

  for (const observation of dna.observations || []) {
    inspect(observation, `observation:${observation.path}`);
  }

  for (const asset of dna.distinctive_assets || []) {
    inspect(asset, `asset:${asset.id}`);
  }

  return issues;
}

// GATE 1 — Support.
export function checkObservationSupport(dna) {
  const issues = [];

  for (const observation of dna.observations || []) {
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

  for (const asset of dna.distinctive_assets || []) {
    const strong =
      (asset.distinctiveness ?? 0) >= SUPPORT_THRESHOLD ||
      (asset.recurrence ?? 0) >= SUPPORT_THRESHOLD;

    if (strong && !(asset.evidence_refs || []).length) {
      issues.push(
        `asset:${asset.id}: claimed as owned or recurrent without evidence_refs`
      );
    }
  }

  return issues;
}

// GATE 2 — Substance.
export function checkNotEmpty(dna, evidence) {
  const issues = [];

  if (!(dna.observations || []).length) {
    issues.push("BRAND_DNA.observations is empty: nothing was recorded");
  }

  if (!(dna.rules?.must_preserve || []).length) {
    issues.push("BRAND_DNA.rules.must_preserve is empty");
  }

  if (!(evidence.sources || []).length) {
    issues.push("BRAND_EVIDENCE.sources is empty: no material was inventoried");
  }

  if (!(evidence.evidence || []).length) {
    issues.push("BRAND_EVIDENCE.evidence is empty: nothing was observed");
  }

  return issues;
}

// GATE 3 — Coverage coherence.
export function checkCoverageCoherence(dna) {
  const issues = [];
  const paths = (dna.observations || []).map(
    (observation) => observation.path || ""
  );

  for (const [dimension, score] of Object.entries(dna.coverage || {})) {
    if (typeof score !== "number" || score < SUPPORT_THRESHOLD) continue;

    const prefixes = COVERAGE_PATHS[dimension] || [dimension];
    const covered = paths.some((candidate) =>
      prefixes.some(
        (prefix) => candidate === prefix || candidate.startsWith(`${prefix}.`)
      )
    );

    if (!covered) {
      issues.push(
        `coverage.${dimension} is ${score} but no BRAND_DNA observation covers it`
      );
    }
  }

  return issues;
}

// GATE 4 — Salient claims are indexed.
export function checkSalientClaimsIndexed(dna) {
  const claims = [];

  const walk = (node, prefix) => {
    if (!node || typeof node !== "object") return;

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
      if (key === "observations" || key === "distinctive_assets") continue;
      walk(value, Array.isArray(node) ? prefix : prefix ? `${prefix}.${key}` : key);
    }
  };

  walk(dna, "");

  const indexed = (dna.observations || []).map(
    (observation) => observation.path || ""
  );

  return claims
    .filter(
      (claim) =>
        !indexed.some(
          (candidate) =>
            candidate === claim.prefix ||
            candidate.startsWith(`${claim.prefix}.`)
        )
    )
    .map(
      (claim) =>
        `${claim.prefix}${
          claim.id ? ` ('${claim.id}')` : ""
        }: salient claim missing from observations`
    );
}

// Blocks that assert something observed about the brand. Everything else is
// metadata, synthesis, or the observation index itself.
const CLAIM_BLOCKS = [
  "core",
  "positioning",
  "personality",
  "verbal",
  "semantic_territory",
  "visual",
  "photography",
  "illustration",
  "iconography",
  "cgi_3d",
  "motion",
  "web_experience",
  "ui",
  "content",
  "storytelling",
  "social",
  "campaigns",
  "product_packaging",
  "environmental",
  "sonic",
  "behavior",
  "temporal",
  "competitive"
];

const META_KEYS = new Set([
  "confidence",
  "salience",
  "recurrence",
  "consistency",
  "distinctiveness",
  "ownership_confidence",
  "mode",
  "notes",
  "id",
  "source",
  "evidence_refs"
]);

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

// GATE 6 — Claimed channels are backed.
//
// Every gate that reads a self-reported score — confidence, salience,
// coverage — can be satisfied by reporting a lower one. This gate ignores the
// numbers: if a channel asserts anything, that channel needs at least one
// observation carrying evidence. Describe the photography and you have to say
// where you saw it.
export function checkClaimedChannelsBacked(dna) {
  const issues = [];

  const backed = (dna.observations || []).filter(
    (observation) => (observation.evidence_refs || []).length > 0
  );

  for (const block of CLAIM_BLOCKS) {
    if (!(block in dna)) continue;
    if (!assertsSomething(dna[block])) continue;

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

// GATE 7 — Derived material is not observation.
//
// In a brand with any history, much of the available material is already a
// distillation of an earlier brand document: a voice guide generated from a
// dossier, a palette copied out of a manual. A scan that treats those as
// evidence recovers the document it came from and looks brilliant without
// having observed anything. It is the most flattering way for this skill to
// fail, which is why it needs a gate rather than a warning.
export function checkDerivedNotTreatedAsObservation(dna, evidence) {
  const known = evidenceIndex(evidence);
  const derived = new Set(
    (evidence.sources || [])
      .filter((source) => source.authority === "derived-internal")
      .map((source) => source.id)
  );

  if (!derived.size) return [];

  const issues = [];

  for (const observation of dna.observations || []) {
    if (observation.mode !== "exact" && observation.mode !== "derived") continue;

    const refs = observation.evidence_refs || [];
    if (!refs.length) continue;

    const sources = new Set();

    for (const ref of refs) {
      for (const source of known.get(ref)?.source_refs || []) {
        sources.add(source);
      }
    }

    if (!sources.size) continue;

    if ([...sources].every((source) => derived.has(source))) {
      issues.push(
        `${observation.path}: recorded as '${observation.mode}' but every source behind ` +
          "it is derived-internal — this restates an earlier document rather than " +
          "observing the brand"
      );
    }
  }

  return issues;
}

// GATE 5 — Recurrence is earned.
// This is the skill's founding rule in executable form: one spectacular
// execution is not Brand DNA. Anything claimed as recurrent must trace back
// to at least two distinct sources.
export function checkRecurrenceEarned(dna, evidence) {
  const known = evidenceIndex(evidence);
  const issues = [];

  const sourcesBehind = (refs = []) => {
    const sources = new Set();

    for (const ref of refs) {
      const item = known.get(ref);
      if (!item) continue;

      for (const source of item.source_refs || []) sources.add(source);
    }

    return sources;
  };

  const inspect = (node, label) => {
    if ((node.recurrence ?? 0) < RECURRENCE_THRESHOLD) return;

    const sources = sourcesBehind(node.evidence_refs);

    if (sources.size < RECURRENCE_MIN_SOURCES) {
      issues.push(
        `${label}: recurrence ${node.recurrence} supported by ${sources.size} source(s); ` +
          `${RECURRENCE_MIN_SOURCES} distinct sources required`
      );
    }
  };

  for (const asset of dna.distinctive_assets || []) {
    inspect(asset, `asset:${asset.id}`);
  }

  for (const observation of dna.observations || []) {
    inspect(observation, `observation:${observation.path}`);
  }

  return issues;
}

export function verifyBrandContracts(dna, evidence, { strict = true } = {}) {
  const groups = [
    {
      label: "Evidence references resolve",
      issues: checkEvidenceReferences(dna, evidence),
      strictOnly: false
    },
    {
      label: "Observations are supported",
      issues: checkObservationSupport(dna),
      strictOnly: true
    },
    {
      label: "Contracts record substance",
      issues: checkNotEmpty(dna, evidence),
      strictOnly: true
    },
    {
      label: "Declared coverage matches recorded observations",
      issues: checkCoverageCoherence(dna),
      strictOnly: true
    },
    {
      label: "Salient claims are indexed as observations",
      issues: checkSalientClaimsIndexed(dna),
      strictOnly: true
    },
    {
      label: "Claimed channels are backed by evidence",
      issues: checkClaimedChannelsBacked(dna),
      strictOnly: true
    },
    {
      label: "Derived material is not treated as observation",
      issues: checkDerivedNotTreatedAsObservation(dna, evidence),
      strictOnly: true
    },
    {
      label: "Recurrence is supported by multiple sources",
      issues: checkRecurrenceEarned(dna, evidence),
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
