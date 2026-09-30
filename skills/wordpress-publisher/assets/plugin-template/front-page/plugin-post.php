
/**
 * Prevent activation of an incomplete package.
 */
function {{fn_prefix}}_activate() {
	$required = array(
		{{CONST_PREFIX}}_PATH . 'templates/front-page.php',
		{{CONST_PREFIX}}_PATH . 'dist/_astro',
		{{CONST_PREFIX}}_PATH . 'dist/assets',
	);

	foreach ( $required as $path ) {
		if ( ! file_exists( $path ) ) {
			deactivate_plugins( plugin_basename( __FILE__ ) );
			wp_die(
				esc_html__( 'El paquete de {{PLUGIN_NAME}} está incompleto. Volvé a generar y subir el ZIP completo.', '{{slug}}' ),
				esc_html__( 'No se pudo activar {{PLUGIN_NAME}}', '{{slug}}' ),
				array( 'back_link' => true )
			);
		}
	}
}
register_activation_hook( __FILE__, '{{fn_prefix}}_activate' );
