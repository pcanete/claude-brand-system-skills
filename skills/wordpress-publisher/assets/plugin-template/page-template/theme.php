
/**
 * Variante `theme`: la pagina compilada vive adentro del documento del tema.
 *
 * La cabecera y el pie del cliente siguen siendo los suyos, asi que el CSS
 * compilado no puede imprimirse crudo en el head: se registra y se encola, y
 * solo en las paginas que usan una plantilla propia. El resto del sitio no
 * paga nada por tener este plugin instalado.
 */
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

function {{fn_prefix}}_encolar_assets() {
	$pagina = {{fn_prefix}}_plantilla_elegida();
	if ( null === $pagina ) {
		return;
	}

	wp_enqueue_style( '{{slug}}-isolation' );

	foreach ( $pagina['styles'] as $handle ) {
		wp_enqueue_style( $handle );
	}

	foreach ( $pagina['scripts'] as $handle ) {
		wp_enqueue_script( $handle );
	}
}
add_action( 'wp_enqueue_scripts', '{{fn_prefix}}_encolar_assets', 20 );

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
 * Lo que quedo del head compilado: precargas, estilos en linea y metadatos de
 * la pieza. Solo en las paginas propias.
 */
function {{fn_prefix}}_head_compilado() {
	$pagina = {{fn_prefix}}_plantilla_elegida();
	if ( null === $pagina ) {
		return;
	}

	$archivo = {{CONST_PREFIX}}_PATH . 'templates/head-' . $pagina['id'] . '.php';
	if ( is_readable( $archivo ) ) {
		include $archivo;
	}
}
add_action( 'wp_head', '{{fn_prefix}}_head_compilado', 20 );
