#!/usr/bin/env node

// Mide qué le haría a la portada admitir una hoja de estilos ajena.
//
//   node scripts/audit-foreign-css.mjs \
//     https://sitio.com/wp-content/plugins/elementor/assets/css/frontend.min.css
//
//   --body-classes elementor-kit-8,otra
//                         clases que lleva el <body>: una regla acotada a una
//                         de ellas alcanza la pagina entera
//   --scope .elementor    prefijo bajo el que la hoja deberia acotarse
//                         (si no se da, se infiere del nombre del archivo)
//   --json                salida para automatizar
//
// La portada compilada reemplaza la pagina entera, asi que por defecto no entra
// ningun CSS del sitio. Pero sigue alojando componentes de WordPress a
// proposito -un popup, un banner de consentimiento, un chat- y esos necesitan
// su hoja.
//
// La pregunta no es si el plugin es confiable: es cuanto de esa hoja se acota
// sola y cuanto pisa la pagina entera. Un plugin bien hecho escribe casi todo
// bajo su propia clase raiz, y entonces admitirlo no cuesta nada. Uno que
// redefine `body`, `h1` o `p` a secas se lleva puesto el diseño.
//
// Esto no decide: mide y muestra las reglas globales para que las lea una
// persona. Un `.animated` que necesita su clase es inerte; un `body { font-family }`
// no.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

// Propiedades que, en un selector global, cambian como se ve todo lo demas.
const INVASIVE = new Set([
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'color', 'background', 'background-color', 'background-image',
  'margin', 'padding', 'display', 'position', 'text-transform'
]);

// Selectores que alcanzan a la pagina entera aunque no nombren un contenedor.
const RAIZ = /^(html|body|:root|\*|h[1-6]|p|a|ul|ol|li|img|button|input|select|textarea)\b/i;

export function parseSelectors(css) {
  const reglas = [];
  const contexto = [];   // condiciones @media/@supports activas
  let i = 0;
  let cabeza = '';

  while (i < css.length) {
    const c = css[i];

    // At-rules sin bloque: @charset, @import, @namespace. Terminan en `;` y
    // no abren contexto. Tratarlas como si abrieran uno desincroniza todo el
    // resto del archivo, y entonces cada regla parece condicional -es decir,
    // inofensiva- cuando no lo es.
    if (c === ';' && cabeza.trim().startsWith('@')) {
      cabeza = '';
      i += 1;
      continue;
    }

    if (c === '{') {
      const titulo = cabeza.trim().replace(/\s+/g, ' ');
      cabeza = '';

      if (titulo.startsWith('@')) {
        contexto.push(titulo);
        i += 1;
        continue;
      }

      // Bloque de declaraciones: se lee hasta su llave de cierre.
      let profundidad = 1;
      let j = i + 1;
      while (j < css.length && profundidad > 0) {
        if (css[j] === '{') profundidad += 1;
        else if (css[j] === '}') profundidad -= 1;
        j += 1;
      }

      const cuerpo = css.slice(i + 1, j - 1).trim();
      const condicion = contexto.length ? contexto[contexto.length - 1] : null;

      for (const selector of titulo.split(',')) {
        const limpio = selector.trim();
        if (limpio) reglas.push({ selector: limpio, cuerpo, condicion });
      }

      i = j;
      continue;
    }

    if (c === '}') {
      contexto.pop();
      cabeza = '';
      i += 1;
      continue;
    }

    cabeza += c;
    i += 1;
  }

  return reglas;
}

// Definir una variable no cambia nada por si sola: la usa quien la lee.
function propiedadesDe(cuerpo) {
  return [...cuerpo.matchAll(/(^|;)\s*(-{0,2}[a-z][a-z-]*)\s*:/gi)]
    .map((m) => m[2].toLowerCase())
    .filter((prop) => !prop.startsWith("--"));
}

export function auditar(css, { scope = null, bodyClasses = [] } = {}) {
  const reglas = parseSelectors(css);
  const acotadas = [];
  const globales = [];

  const alcance = scope ? new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;

  const dependientes = [];

  for (const regla of reglas) {
    const propio = alcance ? alcance.test(regla.selector) : /\.[a-z][a-z0-9-]{2,}/i.test(regla.selector);

    if (propio) {
      // Una clase puede estar acotada en el selector y ser global en efecto:
      // si vive en el <body>, alcanza a toda la pagina. Estaticamente no hay
      // forma de saberlo, asi que se informa en vez de decidir. Un kit de
      // constructor de paginas es exactamente este caso.
      // Una clase puede estar acotada en el selector y alcanzar la pagina
      // entera igual: basta con que viva en el <body>. Estaticamente no hay
      // forma de saberlo, y marcar toda clase suelta llena el informe de ruido
      // -`.elementor-hidden` no le hace nada a nadie-. Asi que se pregunta:
      // `--body-classes elementor-kit-8` y se revisan solo esas.
      if (bodyClasses.length) {
        const primera = regla.selector.match(/^\.([a-z][a-z0-9_-]*)/i)?.[1]?.toLowerCase();
        if (primera && bodyClasses.includes(primera)) {
          const invasivas = propiedadesDe(regla.cuerpo).filter((prop) => INVASIVE.has(prop));
          if (invasivas.length) {
            dependientes.push({
              selector: regla.selector,
              declaraciones: regla.cuerpo.replace(/\s+/g, " ").slice(0, 110),
              propiedades_invasivas: invasivas
            });
          }
        }
      }

      acotadas.push(regla);
      continue;
    }

    const propiedades = propiedadesDe(regla.cuerpo);
    const invasivas = propiedades.filter((prop) => INVASIVE.has(prop));
    const raiz = RAIZ.test(regla.selector);
    const condicional = Boolean(regla.condicion);

    globales.push({
      selector: regla.selector,
      declaraciones: regla.cuerpo.replace(/\s+/g, ' ').slice(0, 110),
      condicion: regla.condicion,
      // Peligrosa: alcanza elementos que la portada usa, cambia como se ven, y
      // no depende de una condicion que la deje inerte.
      peligrosa: raiz && invasivas.length > 0,
      propiedades_invasivas: invasivas
    });
  }

  const peligrosas = globales.filter((item) => item.peligrosa);

  return {
    total: reglas.length,
    acotadas: acotadas.length,
    globales: globales.length,
    peligrosas,
    dependientes,
    globales_detalle: globales,
    veredicto: peligrosas.length ? 'revisar' : 'requiere-verificacion-en-navegador'
  };
}

async function leer(origen) {
  if (/^https?:\/\//i.test(origen)) {
    const respuesta = await fetch(origen);
    if (!respuesta.ok) throw new Error(`${origen} respondio ${respuesta.status}`);
    return respuesta.text();
  }
  return readFile(path.resolve(origen), 'utf8');
}

async function main() {
  const origenes = process.argv.slice(2).filter((item) => !item.startsWith('--') && !process.argv[process.argv.indexOf(item) - 1]?.startsWith('--'));
  if (!origenes.length) {
    throw new Error(
      'Uso: audit-foreign-css.mjs <url-o-archivo> [...] [--scope .elementor] [--json]'
    );
  }

  const scope = arg('scope', null);
  // Las clases que lleva el <body> de la portada. Sin esto no se puede saber si
  // una regla acotada a una clase alcanza toda la pagina.
  const bodyClasses = (arg('body-classes', '') || '')
    .split(',').map((item) => item.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
  const json = process.argv.includes('--json');
  const informe = [];

  for (const origen of origenes) {
    const css = await leer(origen);
    const nombre = origen.split('/').pop().split('?')[0];
    const resultado = auditar(css, { scope, bodyClasses });
    informe.push({ origen, ...resultado });

    if (json) continue;

    const porcentaje = resultado.total ? ((resultado.acotadas / resultado.total) * 100).toFixed(1) : '0';
    console.log(`\n${nombre}  ·  ${css.length.toLocaleString('es')} bytes`);
    console.log(`  ${resultado.total} selectores — ${resultado.acotadas} acotados (${porcentaje}%), ${resultado.globales} globales`);

    if (!resultado.peligrosas.length && !resultado.dependientes.length) {
      console.log('\n  No se detectaron conflictos globales en este análisis parcial; verificar en navegador.');
    } else if (resultado.peligrosas.length) {
      console.log(`\n  ✗ ${resultado.peligrosas.length} reglas globales tocan elementos que la portada usa:`);
      for (const item of resultado.peligrosas) {
        console.log(`      ${item.selector}`);
        console.log(`        ${item.declaraciones}`);
        console.log(`        propiedades: ${item.propiedades_invasivas.join(', ')}`);
      }
    }

    if (resultado.dependientes.length) {
      console.log(
        `
  ⚠ ${resultado.dependientes.length} reglas acotadas a una sola clase declaran propiedades que cambian`
      );
      console.log('    como se ve todo. Son globales si esa clase esta en el <body>:');
      for (const item of resultado.dependientes) {
        console.log(`      ${item.selector}`);
        console.log(`        ${item.declaraciones}`);
        console.log(`        propiedades: ${item.propiedades_invasivas.join(', ')}`);
      }
    }

    const inertes = resultado.globales_detalle.filter((item) => !item.peligrosa);
    if (inertes.length) {
      console.log(`\n  ${inertes.length} reglas adicionales; su efecto depende del DOM y del viewport:`);
      for (const item of inertes.slice(0, 12)) {
        const cond = item.condicion ? `  [${item.condicion}]` : '';
        console.log(`      ${item.selector}${cond}`);
      }
      if (inertes.length > 12) console.log(`      … y ${inertes.length - 12} mas`);
    }
  }

  if (json) {
    console.log(JSON.stringify(informe, null, 2));
    return;
  }

  const revisar = informe.filter((item) => item.veredicto === 'revisar');
  console.log(
    revisar.length
      ? `\n${revisar.length} de ${informe.length} hojas necesitan revision antes de declararlas en allowedStyles.`
      : '\nVerificar las hojas en una portada de prueba antes de admitirlas.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
