/**
 * Widgets propios para Elementor.
 *
 * Este modo existe para lo que de verdad tiene que ser editable o dinamico
 * adentro del constructor. Todo lo que no lo sea vive mejor en la pagina
 * compilada, que es donde el diseño conserva su forma.
 *
 * Los widgets se registran en una categoria propia, con las APIs oficiales, y
 * solo si Elementor esta activo. Sin Elementor, el plugin no hace nada: los
 * enganches existen pero no los dispara nadie.
 */
function {{fn_prefix}}_widgets() {
	return array(
{{WIDGET_MAP}}
	);
}

function {{fn_prefix}}_revisar_elementor() {
	if ( did_action( 'elementor/loaded' ) ) {
		return;
	}

	add_action( 'admin_notices', '{{fn_prefix}}_aviso_sin_elementor' );
}
add_action( 'plugins_loaded', '{{fn_prefix}}_revisar_elementor', 20 );

function {{fn_prefix}}_aviso_sin_elementor() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	echo '<div class="notice notice-warning"><p>';
	echo esc_html__(
		'Este paquete aporta widgets para Elementor, y Elementor no esta activo. Mientras tanto no hace nada: no rompe nada, pero tampoco aparece.',
		'{{slug}}'
	);
	echo '</p></div>';
}

/**
 * Una categoria propia: los widgets del sistema no se mezclan con los del
 * constructor ni con los de otros plugins.
 */
function {{fn_prefix}}_categoria( $elementos ) {
	$elementos->add_category(
		'{{CATEGORY_SLUG}}',
		array(
			'title' => esc_html__( '{{CATEGORY}}', '{{slug}}' ),
			'icon'  => 'eicon-parallax',
		)
	);
}
add_action( 'elementor/elements/categories_registered', '{{fn_prefix}}_categoria' );

function {{fn_prefix}}_registrar_widgets( $widgets ) {
	foreach ( {{fn_prefix}}_widgets() as $widget ) {
		$archivo = {{CONST_PREFIX}}_PATH . 'widgets/' . $widget['class_file'];

		if ( ! is_readable( $archivo ) ) {
			continue;
		}

		require_once $archivo;

		$clase = $widget['class'];
		if ( class_exists( $clase ) ) {
			$widgets->register( new $clase() );
		}
	}
}
add_action( 'elementor/widgets/register', '{{fn_prefix}}_registrar_widgets' );

/**
 * Las hojas y los modulos del sistema, registrados con handles propios.
 *
 * Cada widget declara de cuales depende; Elementor los encola solo en las
 * paginas donde ese widget aparece.
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
add_action( 'elementor/editor/after_enqueue_styles', '{{fn_prefix}}_registrar_assets' );

{{DATA_PROVIDERS}}

/**
 * Prevent activation of an incomplete package.
 */
function {{fn_prefix}}_activate() {
	$required = array(
		{{CONST_PREFIX}}_PATH . 'widgets',
		{{CONST_PREFIX}}_PATH . 'dist',
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
