# Versionado y compatibilidad

Cada skill se versiona por separado.

| Skill | Versión | Contrato |
| --- | ---: | --- |
| brand-dna-scanner | 0.4.0 | Brand DNA 0.1.x |
| reference-scanner | 0.7.0 | Web reference schemas 0.3.x |
| reference-to-astro | 0.7.0 | Web reference schemas 0.3.x |
| site-tuner | 0.3.0 | Tuning contract 1.0 |
| wordpress-publisher | 0.1.0 | Plugin template 0.1.x |

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
