<?php
/**
 * Plantilla de pagina compilada, variante `theme`.
 *
 * La cabecera y el pie los sigue poniendo el tema del cliente: esta plantilla
 * aporta solo el cuerpo de la pieza, envuelto en una raiz propia. El CSS
 * compilado viaja acotado bajo esa raiz, asi que no alcanza a nada de lo que
 * el tema dibuja alrededor.
 *
 * La regenera `wordpress-publisher`. Editarla a mano se pierde en el proximo
 * build.
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<div class="{{slug}}-root {{slug}}-root--{{PAGE_ID}}">
	<!-- COMPILED_BODY -->
</div>
<?php
get_footer();
