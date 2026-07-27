# Fijazo — frontend

Interfaz React + TypeScript + Vite para la plataforma de Fijazo, migrada a microservicios
([Fijazo-Horrrocruxes-SRMC](https://github.com/Saint-Roche-Microsystems/Fijazo-Horrrocruxes-SRMC)).
Toda la app va contra el **api-gateway** (único punto de entrada público), que hace proxy hacia
auth-service, users-service, bets-service y progression-service: autenticación JWT, apuestas,
estadísticas, ranking, rangos y logros.

## Puesta en marcha

1. Levanta el stack completo desde el repo maestro (por defecto el gateway queda en
   `http://localhost:3000`; ver su `README.md` — `node scripts/bootstrap.mjs` seguido de
   `docker compose up --build -d`, o `node scripts/local_run.mjs` para levantar cada servicio a
   mano). El origen de este frontend debe estar en `CORS_ORIGINS` del **api-gateway**
   (`api-gateway/.env`), no en cada microservicio.
2. Configura el entorno y arranca:

```bash
cp .env.example .env   # VITE_API_URL apunta al api-gateway
npm install
npm run dev            # http://localhost:5173
```

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base URL del api-gateway. |

## Autenticación

El token JWT se guarda en `localStorage` (`fijazo_token`) y se envía como `Authorization: Bearer`
en cada request. Si la API responde `401` (token expirado) o `403` (cuenta desactivada por un
admin), la sesión se cierra y se redirige a `/login`. No hay refresh token: al expirar hay que
volver a entrar.

Crea tu cuenta desde `/login` → «Regístrate», o usa el admin del seed de la API.

## Despliegue en Vercel

Proyecto estático con el preset de Vite. `vercel.json` reescribe todas las rutas a
`/index.html`: sin eso, recargar `/historial` o entrar por enlace directo daría **404**,
porque el enrutado lo hace React Router en el cliente.

1. **Framework Preset**: Vite. **Root Directory**: `.` (este repo solo contiene el frontend;
   el backend vive en [Fijazo-Horrrocruxes-SRMC](https://github.com/Saint-Roche-Microsystems/Fijazo-Horrrocruxes-SRMC)).
2. **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `VITE_API_URL` | URL pública del **api-gateway** desplegado (sin barra final) |

   Se hornea en el bundle **en tiempo de build**: si la cambias, hay que redesplegar. Las
   variables definidas en Vercel tienen prioridad sobre cualquier `.env` local.
3. **Deploy**:

   ```bash
   vercel --prod
   ```

Después, en el **api-gateway** hay que añadir la URL del frontend a `CORS_ORIGINS`, o el
navegador bloqueará todas las llamadas. Para que funcionen también los preview deployments, define
`CORS_ORIGIN_REGEX` en la API (ver su README).

## Estructura

| Ruta | Descripción |
|---|---|
| `src/lib/api.ts` | Cliente HTTP: token, query params, errores (`detail` de FastAPI) y descargas binarias. |
| `src/lib/auth.tsx` | `AuthProvider` / `useAuth`: login, registro, logout y expiración de sesión. |
| `src/lib/bets.ts` | Cálculos derivados en cliente (beneficio, series de bankroll, yield por casa…). |
| `src/hooks/useApi.ts` | `useApiQuery`: fetch con estados de carga/error y `reload()`. |
| `src/types/api.ts` | Tipos que reflejan los schemas de la API. |

## Pantallas y endpoints

| Pantalla | Endpoints |
|---|---|
| Login / Registro | `POST /auth/login`, `POST /auth/register`, `GET /users/me` |
| Dashboard | `GET /statistics/me`, `GET /bets`, `GET /achievements/me` |
| Nuevo pronóstico | `POST /bets` (simple y parlay con `legs`) |
| Historial | `GET /bets` (paginado + filtros de estado/tipo), `DELETE /bets/{id}` |
| Importar XLSX | `GET /bets/template`, `POST /bets/import` |
| Estadísticas | `GET /statistics/me`, `GET /bets` |
| Ranking | `GET /ranks`, `GET /ranks/me`, `GET /ranking/top`, `GET /ranking/me`, `GET /achievements/me` |
| Importar Imagen | Sin conexión: la API no expone OCR todavía (maqueta). |

Notas de integración:

- La API no filtra por texto ni por rango de fechas, así que la búsqueda del historial y el
  selector de periodo del dashboard recortan en cliente sobre las apuestas ya cargadas.
- Crear, borrar o importar apuestas recalcula estadísticas, ranking y logros en el backend; las
  pantallas afectadas se refrescan bajo demanda (no hay push).

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # typecheck + build de producción
npm run lint     # oxlint
```
