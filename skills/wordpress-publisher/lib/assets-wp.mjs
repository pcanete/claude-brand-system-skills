// Lo que hace falta cuando la pieza compilada convive con el tema del cliente
// en el mismo documento.
//
// Dos cosas, y las dos son la misma idea: que nada de lo compilado se derrame.
// Los assets se registran y se encolan por WordPress, para que carguen solo
// donde hacen falta; y el CSS se acota bajo una raiz, para que no le hable al
// resto de la pagina.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { auditar } from '../scripts/audit-foreign-css.mjs';
import { acotarCss } from './css-scope.mjs';
import { listarArchivos } from './html.mjs';

/**
 * Un handle de WordPress por cada archivo del build que haya que encolar.
 * El índice sale del orden alfabético: el mismo build produce los mismos
 * handles, build tras build.
 */
export function asignarHandles(rutas, config) {
  const estilos = new Map();
  const scripts = new Map();

  const ordenadas = [...new Set(rutas)].sort();

  for (const ruta of ordenadas) {
    const esCss = ruta.toLowerCase().endsWith('.css');
    const destino = esCss ? estilos : scripts;
    const prefijo = esCss ? `${config.slug}-style-` : `${config.slug}-script-`;
    destino.set(ruta, `${prefijo}${destino.size + 1}`);
  }

  return { estilos, scripts };
}

export function phpDeRegistro({ estilos, scripts }, config, sangria = '\t') {
  const lineas = [];

  for (const [ruta, handle] of estilos) {
    lineas.push(
      `${sangria}wp_register_style( '${handle}', ${config.constPrefix}_URL . 'dist/${ruta}', array(), ${config.constPrefix}_VERSION );`
    );
  }

  for (const [ruta, handle] of scripts) {
    lineas.push(
      `${sangria}wp_register_script( '${handle}', ${config.constPrefix}_URL . 'dist/${ruta}', array(), ${config.constPrefix}_VERSION, true );`
    );
  }

  return lineas.join('\n');
}

/**
 * Acota todas las hojas empaquetadas bajo una raíz.
 *
 * Se hace sobre el paquete, no sobre el build del proyecto: el `dist` original
 * queda intacto, que es lo que el sitio estático sigue publicando.
 */
export async function acotarCssEmpaquetado(pluginDistDir, raiz) {
  const tocadas = [];

  for (const relativa of await listarArchivos(pluginDistDir)) {
    if (!relativa.toLowerCase().endsWith('.css')) continue;

    const archivo = path.join(pluginDistDir, relativa);
    const fuente = await readFile(archivo, 'utf8');

    let acotada;
    try {
      acotada = acotarCss(fuente, raiz);
    } catch (error) {
      if (error.name !== 'CssNoAcotable') throw error;
      // El mensaje tiene que decir en qué archivo, o la corrección empieza por
      // buscarlo a mano entre las hojas del build.
      throw new Error(
        `dist/${relativa.replaceAll('\\', '/')}: ${error.detalle}\n  ${error.salida}`
      );
    }

    await writeFile(archivo, acotada, 'utf8');
    tocadas.push(relativa.replaceAll('\\', '/'));
  }

  return tocadas;
}

/**
 * La compuerta: después de acotar, ninguna regla puede quedar afuera.
 *
 * La mide `audit-foreign-css.mjs`, que se escribió para juzgar el CSS de
 * Astra y de Elementor. Que la herramienta que juzga sea otra que la que
 * transforma es lo único que vuelve confiable a la transformación: una regla
 * que el acotador no supo reescribir aparece acá y frena el paquete.
 */
export async function auditarAislamiento(pluginDir, raiz) {
  const problemas = [];
  const distDir = path.join(pluginDir, 'dist');

  for (const relativa of await listarArchivos(distDir)) {
    if (!relativa.toLowerCase().endsWith('.css')) continue;

    const css = await readFile(path.join(distDir, relativa), 'utf8');
    const informe = auditar(css, { scope: raiz });

    if (informe.globales > 0) {
      const muestra = informe.globales_detalle
        .slice(0, 3)
        .map((regla) => regla.selector)
        .join(', ');
      problemas.push(
        `dist/${relativa.replaceAll('\\', '/')}: ${informe.globales} regla(s) fuera de ${raiz} ` +
          `(${muestra}). Ese CSS le habla al resto de la página, no solo a la pieza.`
      );
    }
  }

  return problemas;
}
