import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {checkEvidenceGraph, checkEvidenceFiles, checkBehaviorInventory, evidenceIds}
  from "../skills/reference-scanner/scripts/lib/evidence-integrity.mjs";
import {checkPhpSyntax} from "../skills/wordpress-publisher/scripts/php-syntax.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
for (const skill of ["reference-to-astro","reference-lab-builder"]) {
  assert.equal(await fs.readFile(path.join(root,"skills",skill,"scripts/lib/evidence-integrity.mjs"),"utf8"),
    await fs.readFile(path.join(root,"skills/reference-scanner/scripts/lib/evidence-integrity.mjs"),"utf8"));
}
const tmp = await fs.mkdtemp(path.join(os.tmpdir(),"evidence-integrity-"));
try {
  const artifact = '{"time":0,"state":"closed"}';
  await fs.writeFile(path.join(tmp,"capture.json"), artifact);
  const evidence = {
    scan:{mode:"standard",validation_profile:"behavior-evidence/1"},
    routes:[{path:"/"}], viewports:[{id:"desktop"}],
    captures:[{id:"cap",artifact:"capture.json",sha256:createHash("sha256").update(artifact).digest("hex")}],
    behavior_audits:[{id:"audit",route:"/",viewport:"desktop",evidence_refs:["cap"],
      samples:[{timestamp_ms:0},{timestamp_ms:100}]}],
    behavior_inventory:[{id:"menu",route:"/",target:"nav",critical:true,status:"observed",
      viewports:["desktop"],audit_refs:["audit"],notes:"Open and close inspected."}]
  };
  assert(evidenceIds(evidence).has("audit"));
  assert.deepEqual(checkEvidenceGraph(evidence),[]);
  assert.deepEqual(checkBehaviorInventory(evidence),[]);
  assert.deepEqual(await checkEvidenceFiles(evidence,tmp),[]);
  const broken = structuredClone(evidence);
  broken.behavior_audits[0].evidence_refs = ["audit"];
  assert(checkEvidenceGraph(broken).some(x=>x.includes("cyclic")));
  broken.behavior_audits[0].evidence_refs = ["missing"];
  assert(checkEvidenceGraph(broken).some(x=>x.includes("unknown")));
  broken.captures.push({...broken.captures[0]});
  assert(checkEvidenceGraph(broken).some(x=>x.includes("duplicate")));
  const pending = structuredClone(evidence);
  pending.behavior_inventory[0].status = "not-tested";
  assert(checkBehaviorInventory(pending).some(x=>x.includes("unresolved")));
  const untestedViewport = structuredClone(evidence);
  untestedViewport.viewports.push({id:"mobile"});
  untestedViewport.behavior_inventory[0].viewports.push("mobile");
  assert(checkBehaviorInventory(untestedViewport).some(x=>x.includes("missing audit")));
  const clock = structuredClone(evidence);
  clock.behavior_audits[0].samples[1].timestamp_ms = 0;
  assert(checkBehaviorInventory(clock).some(x=>x.includes("clock")));
  await fs.writeFile(path.join(tmp,"capture.json"),"tampered");
  assert((await checkEvidenceFiles(evidence,tmp)).some(x=>x.includes("hash")));
  await fs.unlink(path.join(tmp,"capture.json"));
  assert((await checkEvidenceFiles(evidence,tmp)).some(x=>x.includes("unreadable")));
  const unpersisted = {captures:[{id:"cap",artifact:"",persistence:"not-persisted",notes:"Browser output was not saved."}]};
  assert.deepEqual(await checkEvidenceFiles(unpersisted,tmp),[]);
  unpersisted.captures[0].artifact = "imaginary.png";
  assert((await checkEvidenceFiles(unpersisted,tmp)).length);
  await fs.writeFile(path.join(tmp,"valid.php"),'<?php echo "ok"; ?>');
  assert.deepEqual(await checkPhpSyntax(tmp),[]);
  await fs.writeFile(path.join(tmp,"broken.php"),"<?php echo ; ?>");
  assert((await checkPhpSyntax(tmp)).some(x=>x.includes("broken.php")));
  console.log("Evidence graph, artifacts, initial inventory, shared consumers and real PHP lint verified.");
} finally { await fs.rm(tmp,{recursive:true,force:true}); }
