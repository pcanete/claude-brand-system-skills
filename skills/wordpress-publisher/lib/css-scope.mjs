// Acota una hoja compilada bajo una clase raíz.
//
// Cuando la página compilada se queda con el documento entero, su CSS puede
// hablar de `html`, `body` y `*` sin molestar a nadie. Cuando se incrusta
// adentro de una página de WordPress, ese mismo CSS le pisa el tema al cliente:
// una regla sobre `body` no distingue entre la parte compilada y la cabecera
// que estaba ahí antes.
//
// Esta transformación no es exacta y no pretende serlo. Lo que la vuelve
// confiable es lo que viene después: `audit-foreign-css.mjs` mide el resultado
// y el paquete no sale si queda una sola regla fuera del alcance. La herramienta
// que juzga es otra que la que transforma.

// At-rules cuyo bloque no contiene selectores, sino declaraciones o fotogramas.
// Se copian tal cual: acotar `from` o `to` no significa nada.
const SIN_SELECTORES =
  /^@(?:-\w+-)?(?:keyframes|font-face|font-feature-values|font-palette-values|counter-style|property|page|viewport)\b/i;

// At-rules que envuelven reglas normales: adentro hay que seguir acotando.
const CON_REGLAS = /^@(?:media|supports|layer|container|scope|document)\b/i;

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

  return eraRaiz ? `${raiz}${resto}` : `${raiz} ${resto}`;
}

/**
 * Acota también los `<style>` que viajan dentro del HTML.
 *
 * Astro puede dejar CSS crítico en línea. Es CSS igual que el de un archivo:
 * si habla de `body` o de `h1`, le habla a toda la página que aloje la pieza.
 */
export function acotarEstilosEnLinea(html, raiz) {
  return html.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_todo, abre, css, cierra) => `${abre}${acotarCss(css, raiz)}${cierra}`
  );
}

export function acotarCss(css, raiz) {
  let salida = '';
  let cabeza = '';
  let i = 0;

  while (i < css.length) {
    const c = css[i];

    // At-rules sin bloque: @charset, @import, @namespace. Terminan en `;`.
    if (c === ';') {
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
        const interior = CON_REGLAS.test(titulo) && !SIN_SELECTORES.test(titulo)
          ? acotarCss(cuerpo, raiz)
          : cuerpo;
        salida += `${sangria}${titulo}{${interior}}`;
      } else {
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
