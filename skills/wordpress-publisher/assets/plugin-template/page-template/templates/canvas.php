<?php
/**
 * Plantilla de pagina compilada, variante `canvas`.
 *
 * El documento es casi entero de la pieza: doctype, head y body propios. Lo
 * que se conserva intacto son los tres enganches de WordPress -wp_head(),
 * wp_body_open() y wp_footer()-, que es por donde entran analitica, pixeles,
 * consentimiento y cualquier otro plugin del sitio.
 *
 * La regenera `wordpress-publisher`. Editarla a mano se pierde en el proximo
 * build.
 */

defined( 'ABSPATH' ) || exit;
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
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
