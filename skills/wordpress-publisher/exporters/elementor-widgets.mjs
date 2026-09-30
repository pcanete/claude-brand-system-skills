// Modo `elementor-widgets`: componentes propios adentro del constructor.
//
// Es el modo que más hay que justificar antes de usar, y por eso el que más
// compuertas tiene. `lib/config.mjs` ya rechazó los widgets que no declaran
// nada que cambie y los que se llaman como un ladrillo. Lo que queda acá es
// generar plomería segura: registro con las APIs oficiales, categoría propia,
// controles declarados, y un proveedor de datos que consulta WooCommerce o
// WordPress por sus funciones, nunca por SQL.
//
// El cuerpo visible de cada widget se genera como andamio y se edita a mano:
// es el único archivo del paquete pensado para eso. Un Product Grid real
// depende del catálogo y del diseño de ese cliente, y no hay forma honesta de
// inventarlo desde acá.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  acotarCssEmpaquetado,
  asignarHandles,
  auditarAislamiento,
  phpDeRegistro
} from '../lib/assets-wp.mjs';
import { listarArchivos, separarHead } from '../lib/html.mjs';
import { alcanceAislamiento, render } from '../lib/render.mjs';

export const modo = 'elementor-widgets';
export const comunes = ['readme.txt', 'assets/wordpress-isolation.css'];

const CONTROLES_ELEMENTOR = {
  text: 'TEXT',
  textarea: 'TEXTAREA',
  url: 'URL',
  media: 'MEDIA',
  number: 'NUMBER',
  select: 'SELECT',
  switcher: 'SWITCHER',
  color: 'COLOR'
};

function pascal(valor) {
  return valor
    .split(/[-_]/)
    .filter(Boolean)
    .map((parte) => parte[0].toUpperCase() + parte.slice(1))
    .join('_');
}

function nombreDeClase(config, widget) {
  return `${pascal(config.slug)}_Widget_${pascal(widget.id)}`;
}

function phpDeControles(widget, config) {
  return widget.controls
    .map((control) => {
      const lineas = [
        '\t\t$this->add_control(',
        `\t\t\t'${control.name}',`,
        '\t\t\tarray(',
        `\t\t\t\t'label' => esc_html__( '${control.label}', '${config.slug}' ),`,
        `\t\t\t\t'type'  => \\Elementor\\Controls_Manager::${CONTROLES_ELEMENTOR[control.type]},`
      ];

      if (control.type === 'select' && control.options) {
        lineas.push("\t\t\t\t'options' => array(");
        for (const [valor, etiqueta] of Object.entries(control.options)) {
          lineas.push(`\t\t\t\t\t'${valor}' => esc_html__( '${etiqueta}', '${config.slug}' ),`);
        }
        lineas.push('\t\t\t\t),');
      }

      if (control.type === 'url') {
        lineas.push("\t\t\t\t'default' => array( 'url' => '' ),");
      } else if (control.type === 'media') {
        lineas.push(
          "\t\t\t\t'default' => array( 'url' => \\Elementor\\Utils::get_placeholder_image_src() ),"
        );
      } else if (control.default !== '') {
        // Solo el texto se traduce. Un número, un color o un interruptor
        // envueltos en `esc_html__` piden que alguien traduzca un `3`.
        const valor = control.esContenido
          ? `esc_html__( '${control.default}', '${config.slug}' )`
          : `'${control.default}'`;
        lineas.push(`\t\t\t\t'default' => ${valor},`);
      }

      lineas.push('\t\t\t)', '\t\t);');
      return lineas.join('\n');
    })
    .join('\n\n');
}

const AYUDANTES = {
  'woocommerce.products': (config) =>
    [
      '/**',
      ' * Productos de WooCommerce, por sus propias funciones.',
      ' *',
      ' * Nunca por SQL: `wc_get_products` respeta visibilidad, stock, idioma y',
      ' * cualquier filtro que el sitio tenga puesto. Una consulta a mano se los',
      ' * saltea todos y muestra cosas que no deberia mostrar.',
      ' *',
      ' * Sin WooCommerce activo devuelve una lista vacia, y el widget no dibuja',
      ' * nada en vez de romper la pagina.',
      ' */',
      `function ${config.fnPrefix}_productos( $limite ) {`,
      "\tif ( ! function_exists( 'wc_get_products' ) ) {",
      '\t\treturn array();',
      '\t}',
      '',
      '\t$productos = wc_get_products(',
      '\t\tarray(',
      "\t\t\t'status'  => 'publish',",
      '\t\t\t\'limit\'   => (int) $limite,',
      "\t\t\t'orderby' => 'date',",
      "\t\t\t'order'   => 'DESC',",
      '\t\t)',
      '\t);',
      '',
      '\t$salida = array();',
      '',
      '\tforeach ( $productos as $producto ) {',
      '\t\t$salida[] = array(',
      "\t\t\t'id'        => $producto->get_id(),",
      "\t\t\t'nombre'    => $producto->get_name(),",
      "\t\t\t'permalink' => get_permalink( $producto->get_id() ),",
      "\t\t\t'precio'    => $producto->get_price_html(),",
      "\t\t\t'imagen'    => wp_get_attachment_image_url( $producto->get_image_id(), 'medium' ),",
      '\t\t);',
      '\t}',
      '',
      '\treturn $salida;',
      '}'
    ].join('\n'),

  'wp.posts': (config) =>
    [
      '/**',
      ' * Entradas recientes, por WP_Query.',
      ' */',
      `function ${config.fnPrefix}_entradas( $limite ) {`,
      '\t$consulta = new WP_Query(',
      '\t\tarray(',
      "\t\t\t'post_type'           => 'post',",
      '\t\t\t\'posts_per_page\'      => (int) $limite,',
      "\t\t\t'ignore_sticky_posts' => true,",
      "\t\t\t'no_found_rows'       => true,",
      '\t\t)',
      '\t);',
      '',
      '\t$salida = array();',
      '',
      '\tforeach ( $consulta->posts as $entrada ) {',
      '\t\t$salida[] = array(',
      "\t\t\t'id'        => $entrada->ID,",
      "\t\t\t'titulo'    => get_the_title( $entrada ),",
      "\t\t\t'permalink' => get_permalink( $entrada ),",
      "\t\t\t'resumen'   => get_the_excerpt( $entrada ),",
      "\t\t\t'imagen'    => get_the_post_thumbnail_url( $entrada, 'medium' ),",
      '\t\t);',
      '\t}',
      '',
      '\twp_reset_postdata();',
      '',
      '\treturn $salida;',
      '}'
    ].join('\n')
};

const LLAMADAS = {
  'woocommerce.products': (config, dato) => `${config.fnPrefix}_productos( ${dato.limit} )`,
  'wp.posts': (config, dato) => `${config.fnPrefix}_entradas( ${dato.limit} )`
};

function phpDeProveedores(config) {
  const usadas = new Set();
  for (const widget of config.widgets) {
    for (const dato of widget.data) usadas.add(dato.source);
  }

  const bloques = [...usadas].sort().map((fuente) => AYUDANTES[fuente](config));

  for (const widget of config.widgets) {
    const lineas = [
      '/**',
      ` * Datos del widget «${widget.label}».`,
      ' */',
      `function ${config.fnPrefix}_datos_${widget.id.replaceAll('-', '_')}( $ajustes ) {`,
      '\tunset( $ajustes );',
      '',
      '\t$datos = array();'
    ];

    for (const dato of widget.data) {
      lineas.push(`\t$datos['${dato.name}'] = ${LLAMADAS[dato.source](config, dato)};`);
    }

    lineas.push('', '\treturn $datos;', '}');
    bloques.push(lineas.join('\n'));
  }

  return bloques.join('\n\n');
}

function cuerpoDeEjemplo(widget, config) {
  const clase = `${config.slug}-widget`;
  const lineas = [
    '<?php',
    '/**',
    ` * Cuerpo del widget «${widget.label}».`,
    ' *',
    ' * Este es el unico archivo del paquete pensado para editarse a mano: aca',
    ' * entra el markup que el build ya resolvio visualmente, con los valores',
    ' * reemplazados por los controles y los datos.',
    ' *',
    ' * Dos variables llegan preparadas:',
    ' *   $ajustes  lo que cargo el cliente en el panel de Elementor',
    ' *   $datos    lo que aporto WordPress o WooCommerce',
    ' *',
    ' * Todo lo que se imprima tiene que pasar por esc_html, esc_attr, esc_url o',
    ' * wp_kses_post. No hay excepcion que valga la pena.',
    ' */',
    '',
    "defined( 'ABSPATH' ) || exit;",
    '?>',
    `<div class="${clase} ${clase}--${widget.id}">`
  ];

  for (const control of widget.controls.filter((item) => item.esContenido)) {
    if (control.type === 'media') {
      lineas.push(
        `\t<?php if ( ! empty( $ajustes['${control.name}']['url'] ) ) : ?>`,
        `\t<img class="${clase}__${control.name}" src="<?php echo esc_url( $ajustes['${control.name}']['url'] ); ?>" alt="" loading="lazy">`,
        '\t<?php endif; ?>'
      );
    } else if (control.type === 'url') {
      lineas.push(
        `\t<?php if ( ! empty( $ajustes['${control.name}']['url'] ) ) : ?>`,
        `\t<a class="${clase}__${control.name}" href="<?php echo esc_url( $ajustes['${control.name}']['url'] ); ?>"><?php echo esc_html__( 'Ver mas', '${config.slug}' ); ?></a>`,
        '\t<?php endif; ?>'
      );
    } else {
      lineas.push(
        `\t<p class="${clase}__${control.name}"><?php echo esc_html( $ajustes['${control.name}'] ); ?></p>`
      );
    }
  }

  for (const dato of widget.data) {
    const item = dato.source === 'woocommerce.products' ? 'producto' : 'entrada';
    const titulo = dato.source === 'woocommerce.products' ? 'nombre' : 'titulo';

    lineas.push(
      `\t<?php if ( ! empty( $datos['${dato.name}'] ) ) : ?>`,
      `\t<ul class="${clase}__lista">`,
      `\t\t<?php foreach ( $datos['${dato.name}'] as $${item} ) : ?>`,
      `\t\t<li class="${clase}__item">`,
      `\t\t\t<a href="<?php echo esc_url( $${item}['permalink'] ); ?>">`,
      `\t\t\t\t<?php if ( $${item}['imagen'] ) : ?>`,
      `\t\t\t\t<img src="<?php echo esc_url( $${item}['imagen'] ); ?>" alt="<?php echo esc_attr( $${item}['${titulo}'] ); ?>" loading="lazy">`,
      '\t\t\t\t<?php endif; ?>',
      `\t\t\t\t<span class="${clase}__titulo"><?php echo esc_html( $${item}['${titulo}'] ); ?></span>`
    );

    if (dato.source === 'woocommerce.products') {
      lineas.push(
        `\t\t\t\t<span class="${clase}__precio"><?php echo wp_kses_post( $${item}['precio'] ); ?></span>`
      );
    }

    lineas.push('\t\t\t</a>', '\t\t</li>', '\t\t<?php endforeach; ?>', '\t</ul>', '\t<?php endif; ?>');
  }

  lineas.push('</div>', '');
  return lineas.join('\n');
}

function phpDelMapa(config) {
  return config.widgets
    .map((widget) =>
      [
        `\t\t'${widget.id}' => array(`,
        `\t\t\t'label'      => '${widget.label}',`,
        `\t\t\t'class'      => '${nombreDeClase(config, widget)}',`,
        `\t\t\t'class_file' => 'class-${widget.id}.php',`,
        '\t\t),'
      ].join('\n')
    )
    .join('\n');
}

export async function preparar(contexto) {
  const { config } = contexto;

  // Un widget puede declarar de qué página sale su referencia visual. Cuando
  // no lo hace, depende de todas las hojas del sistema: es lo único que se
  // puede afirmar sin adivinar.
  const todasLasHojas = (await listarArchivos(contexto.distDir))
    .map((ruta) => ruta.replaceAll('\\', '/'))
    .filter((ruta) => ruta.toLowerCase().endsWith('.css'));

  const porWidget = new Map();
  const rutas = [...todasLasHojas];
  const origenes = [];
  let assets = 0;

  for (const widget of config.widgets) {
    if (!widget.source) {
      porWidget.set(widget.id, { estilos: todasLasHojas, scripts: [] });
      continue;
    }

    const documento = await contexto.leer(widget.source);
    const partes = separarHead(documento.headCrudo);
    porWidget.set(widget.id, partes);
    rutas.push(...partes.estilos, ...partes.scripts);
    origenes.push(widget.source);
    assets += documento.assets.length;
  }

  const handles = asignarHandles(rutas, config);
  const plantillaClase = await contexto.plantilla('widgets/clase.php');
  const archivos = [];

  for (const widget of config.widgets) {
    const suyos = porWidget.get(widget.id);

    const estilos = [
      `'${config.slug}-isolation'`,
      ...suyos.estilos.filter((ruta) => handles.estilos.has(ruta)).map((ruta) => `'${handles.estilos.get(ruta)}'`)
    ].join(', ');

    const scripts = suyos.scripts
      .filter((ruta) => handles.scripts.has(ruta))
      .map((ruta) => `'${handles.scripts.get(ruta)}'`)
      .join(', ');

    archivos.push({
      ruta: `widgets/class-${widget.id}.php`,
      contenido: render(plantillaClase, config, {
        '{{WIDGET_CLASS}}': nombreDeClase(config, widget),
        '{{WIDGET_NAME}}': `${config.slug}-${widget.id}`,
        '{{WIDGET_ID}}': widget.id,
        '{{WIDGET_FN}}': widget.id.replaceAll('-', '_'),
        '{{WIDGET_LABEL}}': widget.label,
        '{{WIDGET_ICON}}': widget.icon,
        '{{CATEGORY_SLUG}}': config.categorySlug,
        '{{WIDGET_STYLES}}': estilos ? ` ${estilos} ` : '',
        '{{WIDGET_SCRIPTS}}': scripts ? ` ${scripts} ` : '',
        '{{WIDGET_CONTROLS}}': phpDeControles(widget, config)
      })
    });

    archivos.push({ ruta: `widgets/${widget.id}.php`, contenido: cuerpoDeEjemplo(widget, config) });
  }

  return {
    marcadores: {
      '{{WIDGET_MAP}}': phpDelMapa(config),
      '{{ASSET_REGISTRY}}': phpDeRegistro(handles, config),
      '{{DATA_PROVIDERS}}': phpDeProveedores(config),
      '{{CATEGORY}}': config.category,
      '{{CATEGORY_SLUG}}': config.categorySlug
    },
    archivos,
    origenes,
    assets,
    hooks: ['elementor/widgets/register', 'elementor/elements/categories_registered'],
    resumen: {
      category: config.category,
      widgets: config.widgets.map((widget) => ({
        id: widget.id,
        controls: widget.controls.length,
        data: widget.data.map((dato) => dato.source)
      }))
    }
  };
}

export async function despues(contexto) {
  await acotarCssEmpaquetado(contexto.pluginDistDir, alcanceAislamiento(contexto.config));
}

export async function validar(pluginDir, config, { principal }) {
  const problemas = [];

  if (!principal.includes("did_action( 'elementor/loaded' )")) {
    problemas.push('el plugin no comprueba que Elementor esté activo antes de registrar nada');
  }
  if (!principal.includes("add_action( 'elementor/widgets/register'")) {
    problemas.push('el plugin no registra sus widgets con la API oficial de Elementor');
  }
  if (!principal.includes("add_action( 'elementor/elements/categories_registered'")) {
    problemas.push('el plugin no declara una categoría propia');
  }

  for (const widget of config.widgets) {
    const clase = path.join(pluginDir, 'widgets', `class-${widget.id}.php`);
    const contenido = await readFile(clase, 'utf8').catch(() => null);

    if (contenido === null) {
      problemas.push(`falta la clase del widget ${widget.id}: widgets/class-${widget.id}.php`);
      continue;
    }

    if (!contenido.includes('extends \\Elementor\\Widget_Base')) {
      problemas.push(`el widget ${widget.id} no extiende \\Elementor\\Widget_Base`);
    }

    const cuerpo = await readFile(path.join(pluginDir, 'widgets', `${widget.id}.php`), 'utf8').catch(
      () => null
    );

    if (cuerpo === null) {
      problemas.push(`falta el cuerpo del widget ${widget.id}: widgets/${widget.id}.php`);
      continue;
    }

    // Lo que se imprime tiene que pasar por un escapador. Es la clase de error
    // que no se ve hasta que alguien carga un valor con un `<script>` adentro.
    problemas.push(...sinEscapar(cuerpo, `widgets/${widget.id}.php`));
  }

  problemas.push(...(await auditarAislamiento(pluginDir, alcanceAislamiento(config))));

  return problemas;
}

const ESCAPADORES = /^(?:esc_html|esc_attr|esc_url|esc_textarea|esc_js|wp_kses_post|wp_kses|absint|intval|number_format_i18n|esc_html__|esc_attr__)\b/;

/** Busca `echo` de algo que no pasó por un escapador. */
export function sinEscapar(php, nombre) {
  const problemas = [];

  for (const encontrado of php.matchAll(/\becho\s+([^;]+);/g)) {
    const expresion = encontrado[1].trim();

    // Un literal entrecomillado sin interpolación no lleva nada de nadie.
    if (/^'[^']*'$/.test(expresion)) continue;
    if (ESCAPADORES.test(expresion)) continue;

    problemas.push(
      `${nombre}: se imprime sin escapar \`${expresion.slice(0, 60)}\`. ` +
        'Todo lo que venga de un control o de la base de datos pasa por esc_html, esc_attr, esc_url o wp_kses_post.'
    );
  }

  return problemas;
}
