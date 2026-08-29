<?php
/**
 * Plugin Name: {{PLUGIN_NAME}}
 * Description: {{PLUGIN_DESCRIPTION}}
 * Version: 0.1.3
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: {{PLUGIN_AUTHOR}}
 * Text Domain: {{slug}}
 */

defined( 'ABSPATH' ) || exit;

define( '{{CONST_PREFIX}}_VERSION', '0.1.3' );
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
 * Detects visual styles that belong to the active theme or page builders.
 *
 * This intentionally leaves scripts and unrelated plugin styles alone, so
 * analytics, pixels, consent tools and other WordPress integrations can keep
 * using wp_head() and wp_footer().
 */
function {{fn_prefix}}_is_external_visual_style( $src, $handle = '' ) {
	$src    = strtolower( (string) $src );
	$handle = strtolower( (string) $handle );

	$blocked_sources = array(
		'/wp-content/themes/',
		'/plugins/astra-addon/',
		'/uploads/astra/',
		'/uploads/astra-addon/',
		'/plugins/elementor/',
		'/plugins/elementor-pro/',
		'/uploads/elementor/',
		'/plugins/woocommerce/assets/',
		'/plugins/woocommerce/packages/woocommerce-blocks/',
	);

	foreach ( $blocked_sources as $blocked_source ) {
		if ( false !== strpos( $src, $blocked_source ) ) {
			return true;
		}
	}

	return 0 === strpos( $handle, 'elementor-gf-' );
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
			wp_dequeue_style( $handle );
		}
	}
}
add_action( 'wp_enqueue_scripts', '{{fn_prefix}}_dequeue_external_visual_styles', PHP_INT_MAX );

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
