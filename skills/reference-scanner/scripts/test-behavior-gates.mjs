#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkBehaviorAuditQuality } from "./lib/behavior-gates.mjs";
import { createValidator, formatSchemaErrors } from "./lib/web-contracts.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const samples = ["before", "early", "middle", "late", "after", "reverse"].map(
  (phase, index) => ({ phase, timestamp_ms: index * 100, state: {} })
);

const audit = (id, viewport, behavior_kind, extra = {}) => ({
  id,
  route: "/",
  viewport,
  behavior_kind,
  target: "representative target",
  input_sequence: [{ action: "test" }],
  samples,
  classification: {
    activation_model: "state-driven",
    reversible: true
  },
  reverse_tested: true,
  reduced_motion_tested: true,
  evidence_refs: ["interaction-1"],
  confidence: 0.95,
  salience: 0.9,
  ...extra
});

const valid = {
  version: "0.4",
  reference: { url: "https://example.invalid/" },
  scan: {
    mode: "forensic",
    capabilities: {
      touch_emulation: true,
      reduced_motion_emulation: true
    }
  },
  viewports: [
    { id: "desktop", width: 1440, height: 900, device_class: "desktop" },
    {
      id: "mobile",
      width: 390,
      height: 844,
      device_class: "mobile",
      input_modes: ["touch"]
    }
  ],
  captures: [],
  routes: [
    {
      path: "/",
      family: "home",
      importance: "primary",
      scan_status: "complete"
    }
  ],
  interactions: [
    {
      id: "interaction-1",
      route: "/",
      action: "representative interaction",
      confidence: 0.95
    }
  ],
  motion_samples: [],
  responsive_samples: [],
  behavior_audits: [
    audit("header-desktop", "desktop", "scroll-reactive", {
      threshold_probe: { below: 40, above: 41 }
    }),
    audit("menu-mobile", "mobile", "touch-interaction", {
      device_context: { input_modes: ["touch"] },
      touch_tested: true
    })
  ],
  coverage: {
    visual: 0.8,
    typography: 0.8,
    layout: 0.8,
    media: 0.7,
    interaction: 0.9,
    motion: 0.8,
    responsive: 0.9,
    transition: 0.4,
    webgl: 0.4
  },
  limitations: []
};

assert.deepEqual(checkBehaviorAuditQuality(valid), []);

const finiteScrollReveal = audit(
  "finite-scroll-reveal",
  "desktop",
  "scroll-linked",
  {
    moving_track: false,
    classification: {
      activation_model: "scroll-linked",
      reversible: true
    }
  }
);
assert.deepEqual(
  checkBehaviorAuditQuality({ ...valid, behavior_audits: [finiteScrollReveal, valid.behavior_audits[1]] }),
  []
);

const missingTrackProfile = {
  ...finiteScrollReveal,
  id: "moving-track-without-profile",
  moving_track: true
};
assert.match(
  checkBehaviorAuditQuality({ ...valid, behavior_audits: [missingTrackProfile, valid.behavior_audits[1]] }).join("\n"),
  /velocity_profile\.sample_count/
);

const evidenceSchema = JSON.parse(
  fs.readFileSync(
    path.resolve(scriptDir, "../schemas/reference-evidence.schema.json"),
    "utf8"
  )
);
const validateEvidence = createValidator({ evidence: evidenceSchema }).evidence;
const schemaValid = validateEvidence(valid);
assert.equal(
  schemaValid,
  true,
  schemaValid ? "" : formatSchemaErrors(validateEvidence.errors)
);

const invalid = structuredClone(valid);
invalid.behavior_audits = [
  {
    ...invalid.behavior_audits[0],
    samples: invalid.behavior_audits[0].samples.slice(0, 2),
    reverse_tested: false,
    threshold_probe: {}
  }
];

const issues = checkBehaviorAuditQuality(invalid).join("\n");
assert.match(issues, /mobile behavior audit/);
assert.match(issues, /at least 5 samples/);
assert.match(issues, /below\/above threshold probes/);
assert.match(issues, /reverse/);

console.log("Behavior gate tests passed.");
