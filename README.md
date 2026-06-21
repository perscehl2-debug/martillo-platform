# Martillo — Plataforma de Remates Premium

Subastas en tiempo real de automóviles y viviendas. Next.js 14 + Supabase + React Three Fiber.

## Instalación

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # Completar con credenciales Supabase
npm run dev
```

## Configurar Supabase
1. Crear proyecto en app.supabase.com
2. Copiar URLs y keys a `.env.local`
3. Ejecutar `supabase/migrations/001_initial.sql` en SQL Editor

## Crear Admin
1. Registrarse en el sitio con tu email
2. En Supabase > Auth > Users, copiar tu UUID
3. Ejecutar: `UPDATE public.profiles SET role = 'admin' WHERE id = 'TU_UUID';`
4. Acceder a `/admin`

## Modelo 3D
Colocar `car.glb` en `/public/models/`. Sin modelo, usa auto placeholder animado.
Nombres de mesh esperados: `door_FL`, `door_FR`, `hood`, `wheel_FL`, etc.

## Kling AI
Agregar `KLING_API_KEY` en `.env.local`. Sin key, el sitio funciona con imágenes.

## Deploy
```bash
npx vercel
# Agregar variables de entorno en Vercel Dashboard
```
