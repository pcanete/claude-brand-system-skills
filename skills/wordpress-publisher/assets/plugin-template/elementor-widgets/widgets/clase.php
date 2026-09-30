<?php
/**
 * Widget «{{WIDGET_LABEL}}».
 *
 * Lo genera `wordpress-publisher` a partir de la declaracion del widget en
 * `wordpress.config.json`. Los controles y las fuentes de datos salen de ahi;
 * el cuerpo visible vive aparte, en `widgets/{{WIDGET_ID}}.php`, que es el
 * unico archivo de este modo pensado para editarse a mano.
 */

defined( 'ABSPATH' ) || exit;

class {{WIDGET_CLASS}} extends \Elementor\Widget_Base {

	public function get_name() {
		return '{{WIDGET_NAME}}';
	}

	public function get_title() {
		return esc_html__( '{{WIDGET_LABEL}}', '{{slug}}' );
	}

	public function get_icon() {
		return '{{WIDGET_ICON}}';
	}

	public function get_categories() {
		return array( '{{CATEGORY_SLUG}}' );
	}

	public function get_style_depends() {
		return array({{WIDGET_STYLES}});
	}

	public function get_script_depends() {
		return array({{WIDGET_SCRIPTS}});
	}

	protected function register_controls() {
		$this->start_controls_section(
			'{{WIDGET_FN}}_contenido',
			array( 'label' => esc_html__( 'Contenido', '{{slug}}' ) )
		);

{{WIDGET_CONTROLS}}

		$this->end_controls_section();
	}

	protected function render() {
		$ajustes = $this->get_settings_for_display();
		$datos   = {{fn_prefix}}_datos_{{WIDGET_FN}}( $ajustes );

		include {{CONST_PREFIX}}_PATH . 'widgets/{{WIDGET_ID}}.php';
	}
}
