/**
 * Paginas compiladas insertables con un shortcode.
 *
 *   [{{SHORTCODE}} id="..."]
 *
 * El fragmento entra adentro del contenido de WordPress: la cabecera, el pie,
 * la barra lateral y todo lo demas siguen siendo del tema. Por eso el CSS
 * compilado viaja acotado bajo una raiz propia, y los assets se encolan en vez
 * de imprimirse: una pagina que no usa el shortcode no descarga nada.
 */
function {{fn_prefix}}_paginas() {
	return array(
{{PAGE_MAP}}
	);
}

function {{fn_prefix}}_registrar_assets() {
	wp_register_style(
		'{{slug}}-isolation',
		{{CONST_PREFIX}}_URL . 'assets/wordpress-isolation.css',
		array(),
		{{CONST_PREFIX}}_VERSION
	);

{{ASSET_REGISTRY}}
}
add_action( 'wp_enqueue_scripts', '{{fn_prefix}}_registrar_assets', 5 );

/**
 * Encola lo que necesita una pagina concreta.
 *
 * Es idempotente: WordPress ignora un encolado repetido, asi que se puede
 * llamar tanto desde la deteccion temprana como desde el shortcode.
 */
function {{fn_prefix}}_encolar( $id ) {
	$paginas = {{fn_prefix}}_paginas();
	if ( ! isset( $paginas[ $id ] ) ) {
		return;
	}

	wp_enqueue_style( '{{slug}}-isolation' );

	foreach ( $paginas[ $id ]['styles'] as $handle ) {
		wp_enqueue_style( $handle );
	}

	foreach ( $paginas[ $id ]['scripts'] as $handle ) {
		wp_enqueue_script( $handle );
	}
}

/**
 * Deteccion temprana.
 *
 * Un shortcode corre durante `the_content`, o sea despues de `wp_head`: si se
 * encola recien ahi, la hoja sale en el pie y la pieza se ve sin estilos por un
 * instante. Leer el contenido antes evita ese parpadeo.
 *
 * `get_shortcode_regex` es la forma que tiene WordPress de reconocer sus
 * propios shortcodes, incluida la escapada con dobles corchetes.
 */
function {{fn_prefix}}_encolar_temprano() {
	if ( ! is_singular() ) {
		return;
	}

	$entrada = get_post();
	if ( ! $entrada || ! is_string( $entrada->post_content ) ) {
		return;
	}

	if ( false === strpos( $entrada->post_content, '[{{SHORTCODE}}' ) ) {
		return;
	}

	$patron = get_shortcode_regex( array( '{{SHORTCODE}}' ) );
	if ( ! preg_match_all( '/' . $patron . '/', $entrada->post_content, $encontrados, PREG_SET_ORDER ) ) {
		return;
	}

	foreach ( $encontrados as $encontrado ) {
		$atributos = shortcode_parse_atts( isset( $encontrado[3] ) ? $encontrado[3] : '' );
		$id        = is_array( $atributos ) && isset( $atributos['id'] ) ? sanitize_key( $atributos['id'] ) : '{{DEFAULT_PAGE}}';
		{{fn_prefix}}_encolar( $id );
	}
}
add_action( 'wp_enqueue_scripts', '{{fn_prefix}}_encolar_temprano', 20 );

/**
 * Astro emite modulos ES, y WordPress no tiene forma declarativa de decirlo.
 */
function {{fn_prefix}}_como_modulo( $tag, $handle, $src ) {
	if ( 0 !== strpos( (string) $handle, '{{slug}}-script-' ) ) {
		return $tag;
	}

	return '<script type="module" src="' . esc_url( $src ) . '" id="' . esc_attr( $handle ) . '-js"></script>' . "\n";
}
add_filter( 'script_loader_tag', '{{fn_prefix}}_como_modulo', 10, 3 );

/**
 * El shortcode.
 *
 * El `id` que llega de afuera no toca el disco: solo sirve para buscar en el
 * mapa que genero el exportador. El nombre del archivo sale del mapa, nunca del
 * parametro.
 *
 * Un id que no existe no dibuja nada y no dice nada en el frente: un visitante
 * no tiene por que enterarse de como esta armado el sitio. Para quien
 * administra, queda un comentario en el HTML.
 */
function {{fn_prefix}}_shortcode( $atributos ) {
	$atributos = shortcode_atts(
		array( 'id' => '{{DEFAULT_PAGE}}' ),
		$atributos,
		'{{SHORTCODE}}'
	);

	$id      = sanitize_key( $atributos['id'] );
	$paginas = {{fn_prefix}}_paginas();

	if ( ! isset( $paginas[ $id ] ) ) {
		return current_user_can( 'edit_posts' )
			? '<!-- {{PLUGIN_NAME}}: no hay ninguna pagina con id ' . esc_html( $id ) . ' -->'
			: '';
	}

	$archivo = {{CONST_PREFIX}}_PATH . 'fragments/' . $paginas[ $id ]['fragment'];
	if ( ! is_readable( $archivo ) ) {
		return '';
	}

	{{fn_prefix}}_encolar( $id );

	ob_start();
	include $archivo;
	return ob_get_clean();
}
add_shortcode( '{{SHORTCODE}}', '{{fn_prefix}}_shortcode' );

/**
 * Prevent activation of an incomplete package.
 */
function {{fn_prefix}}_activate() {
	$required = array(
		{{CONST_PREFIX}}_PATH . 'fragments',
		{{CONST_PREFIX}}_PATH . 'dist/_astro',
	);

	foreach ( $required as $path ) {
		if ( ! file_exists( $path ) ) {
			deactivate_plugins( plugin_basename( __FILE__ ) );
			wp_die(
				esc_html__( 'El paquete esta incompleto. Volve a generar y subir el ZIP completo.', '{{slug}}' ),
				esc_html__( 'No se pudo activar el plugin', '{{slug}}' ),
				array( 'back_link' => true )
			);
		}
	}
}
register_activation_hook( __FILE__, '{{fn_prefix}}_activate' );
