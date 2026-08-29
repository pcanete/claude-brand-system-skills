<?php
/**
 * Generated WordPress front-page template.
 *
 * The compiled fragments below are refreshed by:
 * npm run build:wordpress
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="theme-color" content="#171717">
	<?php if ( ! current_theme_supports( 'title-tag' ) ) : ?>
		<title><?php echo esc_html( wp_get_document_title() ); ?></title>
	<?php endif; ?>
	<?php wp_head(); ?>
	<link
		rel="stylesheet"
		id="{{slug}}-isolation-css"
		href="<?php echo esc_url( {{CONST_PREFIX}}_URL . 'assets/wordpress-isolation.css' ); ?>"
		media="all"
	>
	<!-- COMPILED_HEAD -->
</head>
<body <?php body_class(); ?>>
	<?php wp_body_open(); ?>
	<!-- COMPILED_BODY -->
	<?php wp_footer(); ?>
</body>
</html>
