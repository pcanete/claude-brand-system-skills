<?php
/**
 * Plugin Name: {{PLUGIN_NAME}}
 * Description: {{PLUGIN_DESCRIPTION}}
 * Version: {{PLUGIN_VERSION}}
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: {{PLUGIN_AUTHOR}}
 * Text Domain: {{slug}}
 */

defined( 'ABSPATH' ) || exit;

define( '{{CONST_PREFIX}}_VERSION', '{{PLUGIN_VERSION}}' );
define( '{{CONST_PREFIX}}_PATH', plugin_dir_path( __FILE__ ) );
define( '{{CONST_PREFIX}}_URL', plugin_dir_url( __FILE__ ) );

/**
 * Replaces only the public site front page.
 *
 * WordPress keeps handling every other route, including WooCommerce,
 * account, registration, search, feeds and administration screens.
 */
function {{fn_prefix}}_template_include( $template ) {
	if (
		is_admin()
		|| wp_doing_ajax()
		|| is_feed()
		|| is_embed()
		|| ! is_front_page()
	) {
		return $template;
	}

	$front_page = {{CONST_PREFIX}}_PATH . 'templates/front-page.php';
	return is_readable( $front_page ) ? $front_page : $template;
}
add_filter( 'template_include', '{{fn_prefix}}_template_include', PHP_INT_MAX );

/**
 * Adds a stable class for compatibility rules and production diagnostics.
 */
function {{fn_prefix}}_body_class( $classes ) {
	if ( is_front_page() ) {
		$classes[] = '{{slug}}';
	}
	return $classes;
}
add_filter( 'body_class', '{{fn_prefix}}_body_class' );

/**
 * Decide que hojas de estilo entran en la portada compilada.
 *
 * Es una lista blanca, no negra. La portada trae su propio CSS y sus propias
 * fuentes: nada de lo que enfile el resto del sitio le hace falta. Una lista
 * negra obliga a perseguir cada plugin nuevo que se instale, y el que no se
 * persiga se filtra sin que nadie lo note.
 *
 * Solo toca hojas de estilo. Los scripts siguen intactos, asi que analitica,
 * pixeles, consentimiento y demas integraciones conservan wp_head() y
 * wp_footer().
 */
function {{fn_prefix}}_is_external_visual_style( $src, $handle = '' ) {
	$src    = strtolower( (string) $src );
	$handle = strtolower( (string) $handle );

	$allowed_handles = array(
		'{{PLUGIN_SLUG}}-isolation',
		// Interfaz de WordPress para quien esta logueado: sin esto la barra de
		// administracion aparece rota sobre la portada.
		'admin-bar',
		'dashicons',
	);

	/*
	 * Componentes de WordPress que la portada aloja a proposito -popups,
	 * banners de consentimiento, chat, mini-carrito- necesitan su CSS. Se
	 * declaran en wordpress.config.json y se auditan antes con
	 * `scripts/audit-foreign-css.mjs`, que mide cuanto de esa hoja es global
	 * y cuanto se acota sola.
	 */
	$declared = array({{ALLOWED_STYLES}});
	$allowed_handles = array_merge( $allowed_handles, $declared );

	$allowed_handles = (array) apply_filters(
		'{{fn_prefix}}_allowed_styles',
		$allowed_handles
	);

	foreach ( $allowed_handles as $allowed ) {
		$allowed = strtolower( (string) $allowed );

		// Un sufijo `*` permite una familia de handles generados, como los
		// `elementor-post-1234` que Elementor emite por cada popup.
		if ( '*' === substr( $allowed, -1 ) ) {
			if ( 0 === strpos( $handle, substr( $allowed, 0, -1 ) ) ) {
				return false;
			}
			continue;
		}

		if ( $handle === $allowed ) {
			return false;
		}
	}

	// Lo que sirve el propio plugin pasa siempre, venga del handle que venga.
	if ( false !== strpos( $src, '/plugins/{{PLUGIN_SLUG}}/' ) ) {
		return false;
	}

	return true;
}

/**
 * Removes visual CSS from the theme/builders on the custom front page only.
 */
function {{fn_prefix}}_dequeue_external_visual_styles() {
	if ( ! is_front_page() || is_admin() ) {
		return;
	}

	global $wp_styles;
	if ( ! ( $wp_styles instanceof WP_Styles ) ) {
		return;
	}

	foreach ( (array) $wp_styles->queue as $handle ) {
		$registered = isset( $wp_styles->registered[ $handle ] ) ? $wp_styles->registered[ $handle ] : null;
		$src        = $registered ? $registered->src : '';
		if ( {{fn_prefix}}_is_external_visual_style( $src, $handle ) ) {
			{{fn_prefix}}_record_removed_style( $handle, $src );
			wp_dequeue_style( $handle );
		}
	}
}
add_action( 'wp_enqueue_scripts', '{{fn_prefix}}_dequeue_external_visual_styles', PHP_INT_MAX );

/**
 * Guarda que se quito, para poder decirlo despues.
 */
function {{fn_prefix}}_record_removed_style( $handle, $src = '' ) {
	global {{const_global}};
	if ( ! isset( {{const_global}} ) || ! is_array( {{const_global}} ) ) {
		{{const_global}} = array();
	}
	{{const_global}}[ $handle ] = $src;
}

/**
 * Informe de lo que la lista blanca dejo afuera.
 *
 * Cuando un componente de WordPress aparece en la portada sin estilos, la
 * pregunta es siempre la misma: que handle hay que declarar. Adivinarlo cuesta
 * varias vueltas de subir el plugin y mirar. Esto lo responde de una.
 *
 * Solo para quien puede administrar el sitio, y solo si lo pide: un visitante
 * nunca ve nada de esto.
 */
function {{fn_prefix}}_report_removed_styles() {
	if ( ! is_front_page() || ! current_user_can( 'manage_options' ) ) {
		return;
	}

	if ( ! isset( $_GET['{{slug}}-styles'] ) || 'audit' !== $_GET['{{slug}}-styles'] ) {
		return;
	}

	global {{const_global}};
	$removed = ( isset( {{const_global}} ) && is_array( {{const_global}} ) ) ? {{const_global}} : array();

	echo "
<!-- {{PLUGIN_NAME}}: hojas de estilo quitadas de la portada -->
";

	if ( empty( $removed ) ) {
		echo "<!--   ninguna: nada ajeno intento entrar -->
";
		return;
	}

	foreach ( $removed as $handle => $src ) {
		$origen = $src ? preg_replace( '#^https?://[^/]+#', '', (string) $src ) : 'sin src';
		printf(
			"<!--   %s   %s -->
",
			esc_html( $handle ),
			esc_html( $origen )
		);
	}

	echo "<!-- Para permitir alguna, agregala a allowedStyles en wordpress.config.json -->
";
	echo "<!-- y audita antes su CSS con scripts/audit-foreign-css.mjs -->
";
}
add_action( 'wp_footer', '{{fn_prefix}}_report_removed_styles', PHP_INT_MAX );

/**
 * Last-resort guard for builder styles printed after the enqueue phase.
 */
function {{fn_prefix}}_filter_external_visual_style_tag( $html, $handle, $href, $media ) {
	unset( $media );
	if ( is_front_page() && {{fn_prefix}}_is_external_visual_style( $href, $handle ) ) {
		return '';
	}
	return $html;
}
add_filter( 'style_loader_tag', '{{fn_prefix}}_filter_external_visual_style_tag', PHP_INT_MAX, 4 );

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
