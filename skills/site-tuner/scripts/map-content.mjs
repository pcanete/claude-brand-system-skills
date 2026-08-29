#!/usr/bin/env node

// Vincula el CONTENT_MANIFEST con la página renderizada: qué texto del
// contrato aparece en pantalla y dónde.
//
//   node scripts/map-content.mjs --manifest CONTENT_MANIFEST.json \
//     --url http://localhost:4321
//
//   --page <id>   página del manifiesto (por defecto, la primera)
//   --out <file>  guarda el mapeo en JSON
//
// No hace falta anotar los componentes: el texto del manifiesto es su propia
// señal. Si un campo aparece una vez en la página, queda vinculado sin
// ambigüedad y es editable. Si aparece dos veces o ninguna, se informa y no se
// ofrece para editar — adivinar cuál de los dos era llevaría a escribir en el
// contrato lo que nadie pidió.
//
// El reporte vale por sí solo: mide cuánto de la página sale realmente del
// manifiesto. Un campo que no aparece está hardcodeado, quedó viejo o su
// sección no se renderiza; un texto que nadie declaró no se puede editar sin
// tocar el código.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return process.argv[index + 1];
}

const TEXT_FIELDS = ['eyebrow', 'title', 'subtitle', 'body', 'cta', 'label', 'note', 'answer', 'question', 'items'];

// Guardan identificadores de archivo o de destino, no contenido editable.
const NOT_CONTENT = new Set(['media', 'assets', 'id', 'type', 'href', 'url', 'links', 'title_lines']);

/** Cada texto del manifiesto con la ruta exacta donde vive. */
export function collectTexts(manifest, pageId) {
  const pages = manifest.pages || {};
  const id = pageId || Object.keys(pages)[0];
  const page = pages[id];
  if (!page) throw new Error(`El manifiesto no tiene la página "${id}".`);

  const texts = [];

  const push = (route, value) => {
    if (typeof value === 'string' && value.trim().length > 1) {
      texts.push({ route, value: value.trim() });
    }
  };

  // Sólo se recorren campos de texto declarados. `media` y `assets` guardan
  // identificadores de archivo, no contenido: tratarlos como texto llenaba el
  // informe de ausencias que no significan nada.
  const walk = (node, route) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${route}[${index}]`));
      return;
    }

    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        // title_lines es composición, no contenido: lo afina el calibrador.
        if (NOT_CONTENT.has(key)) continue;
        if (TEXT_FIELDS.includes(key)) walk(value, `${route}.${key}`);
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
          walk(value, `${route}.${key}`);
        }
      }
      return;
    }

    push(route, node);
  };

  (page.sections || []).forEach((section, index) => {
    walk(section, `pages.${id}.sections[${index}]`);
  });

  return { pageId: id, texts };
}

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

async function main() {
  const manifestPath = arg('manifest', 'CONTENT_MANIFEST.json');
  const url = arg('url', 'http://localhost:4321');
  const outPath = arg('out', null);

  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8'));
  const { pageId, texts } = collectTexts(manifest, arg('page', null));

  const fromProject = createRequire(path.join(process.cwd(), 'noop.js'));
  let chromium;
  try {
    ({ chromium } = fromProject('playwright'));
  } catch {
    ({ chromium } = await import('playwright').catch(() => {
      throw new Error('Playwright no está disponible. Instalalo en el proyecto: npm i -D playwright');
    }));
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  let mapped;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    mapped = await page.evaluate((wanted) => {
      const clean = (value) => value.replace(/\s+/g, ' ').trim();

      // Sólo nodos que contienen texto propio: un contenedor que envuelve al
      // titular no es el titular.
      const candidates = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);

      while (walker.nextNode()) {
        const el = walker.currentNode;
        if (el.closest('[data-visual-tuner]')) continue;
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join(' ');
        const text = clean(own);
        if (text.length > 1) candidates.push({ el, text });
      }

      const describe = (el) => {
        const section = el.closest('section, header, footer, main');
        return {
          tag: el.tagName.toLowerCase(),
          section: section?.getAttribute('id') || section?.tagName.toLowerCase() || null,
        };
      };

      return wanted.map((item) => {
        // Una marca explícita gana sobre la coincidencia de texto: es la
        // salida para los casos que el texto no puede resolver — dos botones
        // que dicen lo mismo, o un campo que se renderiza de otra forma.
        const declared = document.querySelector(
          `[data-content-key="${item.route.replace(/"/g, '\\"')}"]`,
        );

        if (declared) {
          return { route: item.route, value: item.value, matches: 1, by: 'data-content-key', where: describe(declared) };
        }

        const hits = candidates.filter((c) => c.text === item.value);

        return {
          route: item.route,
          value: item.value,
          matches: hits.length,
          by: hits.length === 1 ? 'texto' : null,
          where: hits.length === 1 ? describe(hits[0].el) : null,
        };
      });
    }, texts.map(({ route, value }) => ({ route, value: normalize(value) })));
  } finally {
    await browser.close();
  }

  const linked = mapped.filter((item) => item.matches === 1);
  const missing = mapped.filter((item) => item.matches === 0);
  const ambiguous = mapped.filter((item) => item.matches > 1);

  console.log(`Página "${pageId}": ${texts.length} textos declarados en el manifiesto.\n`);
  console.log(`  vinculados sin ambigüedad : ${linked.length}`);
  console.log(`  no encontrados            : ${missing.length}`);
  console.log(`  ambiguos                  : ${ambiguous.length}`);

  if (missing.length) {
    console.log('\nDeclarados y ausentes de la página — hardcodeados, viejos o no renderizados:');
    for (const item of missing.slice(0, 12)) {
      console.log(`  ${item.route}\n    "${item.value.slice(0, 70)}"`);
    }
    if (missing.length > 12) console.log(`  … y ${missing.length - 12} más`);
  }

  if (ambiguous.length) {
    console.log('\nAparecen más de una vez — no se ofrecen para editar:');
    for (const item of ambiguous) {
      console.log(`  ${item.route} (${item.matches} veces): "${item.value.slice(0, 50)}"`);
    }
  }

  if (outPath) {
    await writeFile(
      path.resolve(outPath),
      `${JSON.stringify({ page: pageId, url, mapped }, null, 2)}\n`,
      'utf8',
    );
    console.log(`\nmapeo escrito: ${outPath}`);
  }

  const coverage = texts.length ? Math.round((linked.length / texts.length) * 100) : 0;
  console.log(`\n${coverage}% del contenido declarado es editable desde la página.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
