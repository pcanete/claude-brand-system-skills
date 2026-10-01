// Acota una hoja compilada bajo una clase raíz.
//
// Cuando la página compilada se queda con el documento entero, su CSS puede
// hablar de `html`, `body` y `*` sin molestar a nadie. Cuando se incrusta
// adentro de una página de WordPress, ese mismo CSS le pisa el tema al cliente:
// una regla sobre `body` no distingue entre la parte compilada y la cabecera
// que estaba ahí antes.
//
// Esta transformación no es exacta y no pretende serlo. La respaldan dos cosas
// distintas, y hacen falta las dos:
//
//   - `audit-foreign-css.mjs` mide el resultado, y el paquete no sale si queda
//     una regla fuera del alcance. La herramienta que juzga es otra que la que
//     transforma, así que no comparte sus puntos ciegos.
//   - lo que el acotador no sabe reescribir **se rechaza acá**, con nombre y
//     línea. Porque hay formas de CSS que el auditor tampoco ve: un `@import`
//     trae una hoja que nadie miró, y una regla anidada vive adentro de un
//     bloque que los dos leen como declaraciones. Transformarlas a ciegas
//     produce exactamente lo que esta pieza existe para evitar: una fuga que
//     ninguna compuerta detecta.
//
// Rechazar es la parte incómoda y es la que importa. Un mensaje claro al
// exportar cuesta una tarde; una fuga silenciosa se descubre en el sitio del
// cliente.

// At-rules cuyo bloque no contiene selectores, sino declaraciones o fotogramas.
// Se copian tal cual: acotar `from` o `to` no significa nada.
const SIN_SELECTORES =
  /^@(?:-\w+-)?(?:keyframes|font-face|font-feature-values|font-palette-values|counter-style|property)\b/i;

// At-rules que envuelven reglas normales: adentro hay que seguir acotando.
const CON_REGLAS = /^@(?:media|supports|layer|container)\b/i;

// At-rules sin bloque, que terminan en `;`. `@import` no está: trae una hoja
// entera que este acotador nunca ve.
const SIN_BLOQUE = /^@(?:charset|namespace|layer)\b/i;

/**
 * Lo que el acotador no sabe hacer, dicho con nombre.
 *
 * Lleva `motivo` para que el exportador pueda explicarlo sin reinterpretar un
 * mensaje de texto.
 */
export class CssNoAcotable extends Error {
  constructor(motivo, detalle, salida) {
    super(`${detalle} ${salida}`);
    this.name = 'CssNoAcotable';
    this.motivo = motivo;
    this.detalle = detalle;
    this.salida = salida;
  }
}

const RAIZ_SUELTA = /(^|[\s>+~,(])(?:html|body|:root)(?![\w-])/i;

/** Recorre saltando cadenas y comentarios: un `{` adentro de un texto no abre nada. */
function saltar(css, i) {
  const c = css[i];

  if (c === '/' && css[i + 1] === '*') {
    const fin = css.indexOf('*/', i + 2);
    return fin === -1 ? css.length : fin + 2;
  }

  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < css.length) {
      if (css[j] === '\\') j += 2;
      else if (css[j] === c) return j + 1;
      else j += 1;
    }
    return css.length;
  }

  return i + 1;
}

/** Índice justo después de la llave que cierra la que abre en `apertura`. */
function cierreDe(css, apertura) {
  let profundidad = 0;
  let i = apertura;

  while (i < css.length) {
    const c = css[i];

    if (c === '{') {
      profundidad += 1;
      i += 1;
      continue;
    }

    if (c === '}') {
      profundidad -= 1;
      i += 1;
      if (profundidad === 0) return i;
      continue;
    }

    const siguiente = saltar(css, i);
    i = siguiente > i ? siguiente : i + 1;
  }

  return css.length;
}

/** ¿El cuerpo de esta regla abre otro bloque? Entonces lleva reglas anidadas. */
function tieneBloqueAnidado(cuerpo) {
  let i = 0;

  while (i < cuerpo.length) {
    if (cuerpo[i] === '{') return true;
    const siguiente = saltar(cuerpo, i);
    i = siguiente > i ? siguiente : i + 1;
  }

  return false;
}

/** Corta una lista de selectores por las comas que están al nivel de arriba. */
function partirSelectores(lista) {
  const partes = [];
  let actual = '';
  let parentesis = 0;
  let corchetes = 0;
  let i = 0;

  while (i < lista.length) {
    const c = lista[i];

    if (c === '"' || c === "'") {
      const fin = saltar(lista, i);
      actual += lista.slice(i, fin);
      i = fin;
      continue;
    }

    if (c === '(') parentesis += 1;
    if (c === ')') parentesis -= 1;
    if (c === '[') corchetes += 1;
    if (c === ']') corchetes -= 1;

    if (c === ',' && parentesis === 0 && corchetes === 0) {
      partes.push(actual);
      actual = '';
      i += 1;
      continue;
    }

    actual += c;
    i += 1;
  }

  partes.push(actual);
  return partes;
}

// `:where(html)` y `:is(body)` son la misma raíz escrita con menos
// especificidad. Astro las emite en sus resets.
const RAIZ_ENVUELTA = /^:(?:where|is)\(\s*(html|body|:root)\s*\)/i;
const RAIZ = /^(?:html|body|:root)(?![\w-])/i;
// Un separador que lleva a otra raíz —`html body`, `html > body`— se consume;
// uno que lleva a otra cosa no, porque ese espacio es el combinador de
// descendencia y perderlo convierte `body .x` en `.raiz.x`, que no es lo mismo.
const HACIA_OTRA_RAIZ = /^(?:\s*>\s*|\s+)(?=(?:html|body|:root)(?![\w-]))/i;

export function acotarSelector(selector, raiz) {
  const limpio = selector.trim();
  if (!limpio) return '';

  // `*` sola alcanza también al contenedor: si no se lo nombra, la regla deja
  // de aplicarle y el `box-sizing` del sistema se pierde justo en la raíz.
  if (limpio === '*') return `${raiz}, ${raiz} *`;

  let resto = limpio.replace(RAIZ_ENVUELTA, '$1');
  let eraRaiz = false;

  for (;;) {
    const cabeza = RAIZ.exec(resto);
    if (!cabeza) break;

    eraRaiz = true;
    resto = resto.slice(cabeza[0].length);

    const salto = HACIA_OTRA_RAIZ.exec(resto);
    if (!salto) break;
    resto = resto.slice(salto[0].length);
  }

  const acotado = eraRaiz ? `${raiz}${resto}` : `${raiz} ${resto}`;

  // Si después de reescribir todavía queda una raíz suelta, el acotador no
  // entendió este selector. Y lo peor no es eso: el resultado empieza con la
  // clase raíz, así que el auditor lo cuenta como acotado y lo deja pasar.
  // `html.dark body` y `:where(html, body)` caen acá.
  if (RAIZ_SUELTA.test(acotado.replace(/"[^"]*"|'[^']*'/g, ''))) {
    throw new CssNoAcotable(
      'selector-con-raiz',
      `no se pudo acotar el selector \`${limpio}\`: quedó una raíz suelta en \`${acotado}\`.`,
      'Escribilo con una sola raíz al principio (`body .x`, `:root[data-tema]`) o movelo a una clase del sistema.'
    );
  }

  return acotado;
}

/**
 * Acota también los `<style>` que viajan dentro del HTML.
 *
 * Astro puede dejar CSS crítico en línea. Es CSS igual que el de un archivo:
 * si habla de `body` o de `h1`, le habla a toda la página que aloje la pieza.
 */
export function acotarEstilosEnLinea(html, raiz, donde = 'un estilo en línea') {
  return html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_todo, abre, css, cierra) => {
    try {
      return `${abre}${acotarCss(css, raiz)}${cierra}`;
    } catch (error) {
      if (error.name !== 'CssNoAcotable') throw error;
      throw new Error(`${donde}: ${error.detalle}\n  ${error.salida}`);
    }
  });
}

export function acotarCss(css, raiz) {
  let salida = '';
  let cabeza = '';
  let i = 0;

  while (i < css.length) {
    const c = css[i];

    // At-rules sin bloque: terminan en `;`.
    if (c === ';') {
      const declaracion = cabeza.trim();

      if (/^@/.test(declaracion) && !SIN_BLOQUE.test(declaracion)) {
        throw new CssNoAcotable(
          'at-rule-sin-bloque',
          `\`${declaracion.slice(0, 60)}\` no se puede acotar.`,
          declaracion.toLowerCase().startsWith('@import')
            ? 'Un @import trae una hoja que este acotador nunca ve, así que no puede garantizar nada de ella. Resolvelo en el build: que Astro la inserte en lugar de importarla.'
            : 'No sé qué significa para el alcance. Resolvelo en el build o pedí que se agregue.'
        );
      }

      salida += cabeza + c;
      cabeza = '';
      i += 1;
      continue;
    }

    if (c === '{') {
      const fin = cierreDe(css, i);
      const cuerpo = css.slice(i + 1, fin - 1);
      const sangria = cabeza.match(/^\s*/)[0];
      const titulo = cabeza.trim().replace(/\s+/g, ' ');

      if (titulo.startsWith('@')) {
        if (CON_REGLAS.test(titulo)) {
          salida += `${sangria}${titulo}{${acotarCss(cuerpo, raiz)}}`;
        } else if (SIN_SELECTORES.test(titulo)) {
          salida += `${sangria}${titulo}{${cuerpo}}`;
        } else {
          // Copiarla tal cual sería suponer que su contenido son declaraciones.
          // Si envuelve reglas, esas reglas salen sin acotar y el auditor no las
          // ve, porque las lee como el cuerpo de este bloque.
          throw new CssNoAcotable(
            'at-rule-desconocida',
            `\`${titulo.slice(0, 60)}\` no está entre las at-rules que sé acotar.`,
            'Si envuelve reglas hay que recorrerla, y si son declaraciones hay que dejarla quieta: adivinarlo produce una fuga que ninguna compuerta detecta. Resolvelo en el build o pedí que se agregue.'
          );
        }
      } else {
        // Una regla anidada vive dentro de lo que acá se lee como el cuerpo de
        // declaraciones de su regla madre. Ni este acotador ni el auditor miran
        // ahí adentro: un `body` anidado saldría intacto y pasaría la compuerta.
        if (tieneBloqueAnidado(cuerpo)) {
          throw new CssNoAcotable(
            'regla-anidada',
            `la regla \`${titulo.slice(0, 60)}\` tiene reglas anidadas adentro.`,
            'El anidamiento nativo no se acota acá, y el auditor tampoco lo ve. Compilalo plano antes de publicar: en Astro, con el preprocesador o el target del build.'
          );
        }

        const acotados = partirSelectores(titulo)
          .map((parte) => acotarSelector(parte, raiz))
          .filter(Boolean)
          .join(',');
        salida += `${sangria}${acotados}{${cuerpo}}`;
      }

      cabeza = '';
      i = fin;
      continue;
    }

    const siguiente = saltar(css, i);
    if (siguiente > i + 1) {
      cabeza += css.slice(i, siguiente);
      i = siguiente;
      continue;
    }

    cabeza += c;
    i += 1;
  }

  return salida + cabeza;
}
