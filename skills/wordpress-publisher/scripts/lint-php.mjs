#!/usr/bin/env node

// Comprueba que el PHP generado parsea, sin necesitar PHP instalado.
//
//   node scripts/lint-php.mjs archivo.php [...]
//
// No es un parser completo y no pretende serlo. Cubre la forma en que muere el
// PHP generado por una plantilla: una cadena que no cierra porque una comilla
// del contenido termino el literal, y llaves o parentesis desbalanceados.
//
// Existe porque paso: una linea generada quedo como
//
//   '<link ... onload="this.media='all'" />'
//
// donde las comillas simples del JavaScript cortaron la cadena PHP. El paquete
// se empaqueto, se instalo, y tiro el sitio. Ninguna de las comprobaciones que
// habia miraba si el PHP era PHP.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

/**
 * Recorre el archivo distinguiendo codigo de cadenas y comentarios.
 * Devuelve los problemas encontrados, con linea.
 */
export function lintPhp(source, nombre = 'php') {
  const problemas = [];
  const pila = [];          // llaves, parentesis y corchetes abiertos
  let i = 0;
  let linea = 1;

  const avanzar = (n = 1) => {
    for (let k = 0; k < n && i < source.length; k += 1) {
      if (source[i] === '\n') linea += 1;
      i += 1;
    }
  };

  // Una plantilla es HTML con islas de PHP. Fuera de las etiquetas, las
  // comillas son de atributos HTML y no significan nada: leerlas como codigo
  // convierte cualquier plantilla en un falso positivo.
  let enPhp = false;

  while (i < source.length) {
    if (!enPhp) {
      const apertura = source.indexOf('<?', i);
      if (apertura === -1) break;
      avanzar(apertura - i);
      avanzar(source.slice(i, i + 5) === '<?php' ? 5 : 2);
      enPhp = true;
      continue;
    }

    if (source[i] === '?' && source[i + 1] === '>') {
      avanzar(2);
      enPhp = false;
      continue;
    }

    const c = source[i];
    const siguiente = source[i + 1];

    // comentarios
    if (c === '/' && siguiente === '/') {
      while (i < source.length && source[i] !== '\n') avanzar();
      continue;
    }
    if (c === '#') {
      while (i < source.length && source[i] !== '\n') avanzar();
      continue;
    }
    if (c === '/' && siguiente === '*') {
      const cierre = source.indexOf('*/', i + 2);
      if (cierre === -1) {
        problemas.push({ linea, mensaje: 'comentario de bloque sin cerrar' });
        break;
      }
      avanzar(cierre + 2 - i);
      continue;
    }

    // heredoc y nowdoc
    if (c === '<' && source.slice(i, i + 3) === '<<<') {
      const encabezado = /^<<<\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\r?\n/.exec(source.slice(i));
      if (encabezado) {
        const etiqueta = encabezado[2];
        const cierre = new RegExp(`^[ \\t]*${etiqueta}\\b`, 'm');
        const resto = source.slice(i + encabezado[0].length);
        const encontrado = cierre.exec(resto);
        if (!encontrado) {
          problemas.push({ linea, mensaje: `heredoc ${etiqueta} sin cerrar` });
          break;
        }
        avanzar(encabezado[0].length + encontrado.index + encontrado[0].length);
        continue;
      }
    }

    // cadenas
    if (c === "'" || c === '"') {
      const comilla = c;
      const inicio = linea;
      avanzar();
      let cerrada = false;

      while (i < source.length) {
        if (source[i] === '\\') {
          avanzar(2);
          continue;
        }
        if (source[i] === comilla) {
          avanzar();
          cerrada = true;
          break;
        }
        avanzar();
      }

      if (!cerrada) {
        problemas.push({
          linea: inicio,
          mensaje: `cadena con ${comilla === "'" ? 'comilla simple' : 'comilla doble'} sin cerrar`
        });
        break;
      }

      // Contar comillas no alcanza: cuando una comilla del contenido corta el
      // literal, las que quedan igual balancean y el archivo parece sano. Lo
      // que delata el corte es lo que sigue. Tras cerrar una cadena, PHP espera
      // un operador o un separador; nunca una palabra pegada.
      let j = i;
      while (j < source.length && /\s/.test(source[j])) j += 1;
      if (j < source.length && /[A-Za-z_'"]/.test(source[j])) {
        const bruto = source.slice(j, j + 24);
        const corte = bruto.indexOf(String.fromCharCode(10));
        const muestra = corte === -1 ? bruto : bruto.slice(0, corte);
        problemas.push({
          linea,
          mensaje:
            `despues de cerrar una cadena aparece \`${muestra}\`. ` +
            'Probablemente una comilla del contenido corto el literal antes de tiempo.'
        });
        break;
      }

      continue;
    }

    if (c === '{' || c === '(' || c === '[') {
      pila.push({ c, linea });
      avanzar();
      continue;
    }

    if (c === '}' || c === ')' || c === ']') {
      const pares = { '}': '{', ')': '(', ']': '[' };
      const arriba = pila.pop();
      if (!arriba) {
        problemas.push({ linea, mensaje: `'${c}' sin apertura` });
      } else if (arriba.c !== pares[c]) {
        problemas.push({ linea, mensaje: `'${c}' cierra un '${arriba.c}' abierto en la linea ${arriba.linea}` });
      }
      avanzar();
      continue;
    }

    avanzar();
  }

  for (const abierto of pila) {
    problemas.push({ linea: abierto.linea, mensaje: `'${abierto.c}' sin cerrar` });
  }

  return problemas.map((item) => ({ ...item, archivo: nombre }));
}

async function main() {
  const archivos = process.argv.slice(2).filter((item) => !item.startsWith('--'));
  if (!archivos.length) throw new Error('Uso: lint-php.mjs archivo.php [...]');

  let fallo = false;

  for (const archivo of archivos) {
    const source = await readFile(path.resolve(archivo), 'utf8');
    const problemas = lintPhp(source, path.basename(archivo));

    if (!problemas.length) {
      console.log(`✓ ${path.basename(archivo)}`);
      continue;
    }

    fallo = true;
    console.error(`✗ ${path.basename(archivo)}`);
    for (const p of problemas) console.error(`    linea ${p.linea}: ${p.mensaje}`);
  }

  if (fallo) {
    console.error('\nEl PHP generado no parsea. No empaquetar.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
