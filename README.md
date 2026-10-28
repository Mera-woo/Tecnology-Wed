# Tecnology-Wed

Es un proyecto escolar, en el cual nos estamos basando en un herramienta wed de toma de notas de clases. en la cual sera
una manera de almacenar toda la informacion para el estudiante.

/* =================================================================

   PNotas - Estructura Base de la Aplicacion
   
   -----------------------------------------------------------------

    1)<!--  BARRA DE NAVEGACION (logo + boton de modo claro/oscuro) -->

    2)<!--  VISTA 1: INICIAR SESION -->

    3)<!--  VISTA 2: PANEL PRINCIPAL DE NOTAS -->

    4)<!--  FUNCIONALIDAD: CREAR / EDITAR NOTA -->

/* =================================================================

   PNotas - Motor de la aplicacion
   
   -----------------------------------------------------------------
   
   El codigo esta separado por bloques, cada uno agrupa una
   funcionalidad completa para que sea comodo de leer y ampliar:
   
     1) MODO CLARO / OSCURO
     
     2) NAVEGACION ENTRE VISTAS (login -> panel)
     
     3) ALMACENAMIENTO DE NOTAS (guardar / leer en el navegador)
     
     4) PINTAR NOTAS EN PANTALLA
     
     5) MODAL: CREAR Y EDITAR NOTA
     
     6) ELIMINAR NOTA
     
     7) BUSCADOR DE NOTAS
     
   ================================================================= */

## Cómo ejecutarlo

Abre la carpeta con un servidor local (por ejemplo `python3 -m http.server`) y entra a `http://localhost:8000`.
Hace falta servidor porque `Funcionalidad.json` se carga con `fetch`.

Cuenta de prueba: `demo@pnotas.edu` / `Pnotas2026`

## Qué incluye

- Inicio de sesión con validaciones (correo, contraseña, intentos limitados). Si el correo no está registrado, se abre el registro con el correo ya escrito.
- Registro con validación de nombre, correo duplicado, contraseña (8+ caracteres, letra y número, medidor de fuerza) y confirmación.
- Notas separadas por cuenta, con materia, filtros, buscador y "Deshacer" al eliminar.
- Diseño glass + neumorfismo, modo claro/oscuro, responsive.
- `Funcionalidad.json` (v2): `usuarios` de prueba y `notas` iniciales (se conservan las notas originales).

> Es un proyecto sin servidor: las cuentas viven en el navegador (claves con hash PBKDF2), lo cual no sustituye una autenticación real en backend.
