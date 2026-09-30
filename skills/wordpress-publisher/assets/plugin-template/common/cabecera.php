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

/*
 * Dos copias del mismo plugin activas a la vez se pisan: declaran las mismas
 * constantes y las mismas funciones, y PHP corta con "Cannot redeclare". No es
 * hipotetico: paso con un paquete generado desde una carpeta de trabajo
 * desactualizada, cuyo numero de version quedo por encima del que estaba vivo.
 *
 * La segunda copia se retira sola y lo avisa, en vez de tumbar el sitio.
 */
if ( defined( '{{CONST_PREFIX}}_VERSION' ) ) {
	add_action(
		'admin_notices',
		static function () {
			echo '<div class="notice notice-error"><p>';
			echo esc_html__(
				'Hay dos copias de este plugin instaladas. Solo una quedo activa: desactiva y borra la otra antes de seguir.',
				'{{slug}}'
			);
			echo '</p></div>';
		}
	);
	return;
}

define( '{{CONST_PREFIX}}_VERSION', '{{PLUGIN_VERSION}}' );
define( '{{CONST_PREFIX}}_PATH', plugin_dir_path( __FILE__ ) );
define( '{{CONST_PREFIX}}_URL', plugin_dir_url( __FILE__ ) );
define( '{{CONST_PREFIX}}_MODE', '{{MODE}}' );

