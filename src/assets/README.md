# Recursos visuales

Esta carpeta contiene recursos que se importan desde el código de React/Vite.

- `images/`: fotografías, ilustraciones y fondos de interfaz.
- `icons/`: SVG propios que no pertenezcan a `@mui/icons-material`.
- `brand/`: logo, marcas y variantes de la identidad visual.

Para recursos estáticos que deban conservar una URL fija (por ejemplo, `favicon.ico`, `manifest.webmanifest` u `og-image.png`), usar `public/` en la raíz del proyecto. Vite los publica sin procesarlos.

Preferir `@mui/icons-material` para iconos de interfaz habituales. Importar los recursos de esta carpeta mediante rutas relativas o alias desde TypeScript, para que Vite pueda optimizarlos durante el build.
