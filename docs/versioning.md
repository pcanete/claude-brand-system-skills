# Versionado y compatibilidad

Cada skill se versiona por separado.

| Skill | Versión | Contrato |
| --- | ---: | --- |
| brand-dna-scanner | 0.4.0 | Brand DNA 0.1.x |
| brand-manual-builder | 0.1.0 | Brand manual spec 0.1.x |
| reference-scanner | 0.8.0 | Web reference schemas 0.3.x |
| reference-lab-builder | 0.3.0 | Reference lab spec 0.1.x |
| reference-to-astro | 1.5.0 | Web reference schemas 0.3.x, SITE_BLUEPRINT 0.1.x |
| visual-tuning-kit | 0.6.0 | Tuning contract 0.1 |
| wordpress-publisher | 0.5.0 | Plugin template 0.1.x |

La versión vive en el frontmatter del `SKILL.md`. La revisión del repositorio
falla si deja de coincidir con esta tabla: una tabla que nada puede contradecir
es decorativa.

## Reglas

- **Patch:** documentación, seguridad, QA o correcciones de comportamiento sin
  cambio de contrato.
- **Minor:** capacidades compatibles o campos opcionales.
- **Major:** esquema, entrada requerida o salida incompatibles.

Endurecer una compuerta merece atención aparte: el esquema no cambia, pero un
documento que ayer validaba hoy puede ser rechazado. Se anota en el CHANGELOG
con esas palabras.
