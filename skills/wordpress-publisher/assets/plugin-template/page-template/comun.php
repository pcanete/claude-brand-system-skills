/**
 * Plantillas de pagina que aporta este paquete.
 *
 * WordPress permite que un plugin agregue plantillas al desplegable de
 * Pagina > Atributos > Plantilla sin tema hijo: alcanza con declararlas en
 * `theme_page_templates` y devolver el archivo propio en `template_include`.
 *
 * El cliente elige cual usa en cada pagina, y vuelve atras cambiando el
 * desplegable. Nada queda atado al tema, y desactivar el plugin devuelve cada
 * pagina a la plantilla que decida el tema activo.
 */
function {{fn_prefix}}_plantillas() {
	return array(
{{PAGE_MAP}}
	);
}

function {{fn_prefix}}_registrar_plantillas( $plantillas ) {
	foreach ( {{fn_prefix}}_plantillas() as $clave => $pagina ) {
		$plantillas[ $clave ] = $pagina['label'];
	}
	return $plantillas;
}
add_filter( 'theme_page_templates', '{{fn_prefix}}_registrar_plantillas' );

/**
 * Que plantilla propia pidio la pagina actual, si es que pidio alguna.
 */
function {{fn_prefix}}_plantilla_elegida() {
	if ( ! is_singular( 'page' ) ) {
		return null;
	}

	$elegida    = (string) get_post_meta( get_the_ID(), '_wp_page_template', true );
	$plantillas = {{fn_prefix}}_plantillas();

	return isset( $plantillas[ $elegida ] ) ? $plantillas[ $elegida ] : null;
}

function {{fn_prefix}}_template_include( $template ) {
	if ( is_admin() || wp_doing_ajax() || is_feed() || is_embed() ) {
		return $template;
	}

	$pagina = {{fn_prefix}}_plantilla_elegida();
	if ( null === $pagina ) {
		return $template;
	}

	$archivo = {{CONST_PREFIX}}_PATH . 'templates/' . $pagina['file'];
	return is_readable( $archivo ) ? $archivo : $template;
}
add_filter( 'template_include', '{{fn_prefix}}_template_include', PHP_INT_MAX );

/**
 * Una clase estable para reglas de compatibilidad y para diagnosticar en vivo.
 */
function {{fn_prefix}}_body_class( $classes ) {
	$pagina = {{fn_prefix}}_plantilla_elegida();

	if ( null !== $pagina ) {
		$classes[] = '{{slug}}';
		$classes[] = '{{slug}}-' . $pagina['id'];
	}

	return $classes;
}
add_filter( 'body_class', '{{fn_prefix}}_body_class' );

/**
 * Prevent activation of an incomplete package.
 */
function {{fn_prefix}}_activate() {
	$required = array(
		{{CONST_PREFIX}}_PATH . 'templates',
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
