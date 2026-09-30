// Lee `wordpress.config.json` y lo convierte en una configuración resuelta.
//
// Una configuración sin `mode` es una configuración de portada. Eso no es una
// concesión: es la forma del archivo que ya está instalado en sitios vivos, y
// tiene que seguir significando exactamente lo mismo.

export const MODOS = ['front-page', 'page-template', 'embedded-page', 'elementor-widgets'];

// Tipos de control que sirven para que alguien edite *contenido*. Los demás
// —color, espaciado, interruptores— ajustan la presentación, y la presentación
// ya la resuelve la página compilada.
const CONTROLES_DE_CONTENIDO = new Set(['text', 'textarea', 'url', 'media']);

const CONTROLES = new Set([
  ...CONTROLES_DE_CONTENIDO,
  'number',
  'select',
  'switcher',
  'color'
]);

// Fuentes que alimenta WordPress. Cada una tiene un generador propio; declarar
// una que no está implementada falla al exportar, no en el sitio del cliente.
export const FUENTES = new Set(['woocommerce.products', 'wp.posts']);

// Un widget que se llama como un ladrillo es un ladrillo. Elementor ya los
// tiene, y fragmentar un diseño terminado en ladrillos es exactamente lo que
// hay que evitar: cada uno se puede mover, y el diseño deja de existir.
const NOMBRES_ATOMICOS = new Set([
  'heading',
  'title',
  'titulo',
  'paragraph',
  'text',
  'texto',
  'icon',
  'icono',
  'spacer',
  'espaciador',
  'divider',
  'separador',
  'button',
  'boton',
  'image',
  'imagen',
  'video',
  'html'
]);

// Todo esto termina adentro de una cadena PHP entre comillas simples. Una
// comilla en el contenido corta el literal, y el archivo deja de parsear: ya
// pasó, y tiró un sitio en producción.
function textoSeguro(valor, campo) {
  if (typeof valor !== 'string') {
    throw new Error(`${campo} tiene que ser texto.`);
  }
  if (/['\\\r\n\t\0]/.test(valor)) {
    throw new Error(
      `${campo} no puede llevar comilla simple, barra invertida ni saltos de línea: ` +
        'ese texto viaja dentro de una cadena PHP y una comilla la corta antes de tiempo. ' +
        'Si necesitás un apóstrofo, usá el tipográfico (’).'
    );
  }
  return valor;
}

function identificador(valor, campo) {
  if (typeof valor !== 'string' || !/^[a-z][a-z0-9-]*$/.test(valor)) {
    throw new Error(`${campo} tiene que ser kebab-case y empezar con letra, no ${JSON.stringify(valor)}.`);
  }
  return valor;
}

function resolverPaginas(raw, { requiereEtiqueta }) {
  const declaradas = raw.pages;

  if (!Array.isArray(declaradas) || declaradas.length === 0) {
    throw new Error('Este modo necesita `pages`: una lista de páginas con al menos un elemento.');
  }

  const vistos = new Set();

  return declaradas.map((pagina, indice) => {
    const donde = `pages[${indice}]`;
    if (!pagina || typeof pagina !== 'object') throw new Error(`${donde} tiene que ser un objeto.`);

    const id = identificador(pagina.id, `${donde}.id`);
    if (vistos.has(id)) throw new Error(`Hay dos páginas con el mismo id: ${id}.`);
    vistos.add(id);

    if (requiereEtiqueta && !pagina.label) {
      throw new Error(
        `${donde}.label es obligatorio: es el nombre que el cliente ve en Página > Atributos > Plantilla.`
      );
    }

    return {
      id,
      label: textoSeguro(pagina.label || id, `${donde}.label`),
      source: textoSeguro(pagina.source || `dist/${id}/index.html`, `${donde}.source`)
    };
  });
}

function resolverControles(declarados, donde) {
  if (declarados === undefined) return [];
  if (!Array.isArray(declarados)) throw new Error(`${donde}.controls tiene que ser una lista.`);

  return declarados.map((control, indice) => {
    const lugar = `${donde}.controls[${indice}]`;
    if (!control || typeof control !== 'object') throw new Error(`${lugar} tiene que ser un objeto.`);

    const name = control.name;
    if (typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new Error(`${lugar}.name tiene que ser snake_case, no ${JSON.stringify(name)}.`);
    }

    const type = control.type || 'text';
    if (!CONTROLES.has(type)) {
      throw new Error(`${lugar}.type desconocido: ${JSON.stringify(type)}. Opciones: ${[...CONTROLES].join(', ')}.`);
    }

    const options = control.options ?? null;
    if (type === 'select') {
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        throw new Error(`${lugar} es un select y necesita \`options\` como objeto valor → etiqueta.`);
      }
      for (const [valor, etiqueta] of Object.entries(options)) {
        textoSeguro(valor, `${lugar}.options`);
        textoSeguro(etiqueta, `${lugar}.options.${valor}`);
      }
    }

    return {
      name,
      type,
      label: textoSeguro(control.label || name, `${lugar}.label`),
      default: control.default === undefined ? '' : textoSeguro(String(control.default), `${lugar}.default`),
      options,
      esContenido: CONTROLES_DE_CONTENIDO.has(type)
    };
  });
}

function resolverDatos(declarados, donde) {
  if (declarados === undefined) return [];
  if (!Array.isArray(declarados)) throw new Error(`${donde}.data tiene que ser una lista.`);

  return declarados.map((dato, indice) => {
    const lugar = `${donde}.data[${indice}]`;
    if (!dato || typeof dato !== 'object') throw new Error(`${lugar} tiene que ser un objeto.`);

    const name = dato.name;
    if (typeof name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new Error(`${lugar}.name tiene que ser snake_case, no ${JSON.stringify(name)}.`);
    }

    if (!FUENTES.has(dato.source)) {
      throw new Error(
        `${lugar}.source no está implementada: ${JSON.stringify(dato.source)}. ` +
          `Hay generador para ${[...FUENTES].join(' y ')}. ` +
          'Cualquier otra fuente se escribe a mano en el proveedor del widget.'
      );
    }

    const limite = dato.limit === undefined ? 12 : Number(dato.limit);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      throw new Error(`${lugar}.limit tiene que ser un entero entre 1 y 100.`);
    }

    return { name, source: dato.source, limit: limite };
  });
}

function resolverWidgets(raw) {
  const declarados = raw.widgets;

  if (!Array.isArray(declarados) || declarados.length === 0) {
    throw new Error('El modo `elementor-widgets` necesita `widgets`: una lista con al menos un elemento.');
  }

  const vistos = new Set();

  return declarados.map((widget, indice) => {
    const donde = `widgets[${indice}]`;
    if (!widget || typeof widget !== 'object') throw new Error(`${donde} tiene que ser un objeto.`);

    const id = identificador(widget.id, `${donde}.id`);
    if (vistos.has(id)) throw new Error(`Hay dos widgets con el mismo id: ${id}.`);
    vistos.add(id);

    if (NOMBRES_ATOMICOS.has(id)) {
      throw new Error(
        `El widget "${id}" es un ladrillo, y Elementor ya los trae. ` +
          'Un widget propio vale la pena cuando es un componente de dominio completo ' +
          '—una grilla de productos, un bloque de preguntas frecuentes, una ficha— ' +
          'no cuando parte el diseño en piezas que después cualquiera puede mover.'
      );
    }

    const controls = resolverControles(widget.controls, donde);
    const data = resolverDatos(widget.data, donde);

    // La compuerta del modo. Si nadie edita nada y WordPress no aporta ningún
    // dato, este widget muestra siempre lo mismo: entonces no necesita ser un
    // widget, necesita ser parte de la página compilada.
    if (!data.length && !controls.some((control) => control.esContenido)) {
      throw new Error(
        `El widget "${id}" no declara nada que cambie: ningún control de contenido ` +
          `(${[...CONTROLES_DE_CONTENIDO].join(', ')}) y ninguna fuente de datos. ` +
          'Un componente que siempre muestra lo mismo no gana nada dentro de Elementor ' +
          'y pierde la fidelidad del build. Va en la página compilada.'
      );
    }

    return {
      id,
      label: textoSeguro(widget.label || id, `${donde}.label`),
      icon: textoSeguro(widget.icon || 'eicon-gallery-grid', `${donde}.icon`),
      source: widget.source ? textoSeguro(widget.source, `${donde}.source`) : null,
      controls,
      data
    };
  });
}

/** Un slug manda: de ahí salen el prefijo de constantes y el de funciones. */
export function resolveConfig(raw = {}) {
  const slug = raw.slug;
  if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error('config.slug es obligatorio y debe ser kebab-case (ej: portada-astro).');
  }

  const base = slug.replaceAll('-', '_');

  // WordPress decide si hay actualización comparando este número. Un plugin
  // que se reempaqueta sin subirlo puede no reemplazar al instalado.
  const version = raw.version || '0.1.0';
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`config.version debe ser x.y.z, no "${version}".`);
  }

  // Ausente significa portada. Es la configuración que ya está instalada.
  const modo = raw.mode === undefined || raw.mode === null ? 'front-page' : raw.mode;
  if (!MODOS.includes(modo)) {
    throw new Error(`config.mode desconocido: ${JSON.stringify(modo)}. Opciones: ${MODOS.join(', ')}.`);
  }

  const config = {
    slug,
    version,
    modo,
    name: textoSeguro(raw.name || slug, 'config.name'),
    description: textoSeguro(raw.description || `Portada compilada para ${slug}.`, 'config.description'),
    author: textoSeguro(raw.author || '', 'config.author'),
    constPrefix: raw.constPrefix || base.toUpperCase(),
    fnPrefix: raw.fnPrefix || base,
    // Handles de WordPress que este paquete aloja a proposito. Vacio por
    // defecto: hasta que alguien declare que si, no entra nada ajeno.
    allowedStyles: raw.allowedStyles || []
  };

  if (!/^[A-Z][A-Z0-9_]*$/.test(config.constPrefix)) {
    throw new Error(`config.constPrefix tiene que ser MAYUSCULAS_CON_GUION_BAJO, no ${JSON.stringify(config.constPrefix)}.`);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(config.fnPrefix)) {
    throw new Error(`config.fnPrefix tiene que ser snake_case, no ${JSON.stringify(config.fnPrefix)}.`);
  }

  if (modo === 'front-page') {
    config.source = textoSeguro(raw.source || 'dist/index.html', 'config.source');
  }

  if (modo === 'page-template') {
    const variante = raw.variant || 'canvas';
    if (!['theme', 'canvas'].includes(variante)) {
      throw new Error(`config.variant tiene que ser "theme" o "canvas", no ${JSON.stringify(variante)}.`);
    }
    config.variant = variante;
    config.pages = resolverPaginas(raw, { requiereEtiqueta: true });
  }

  if (modo === 'embedded-page') {
    const shortcode = raw.shortcode || `${base}_page`;
    if (!/^[a-z][a-z0-9_]*$/.test(shortcode)) {
      throw new Error(`config.shortcode tiene que ser snake_case, no ${JSON.stringify(shortcode)}.`);
    }
    config.shortcode = shortcode;
    config.pages = resolverPaginas(raw, { requiereEtiqueta: false });
  }

  if (modo === 'elementor-widgets') {
    config.category = textoSeguro(raw.category || 'Brand System', 'config.category');
    config.categorySlug = raw.categorySlug || `${slug}-widgets`;
    if (!/^[a-z][a-z0-9-]*$/.test(config.categorySlug)) {
      throw new Error(`config.categorySlug tiene que ser kebab-case, no ${JSON.stringify(config.categorySlug)}.`);
    }
    config.widgets = resolverWidgets(raw);
  }

  return config;
}
