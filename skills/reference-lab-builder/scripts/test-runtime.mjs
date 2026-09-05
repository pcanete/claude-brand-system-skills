#!/usr/bin/env node

import assert from "node:assert/strict";
import { demoMarkup, renderDemo } from "./build-lab.mjs";
import { resolvePath } from "./lib/contract-path.mjs";

const marquee = demoMarkup({
  kind: "marquee",
  config: { items: ["One", "Two", "Three"], speed_px_s: 302 }
});

const demo = {id:"type",title:"Type",note:"",kind:"typography",config:{},source_paths:["typography"],evidence_refs:["capture"]};
assert.match(renderDemo(demo,{typography:{}},new Set(["capture"])), /Sin observación/);
assert.match(renderDemo(demo,{typography:{},observations:[{path:"typography",mode:"exact",evidence_refs:["capture"]}]},new Set(["capture"])), /data-support="1\/1"/);
assert.match(marquee, /data-speed-px-s="302"/);
assert.match(marquee, /--duration:3\.497s/);

const typography = demoMarkup({
  kind: "typography",
  config: {
    items: ["Display", "Headline", "Subhead", "Body", "Label"],
    sizes_px: [133.594, 59.375, 24, 16, 10.391],
    line_height_px: [120, 56, 28, 22, 12],
    tracking_px: [-4, -2, -0.5, 0, 0.2]
  }
});
assert.equal((typography.match(/class="type-level"/g) || []).length, 5);
assert.match(typography, /59\.375px · 2\.25×/);
assert.match(typography, /line-height:120px/);

const adaptiveType = demoMarkup({ kind: "typography", config: { items: ["Display", "Label"] } });
assert.match(adaptiveType, /data-scale="adaptive"/);
assert.match(adaptiveType, /clamp\(0\.72rem/);

const parallax = demoMarkup({
  kind: "parallax",
  config: { items: ["Near", "Middle", "Far"], ratios: [0.22, -0.1, 0.05] }
});
assert.equal((parallax.match(/data-ratio=/g) || []).length, 3);
assert.match(parallax, /data-ratios="measured"/);
assert.match(parallax, /data-ratio="-0\.100"/);

const adaptiveParallax = demoMarkup({ kind: "parallax", config: { items: ["Near", "Far"] } });
assert.match(adaptiveParallax, /data-ratios="adaptive"/);

const contract = { components: [{ id: "global-header", states: { compact: true } }] };
assert.equal(resolvePath(contract, "components.global-header.states.compact").value, true);
assert.equal(resolvePath(contract, "components.missing.states").found, false);

console.log("Reference lab runtime tests passed.");
