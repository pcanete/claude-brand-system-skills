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

