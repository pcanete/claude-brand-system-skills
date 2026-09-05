import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Dependency-free: shipped identically with scanner, lab and Astro.
export const EVIDENCE_PROFILE = "behavior-evidence/1";
export const collections = ["captures", "interactions", "motion_samples",
  "responsive_samples", "runtime_observations", "technology_hypotheses",
  "accessibility_observations", "content_sources", "behavior_audits"];
export const evidenceItems = (evidence) => collections.flatMap(key => evidence[key] || []);
export const evidenceIds = (evidence) => new Set(evidenceItems(evidence).map(x => x.id).filter(Boolean));

export function checkEvidenceGraph(evidence) {
  const issues = [];
  const items = evidenceItems(evidence);
  const byId = new Map();
  for (const item of items) {
    if (!item.id) continue;
    if (byId.has(item.id)) issues.push("duplicate evidence id: " + item.id);
    byId.set(item.id, item);
  }
  const edges = item => [...(item.evidence_refs || []),
    item.before_capture, item.after_capture,
    ...(item.samples || []).map(s => s.capture_ref)].filter(Boolean);
  const active = new Set(), visited = new Set();
  function visit(id) {
    if (active.has(id)) { issues.push("cyclic evidence: " + id); return; }
    if (visited.has(id)) return;
    active.add(id);
    for (const ref of edges(byId.get(id))) {
      if (!byId.has(ref)) issues.push(id + ": unknown evidence reference " + ref);
      else visit(ref);
    }
    active.delete(id); visited.add(id);
  }
  for (const id of byId.keys()) visit(id);
  return issues;
}

export async function checkEvidenceFiles(evidence, baseDir) {
  const issues = [];
  const profile = evidence.scan?.validation_profile;
  if (profile && profile !== EVIDENCE_PROFILE) issues.push("unsupported validation profile: " + profile);
  const base = await fs.realpath(baseDir);
  for (const item of evidence.captures || []) {
    if (item.persistence === "not-persisted") {
      if (!item.notes?.trim()) issues.push(item.id + ": unpersisted observation requires a reason");
      if (item.artifact) issues.push(item.id + ": unpersisted observation must not claim an artifact");
      continue;
    }
    if (!item.artifact) { issues.push(item.id + ": missing artifact"); continue; }
    if (/^[a-z]+:\/\//i.test(item.artifact)) {
      issues.push(item.id + ": save remote evidence locally before handoff"); continue;
    }
    const target = path.resolve(base, item.artifact);
    try {
      const resolved = await fs.realpath(target);
      const relative = path.relative(base, resolved);
      if (relative.startsWith(".." + path.sep) || relative === ".." || path.isAbsolute(relative)) {
        issues.push(item.id + ": artifact leaves evidence directory"); continue;
      }
      const info = await fs.stat(resolved);
      if (!info.isFile() || info.size === 0) {
        issues.push(item.id + ": artifact must be a nonempty file"); continue;
      }
      if (profile === EVIDENCE_PROFILE && !/^[a-f0-9]{64}$/i.test(item.sha256 || "")) {
        issues.push(item.id + ": persisted evidence requires sha256"); continue;
      }
      if (item.sha256) {
        const hash = createHash("sha256").update(await fs.readFile(resolved)).digest("hex");
        if (hash !== item.sha256.toLowerCase()) issues.push(item.id + ": artifact hash mismatch");
      }
    } catch (error) { issues.push(item.id + ": unreadable artifact (" + error.code + ")"); }
  }
  return issues;
}

export function checkBehaviorInventory(evidence) {
  const issues = [];
  if (evidence.scan?.validation_profile !== EVIDENCE_PROFILE) return issues;
  const inventory = evidence.behavior_inventory;
  if (!Array.isArray(inventory) || !inventory.length) return ["behavior inventory is required by " + EVIDENCE_PROFILE];
  const ids = new Set();
  const audits = new Map((evidence.behavior_audits || []).map(a => [a.id, a]));
  const byId = new Map(evidenceItems(evidence).map(item => [item.id, item]));
  const persisted = new Set((evidence.captures || []).filter(c => c.artifact && c.persistence !== "not-persisted").map(c => c.id));
  function hasCapture(id, seen = new Set()) {
    if (persisted.has(id)) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    const item = byId.get(id);
    return (item?.evidence_refs || []).some(ref => hasCapture(ref, seen));
  }
  const routes = new Set((evidence.routes || []).map(r => r.path));
  const viewports = new Set((evidence.viewports || []).map(v => v.id));
  for (const entry of inventory) {
    const label = "behavior_inventory." + (entry.id || "<missing>");
    if (!entry.id || ids.has(entry.id)) issues.push(label + ": missing or duplicate id");
    ids.add(entry.id);
    if (!entry.target || !routes.has(entry.route)) issues.push(label + ": target and declared route required");
    if (!["observed", "absent", "blocked", "not-tested"].includes(entry.status)) issues.push(label + ": invalid status");
    if (!entry.notes?.trim()) issues.push(label + ": record the observation or limitation");
    if (!Array.isArray(entry.viewports) || !entry.viewports.length ||
        entry.viewports.some(id => !viewports.has(id))) issues.push(label + ": declared viewports required");
    const refs = entry.audit_refs || [];
    for (const id of refs) if (!audits.has(id)) issues.push(label + ": unknown audit " + id);
    if (entry.status === "observed") {
      if (entry.critical === true && refs.some(id => !hasCapture(id))) issues.push(label + ": critical audit has no persisted capture");
      for (const viewport of entry.viewports || []) {
        if (!refs.some(id => audits.get(id)?.viewport === viewport && audits.get(id)?.route === entry.route)) {
          issues.push(label + ": missing audit for " + viewport);
        }
      }
    }
    if (entry.critical === true && ["blocked", "not-tested"].includes(entry.status)) {
      issues.push(label + ": critical behavior unresolved; handoff remains incomplete");
    }
    if (entry.status === "absent" && !(entry.evidence_refs || []).some(id => hasCapture(id))) {
      issues.push(label + ": absence must cite a persisted observation");
    }
  }
  for (const audit of audits.values()) {
    const timestamps = (audit.samples || []).map(s => s.timestamp_ms);
    if (timestamps.some((t, i) => i > 0 && t <= timestamps[i - 1])) issues.push(audit.id + ": samples must follow a strictly increasing clock");
    if (!(audit.evidence_refs || []).length) issues.push(audit.id + ": link an audit to captured evidence");
  }
  return issues;
}
