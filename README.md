# Motion Analysis Frontend

Cliente React de la plataforma multiusuario Motion Analysis. El navegador consume exclusivamente el core NestJS; FastAPI queda reservado para comunicación interna desde el core.

## Configuración

```env
VITE_API_URL=http://localhost:3000
```

## Desarrollo

```powershell
npm install
npm run dev
```

El flujo incluye registro/login, biblioteca persistente, upload, historial de análisis, corrección de landmarks, slow motion y render MP4. La sesión se mantiene mediante cookie JWT HttpOnly emitida por NestJS.

## Verificación

```powershell
npm test
npm run build
```
