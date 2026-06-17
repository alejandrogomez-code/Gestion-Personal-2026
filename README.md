# Gestor Personal

App web de gestión personal modular, **mobile-first**, hecha con **Next.js + React + Supabase** y lista para desplegar en **Vercel**. Toda la lógica vive en un único archivo principal: `app/page.jsx`.

## Módulos
1. **Objetivos** — metas con avances semanales y gráfico de anillo.
2. **Economía** — cuentas, movimientos (con flujo de confirmación) e informes mensuales.
3. **Buenos Hábitos** — comida, actividad física, resumen calórico diario, peso/IMC y lectura.
4. **Tenis** — partidos, efectividad y evolución.
5. **Diario Personal** — ánimo, energía, estrés, nota libre, logros y mejoras (+ correlaciones IA).
6. **Configuración** — perfil, categorías, paletas, modo claro/oscuro y moneda.

---

## 1. Configurar Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo.
2. En **SQL Editor → New query**, pegá el contenido de `supabase_schema.sql` y ejecutá **Run**. Esto crea las 14 tablas, el trigger `updated_at` y las políticas **RLS** (cada usuario ve solo sus datos).
3. En **Authentication → Providers**, dejá habilitado **Email**. Para probar rápido podés desactivar “Confirm email” en *Authentication → Sign In / Providers* (opcional).
4. En **Project Settings → API**, copiá:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Creá un archivo `.env.local` (copiando `.env.local.example`) con esos dos valores.

> Tras registrarte la primera vez, podés cargar las categorías de ejemplo descomentando el bloque final del `.sql` y reemplazando `TU-UID` por tu `auth.uid()` (lo ves en *Authentication → Users*). También podés crearlas desde **Configuración → Categorías**.

## 2. Correr localmente

```bash
npm install
npm run dev        # http://localhost:3000
```

Si faltan las variables de entorno, la app muestra una pantalla indicándolo en vez de romperse.

## 3. Subir a GitHub

```bash
git init
git add .
git commit -m "Gestor Personal: versión inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gestor-personal.git
git push -u origin main
```

`.gitignore` ya excluye `node_modules`, `.next` y `.env.local`, así que tus claves no se suben.

## 4. Desplegar en Vercel

1. Entrá a [vercel.com](https://vercel.com) → **Add New → Project** e importá el repo de GitHub.
2. Framework detectado: **Next.js** (no toques el build).
3. En **Environment Variables** agregá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY` *(opcional — activa la IA real; sin ella se usan estimaciones locales)*
   - `AI_MODEL` *(opcional, por defecto `claude-haiku-4-5-20251001`)*
4. **Deploy**. Cada `git push` a `main` redeploya automáticamente.
5. En Supabase → **Authentication → URL Configuration**, agregá tu dominio de Vercel a *Redirect URLs*.

---

## 5. Cómo ampliar la IA

La integración ya viene armada en **`app/api/ai/route.js`** (una API Route de Next.js que corre en el servidor). Llama a Claude usando `ANTHROPIC_API_KEY` y soporta 4 tareas: `meal_calories`, `activity_calories`, `weight_opinion` y `wellbeing_insights`. La key vive solo en el servidor, así que nunca llega al navegador.

En el cliente, las funciones `ai*` de `app/page.jsx` llaman a `/api/ai` y, si no hay clave o falla, caen automáticamente a una **estimación local**. Es decir: la app funciona con o sin IA conectada.

Para activarla: agregá `ANTHROPIC_API_KEY` en `.env.local` (local) y en Vercel (producción). Para usar **OpenAI** en vez de Anthropic, reemplazá la función `callLLM()` del route por una llamada a `https://api.openai.com/v1/chat/completions`. Para **fotos de comida**, subí la imagen a Supabase Storage y pasá la URL a un modelo con visión dentro del mismo route.

## 6. Cómo ampliar la integración bancaria

La función `bankFetchMovements()` es el punto de entrada. En Argentina la conexión directa con bancos suele requerir **agregadores financieros** o APIs privadas, por ejemplo **Belvo**, **Prometeo** o APIs bancarias específicas.

Flujo sugerido:
1. Creá una API Route segura (`app/api/bank/route.js`) que hable con el agregador usando credenciales del servidor.
2. Hacé que `bankFetchMovements()` consulte esa ruta y devuelva movimientos normalizados.
3. La app ya los inserta con estado **“pendiente de confirmar”**, así el usuario los revisa, categoriza y confirma antes de impactar en los informes.

También podés importar desde **CSV**: parseá el archivo en el cliente y pasá cada fila por `movements.create({...})` con `status: 'pendiente de confirmar'`.

---

## Notas de arquitectura
- **Resumen diario persistido**: el módulo Hábitos recalcula y guarda automáticamente `daily_health_summary` (consumido / gastado / balance por día) vía `upsert` cada vez que cambian comidas o actividades. Requiere el índice único `(user_id, date)` que ya trae el schema (o corré `supabase_migration_v2.sql` si actualizás).
- **Schema-driven**: cada entidad define sus campos en `FIELD_SCHEMAS`; el formulario y las tablas se generan solos. Para agregar un campo, basta con sumarlo al schema y a la tabla SQL.
- **`useTable(tabla, userId)`**: hook CRUD genérico contra Supabase con `user_id` automático.
- **Temas**: las paletas viven en `PALETTES` y se aplican vía variables CSS; el modo y la paleta se persisten en la tabla `settings`.
- **Seguridad**: RLS activo en todas las tablas; sin sesión, la app muestra login.
