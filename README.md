# Motion Analysis Frontend

Interfaz web local para cargar un video de pitching, revisar el skeleton detectado, corregir landmarks frame a frame y descargar el MP4 resultante.

## Requisitos

- Node.js 20 o superior.
- El backend en ejecucion en `http://localhost:8000`.

## Configuracion

El archivo `.env` incluido apunta al backend local:

```env
VITE_API_URL=http://localhost:8000
```

Para otra instalacion, copia `.env.example` como `.env` y ajusta esta URL. Las variables del frontend deben empezar con `VITE_`. Las rutas `/analyze` y `/render` se definen en `src/api.ts`.

## Ejecutar

```bash
npm install
npm run dev
```

Vite mostrara la URL local, normalmente `http://localhost:5173`.

## Build de produccion

```bash
npm run build
npm run preview
```

## Flujo

1. Selecciona un video MP4, MOV, AVI, MKV o WebM.
2. Espera el analisis de pose del backend.
3. Pausa el video, navega frame a frame y arrastra los landmarks necesarios.
4. Genera y descarga el MP4 con el skeleton corregido.
