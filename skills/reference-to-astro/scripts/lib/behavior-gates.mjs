import { collectEvidenceIds } from "./web-contracts.mjs";

const SALIENT = 0.7;
const TEMPORAL_KINDS = new Set([
  "pointer-microinteraction",
  "touch-interaction",
  "stateful-component",
  "scroll-reactive",
  "scroll-linked",
  "continuous-motion",
  "page-transition",
  "media-interaction",
  "typography-microinteraction",
  "responsive-substitution"
]);

function deviceClass(viewport) {
  if (viewport?.device_class) return viewport.device_class;
  if (viewport?.width <= 480) return "mobile";
  if (viewport?.width >= 1024) return "desktop";
  return "tablet";
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function auditLabel(audit) {
  return `behavior_audits.${audit?.id || "<missing-id>"}`;
}

export function checkBehaviorAuditQuality(evidence) {
  const issues = [];
  const mode = evidence?.scan?.mode;
  const audits = evidence?.behavior_audits || [];
  const viewports = evidence?.viewports || [];
  const viewportById = new Map(viewports.map((viewport) => [viewport.id, viewport]));
  const knownEvidence = collectEvidenceIds(evidence);
  const behaviorCapable = [
    "pointer",
    "keyboard",
    "scroll",
    "temporal_sampling",
    "touch_emulation"
  ].some((capability) => evidence?.scan?.capabilities?.[capability] === true);
  const strictBehavior =
    mode === "forensic" || (mode === "standard" && behaviorCapable);

  if (strictBehavior && audits.length === 0) {
    issues.push(`${mode} scan requires REFERENCE_EVIDENCE.behavior_audits`);
    return issues;
  }

  if (mode === "forensic") {
    const declaredClasses = new Set(viewports.map(deviceClass));
    const auditedClasses = new Set(
      audits.map((audit) => deviceClass(viewportById.get(audit.viewport)))
    );

    for (const required of ["desktop", "mobile"]) {
      if (!declaredClasses.has(required)) {
        issues.push(`forensic scan requires a declared ${required} viewport`);
      } else if (!auditedClasses.has(required)) {
        issues.push(`forensic scan requires at least one ${required} behavior audit`);
      }
    }
  }

  for (const audit of audits) {
    const label = auditLabel(audit);
    const viewport = viewportById.get(audit.viewport);

    if (!viewport) {
      issues.push(`${label}: unknown viewport '${audit.viewport}'`);
      continue;
    }

    for (const ref of audit.evidence_refs || []) {
      if (!knownEvidence.has(ref)) {
        issues.push(`${label}: unknown evidence reference '${ref}'`);
      }
    }

    const salient = (audit.salience ?? 0) >= SALIENT;
    const temporal = TEMPORAL_KINDS.has(audit.behavior_kind);
    const samples = audit.samples || [];

    if (mode === "forensic" && salient && !(audit.evidence_refs || []).length) {
      issues.push(`${label}: salient forensic audit requires evidence_refs`);
    }

    if (mode === "forensic" && salient && temporal) {
      if (samples.length < 5) {
        issues.push(`${label}: salient temporal audit requires at least 5 samples`);
      }

      const timestamps = samples.map((sample) => sample.timestamp_ms);
      if (new Set(timestamps).size < Math.min(5, samples.length)) {
        issues.push(`${label}: temporal samples require distinct timestamps`);
      }

      const phases = new Set(samples.map((sample) => sample.phase));
      if (!phases.has("before") && !phases.has("idle")) {
        issues.push(`${label}: temporal samples require a before or idle phase`);
      }
      if (!phases.has("after")) {
        issues.push(`${label}: temporal samples require an after phase`);
      }

      if (audit.classification?.reversible === true) {
        if (audit.reverse_tested !== true || !phases.has("reverse")) {
          issues.push(`${label}: reversible behavior requires a reverse test and sample`);
        }
      }
    }

    if (mode === "forensic" && salient && audit.behavior_kind === "scroll-reactive") {
      const probe = audit.threshold_probe || {};
      if (!hasOwn(probe, "below") || !hasOwn(probe, "above")) {
        issues.push(`${label}: scroll-reactive behavior requires below/above threshold probes`);
      }
      if (audit.reverse_tested !== true) {
        issues.push(`${label}: scroll-reactive behavior requires reverse threshold testing`);
      }
    }

    if (
      mode === "forensic" &&
      salient &&
      (audit.behavior_kind === "continuous-motion" ||
        (audit.behavior_kind === "scroll-linked" && audit.moving_track === true))
    ) {
      const profile = audit.velocity_profile || {};
      if (audit.idle_tested !== true) {
        issues.push(`${label}: moving track requires an idle test`);
      }
      if (audit.reverse_tested !== true) {
        issues.push(`${label}: moving track requires a reverse-input test`);
      }
      if ((profile.sample_count || 0) < 5) {
        issues.push(`${label}: velocity_profile.sample_count must be at least 5`);
      }
      if (!profile.direction_forward || !profile.direction_reverse) {
        issues.push(`${label}: velocity profile requires forward and reverse directions`);
      }
      if (profile.dependency_tested !== true) {
        issues.push(`${label}: velocity profile must test input dependency`);
      }
    }

    if (
      mode === "forensic" &&
      salient &&
      audit.behavior_kind === "typography-microinteraction"
    ) {
      const probe = audit.text_probe || {};
      if (!probe.initial_text || !hasOwn(probe, "final_text") || !probe.mutation_kind) {
        issues.push(`${label}: text_probe requires initial_text, final_text and mutation_kind`);
      }
      if (
        probe.mutation_kind === "character-content" &&
        (!Array.isArray(probe.frame_texts) || probe.frame_texts.length < 3)
      ) {
        issues.push(`${label}: character-content mutation requires at least 3 frame_texts`);
      }
    }

    if (
      mode === "forensic" &&
      salient &&
      deviceClass(viewport) === "mobile" &&
      evidence?.scan?.capabilities?.touch_emulation === true
    ) {
      const inputs = new Set(audit.device_context?.input_modes || []);
      if (audit.touch_tested !== true || !inputs.has("touch")) {
        issues.push(`${label}: mobile audit must exercise touch when touch emulation is available`);
      }
    }

    if (
      mode === "forensic" &&
      salient &&
      temporal &&
      evidence?.scan?.capabilities?.reduced_motion_emulation === true &&
      audit.reduced_motion_tested !== true
    ) {
      issues.push(`${label}: reduced-motion behavior was not tested despite available capability`);
    }
  }

  return issues;
}
