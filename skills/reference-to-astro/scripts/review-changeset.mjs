#!/usr/bin/env node

// Traduce lo que un editor HTML externo devolvió, en un changeset por ancla.
//
//   node scripts/review-changeset.mjs --original dist/index.html \
//     --edited revision/edited.html --out REVIEW_CHANGESET.json
//
//   --ignore-classes is-compact,is-open   vocabulario de runtime del proyecto
//   --ignore-attributes data-ready
//
// La exportación de un editor externo es evidencia de revisión, no código
// fuente: `references/stable-review-anchors.md`. Este script hace la única parte
// mecánica de esa traducción —decir qué cambió y dónde— para que la decisión de
// cómo aplicarlo al componente la tome una persona.
//
// Dos cosas hacen que el diff crudo no sirva:
//
// 1. El editor serializa el DOM vivo, así que hornea el estado momentáneo del
//    sitio —clases de transición, atributos que escriben los scripts al
//    inicializar, estilos inline del scroll— como si fuera markup escrito.
// 2. El navegador normaliza el HTML al parsearlo, y esa diferencia aparece en
//    todo el documento aunque nadie haya tocado nada.
//
// Por eso se compara por `data-rta-id`, y lo que no se puede atribuir a un
// ancla se informa aparte en vez de adivinarlo. Un número alto ahí significa
// que faltan anclas en el build, no que el editor haya hecho algo raro.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

// Un atributo o clase que aparece de golpe en muchos elementos es estado de
// runtime, no una edición: nadie toca doce elementos para poner lo mismo.
const RUNTIME_SPREAD = 3;

// La frecuencia no alcanza cuando el estado vive en un solo elemento —un header
// que se compacta, un ítem marcado como activo—. Ahí lo único disponible es la
// convención de nombres, que es una pista y no una prueba: se marca la entrada
// y se deja que la lea una persona, en vez de descartarla en silencio.
const STATE_LIKE = /^(is|has|was|being)-[a-z0-9-]+$/;

// Un proyecto puede declarar su propio vocabulario de runtime y entonces no
// hace falta adivinar nada.
const declaredList = (name) =>
  new Set((arg(name, '') || '').split(',').map((item) => item.trim()).filter(Boolean));

/** Lee el documento con JavaScript apagado: parsear no debe ejecutar el sitio. */
async function inspect(browser, html) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const data = await page.evaluate(() => {
    const anchors = {};
    for (const element of document.querySelectorAll('[data-rta-id]')) {
      const id = element.dataset.rtaId;
      anchors[id] = {
        tag: element.tagName.toLowerCase(),
        text: element.textContent.replace(/\s+/g, ' ').trim(),
        attributes: Object.fromEntries(
          [...element.attributes].map((attribute) => [attribute.name, attribute.value])
        ),
        classes: [...element.classList].sort()
      };
    }

    // Inventario de todo el documento, para separar estado de runtime.
    const attributeUse = {};
    const classUse = {};
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        attributeUse[attribute.name] = (attributeUse[attribute.name] || 0) + 1;
      }
      for (const name of element.classList) classUse[name] = (classUse[name] || 0) + 1;
    }

    const styleBlocks = [...document.querySelectorAll('style')].map((element) => ({
      id: element.id || null,
      css: element.textContent || ''
    }));

    return { anchors, attributeUse, classUse, styleBlocks, elements: document.querySelectorAll('*').length };
  });

  await context.close();
  return data;
}

/** Reglas de un bloque CSS, sin necesidad de un parser completo. */
export function parseRules(css) {
  const rules = [];
  for (const match of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;

    const declarations = {};
    for (const piece of match[2].split(';')) {
      const at = piece.indexOf(':');
      if (at === -1) continue;
      const property = piece.slice(0, at).trim();
      const value = piece.slice(at + 1).trim();
      if (property && value) declarations[property] = value;
    }

    if (Object.keys(declarations).length) rules.push({ selector, declarations });
  }
  return rules;
}

export function buildChangeset(before, after, declared = { attributes: new Set(), classes: new Set() }) {
  // Estado de runtime: presente en el editado, ausente en el original, repartido
  // por muchos elementos.
  const runtimeAttributes = new Set();
  for (const [name, count] of Object.entries(after.attributeUse)) {
    if (!before.attributeUse[name] && count >= RUNTIME_SPREAD) runtimeAttributes.add(name);
  }
  for (const name of declared.attributes) runtimeAttributes.add(name);

  const runtimeClasses = new Set();
  for (const [name, count] of Object.entries(after.classUse)) {
    if (!before.classUse[name] && count >= RUNTIME_SPREAD) runtimeClasses.add(name);
  }
  for (const name of declared.classes) runtimeClasses.add(name);

  const text = [];
  const attributes = [];
  const missing = [];

  for (const [id, was] of Object.entries(before.anchors)) {
    const now = after.anchors[id];
    if (!now) {
      missing.push(id);
      continue;
    }

    if (was.text !== now.text) text.push({ anchor: id, before: was.text, after: now.text });

    const names = new Set([...Object.keys(was.attributes), ...Object.keys(now.attributes)]);
    for (const name of names) {
      if (name === 'class' || runtimeAttributes.has(name)) continue;
      if (was.attributes[name] === now.attributes[name]) continue;
      attributes.push({
        anchor: id,
        attribute: name,
        before: was.attributes[name] ?? null,
        after: now.attributes[name] ?? null
      });
    }

    const classesBefore = was.classes.filter((name) => !runtimeClasses.has(name));
    const classesAfter = now.classes.filter((name) => !runtimeClasses.has(name));
    if (classesBefore.join(' ') !== classesAfter.join(' ')) {
      const added = classesAfter.filter((name) => !classesBefore.includes(name));
      const removed = classesBefore.filter((name) => !classesAfter.includes(name));
      const suspected = [...added, ...removed].filter((name) => STATE_LIKE.test(name));

      attributes.push({
        anchor: id,
        attribute: 'class',
        before: classesBefore.join(' '),
        after: classesAfter.join(' '),
        ...(suspected.length ? { suspected_runtime: suspected } : {})
      });
    }
  }

  // CSS: reglas que el editor agregó o cambió respecto de lo que ya había.
  const existing = new Map();
  for (const block of before.styleBlocks) {
    for (const rule of parseRules(block.css)) existing.set(rule.selector, rule.declarations);
  }

  const css = [];
  for (const block of after.styleBlocks) {
    for (const rule of parseRules(block.css)) {
      const had = existing.get(rule.selector);
      const changed = {};
      for (const [property, value] of Object.entries(rule.declarations)) {
        if (!had || had[property] !== value) changed[property] = value;
      }
      if (Object.keys(changed).length) {
        css.push({ selector: rule.selector, declarations: changed, from_block: block.id });
      }
    }
  }

  return {
    version: '0.1',
    text,
    attributes,
    css,
    missing_anchors: missing,
    ignored_runtime_state: {
      attributes: [...runtimeAttributes].sort(),
      classes: [...runtimeClasses].sort()
    },
    coverage: {
      anchors: Object.keys(before.anchors).length,
      elements_before: before.elements,
      elements_after: after.elements,
      anchored_share: Object.keys(before.anchors).length / before.elements
    }
  };
}

async function main() {
  const originalFile = arg('original');
  const editedFile = arg('edited');
  if (!originalFile || !editedFile) {
    throw new Error(
      'Uso: review-changeset.mjs --original dist/index.html --edited revision/edited.html [--out REVIEW_CHANGESET.json]'
    );
  }

  const [originalHtml, editedHtml] = await Promise.all([
    readFile(path.resolve(originalFile), 'utf8'),
    readFile(path.resolve(editedFile), 'utf8')
  ]);

  const browser = await chromium.launch();
  let changeset;
  try {
    const [before, after] = await Promise.all([
      inspect(browser, originalHtml),
      inspect(browser, editedHtml)
    ]);
    changeset = buildChangeset(before, after, {
      attributes: declaredList('ignore-attributes'),
      classes: declaredList('ignore-classes')
    });
  } finally {
    await browser.close();
  }

  const line = (label, items) => `${label}: ${items.length}`;
  console.log(line('Textos cambiados', changeset.text));
  for (const item of changeset.text) {
    console.log(`  ${item.anchor}\n    antes: ${item.before.slice(0, 70)}\n    ahora: ${item.after.slice(0, 70)}`);
  }

  console.log(line('\nAtributos cambiados', changeset.attributes));
  for (const item of changeset.attributes) {
    const nota = item.suspected_runtime
      ? `  ← ${item.suspected_runtime.join(', ')} parece estado, no una edición`
      : '';
    console.log(`  ${item.anchor} · ${item.attribute}: ${item.before} → ${item.after}${nota}`);
  }

  console.log(line('\nReglas CSS nuevas o cambiadas', changeset.css));
  for (const rule of changeset.css) {
    console.log(`  ${rule.selector}`);
    for (const [property, value] of Object.entries(rule.declarations)) {
      console.log(`    ${property}: ${value};`);
    }
  }

  const ignored = changeset.ignored_runtime_state;
  if (ignored.attributes.length || ignored.classes.length) {
    console.log('\nEstado de runtime ignorado — lo escribió el sitio, no quien editó:');
    if (ignored.attributes.length) console.log(`  atributos: ${ignored.attributes.join(', ')}`);
    if (ignored.classes.length) console.log(`  clases: ${ignored.classes.join(', ')}`);
  }

  if (changeset.missing_anchors.length) {
    console.log(`\nAnclas que desaparecieron: ${changeset.missing_anchors.join(', ')}`);
  }

  const share = (changeset.coverage.anchored_share * 100).toFixed(1);
  console.log(
    `\n${changeset.coverage.anchors} anclas sobre ${changeset.coverage.elements_before} elementos (${share}%).` +
      '\nLo que ocurra fuera de un ancla no se puede atribuir: si falta algo que esperabas ver,' +
      '\nfalta un `data-rta-id` en el build, no en el editor.'
  );

  const out = arg('out', null);
  if (out) {
    await writeFile(path.resolve(out), `${JSON.stringify(changeset, null, 2)}\n`, 'utf8');
    console.log(`\nchangeset escrito: ${out}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
