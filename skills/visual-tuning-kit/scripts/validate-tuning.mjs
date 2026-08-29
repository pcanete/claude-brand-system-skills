#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function arg(name) { const index = process.argv.indexOf(name); return index === -1 ? null : process.argv[index + 1]; }
async function json(file) { return JSON.parse(await fs.readFile(path.resolve(process.cwd(), file), "utf8")); }

function validValue(control, value) {
  if (control.kind === "range") return typeof value === "number" && Number.isFinite(value) && value >= control.min && value <= control.max;
  if (control.kind === "select") return typeof value === "string" && control.options.some((option) => option.value === value);
  if (control.kind === "boolean") return typeof value === "boolean";
  if (control.kind === "text") return typeof value === "string" && value.length <= control.max_length;
  if (control.kind === "text-lines") return Array.isArray(value) && value.length > 0 && value.every((line) => typeof line === "string") && value.join("\n").length <= control.max_length;
  if (control.kind === "image") return typeof value === "string" && value.startsWith(`${control.target.public_base}/`);
  if (control.kind === "section-order") {
    const allowed = control.options.map((option) => option.value);
    return Array.isArray(value) && value.length === allowed.length && new Set(value).size === allowed.length && value.every((item) => allowed.includes(item));
  }
  return false;
}

async function main() {
  const schemaFile=arg("--schema"), valuesFile=arg("--values"), allowDraft=process.argv.includes("--allow-draft");
  if(!schemaFile||!valuesFile) throw new Error("Usage: validate-tuning.mjs --schema TUNING_SCHEMA.json --values TUNING_VALUES.json [--allow-draft]");
  const [schema,values,schemaContract,valuesContract]=await Promise.all([json(schemaFile),json(valuesFile),json(path.join(root,"schemas","tuning-schema.schema.json")),json(path.join(root,"schemas","tuning-values.schema.json"))]);
  const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);
  for(const [label,data,contract] of [["TUNING_SCHEMA",schema,schemaContract],["TUNING_VALUES",values,valuesContract]]){const validate=ajv.compile(contract);if(!validate(data))throw new Error(`${label} invalid\n${validate.errors.map(error=>`  - ${error.instancePath||"/"}: ${error.message}`).join("\n")}`)}
  const issues=[],controls=schema.groups.flatMap(group=>group.controls),ids=new Set();
  for(const control of controls){if(ids.has(control.id))issues.push(`duplicate control '${control.id}'`);ids.add(control.id);if(!validValue(control,control.default))issues.push(`invalid default for '${control.id}'`);if(control.kind==="range"&&(!control.target.css_variable||control.min===undefined||control.max===undefined||control.step===undefined))issues.push(`range '${control.id}' requires css_variable, min, max and step`);if(["select","section-order"].includes(control.kind)&&!control.options)issues.push(`'${control.id}' requires options`);if(["text","text-lines"].includes(control.kind)&&(!control.target.content_path||!control.target.preview_id||!control.max_length))issues.push(`text control '${control.id}' requires content_path, preview_id and max_length`);if(control.kind==="image"&&(!control.target.content_path||!control.target.preview_id||!control.target.asset_folder||!control.target.public_base))issues.push(`image control '${control.id}' requires content_path, preview_id, asset_folder and public_base`);if(control.kind==="section-order"&&!control.target.container)issues.push(`section-order '${control.id}' requires a bounded container id`)}
  if(values.schema!==schema.id)issues.push("values.schema does not match schema.id");
  for(const key of Object.keys(values.values)){if(!ids.has(key))issues.push(`unknown value '${key}'`)}
  for(const control of controls){if(!(control.id in values.values))issues.push(`missing value '${control.id}'`);else if(!validValue(control,values.values[control.id]))issues.push(`invalid value '${control.id}'`)}
  if(!allowDraft){if(values.status!=="approved")issues.push("values.status must be approved");if(!values.approved_by)issues.push("approved_by is required");if(!values.approved_at)issues.push("approved_at is required")}
  if(issues.length)throw new Error(`Visual tuning gate failed\n${issues.map(issue=>`  - ${issue}`).join("\n")}`);
  console.log(`✓ Visual tuning contracts valid${allowDraft?" (draft allowed)":" and approved"}`);
}
main().catch(error=>{console.error(error.message);process.exit(1)});
