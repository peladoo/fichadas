# Configuración de Supabase

No hace falta instalar Postgres ni Supabase en tu PC. Se usa **Supabase Cloud** (gratis para probar).

## Proyecto NUEVO (tu caso ahora)

1. Entrá a [https://supabase.com/dashboard](https://supabase.com/dashboard) → New project. Región sugerida: **South America (São Paulo)**.
2. SQL Editor → New query → pegá **todo** `migrations/bootstrap_proyecto_nuevo.sql` → Run.
3. Authentication → Users → Add user (email + password). Marca **Auto Confirm User**.
4. En SQL Editor:

```sql
SELECT public.grant_platform_admin('tu@email.com');
```

5. Project Settings → API: copiá `Project URL`, `anon public` y `service_role` a `.env.local` (no uses `.env` con placeholders).
6. En la raíz del repo:

```
pnpm install
pnpm dev
```

7. Probar:
   - Punch: http://localhost:3000 (redirige a `/m/san-benito`) — DNI de 7/8 dígitos, foto, GPS.
   - RRHH: http://localhost:3000/m/san-benito/admin
   - Plataforma: http://localhost:3000/platform (el mismo usuario, después del `grant_platform_admin`)

**No corras** `saas_multitenant.sql` en un proyecto vacío: ese archivo asume que `dependencias` y `fichadas` ya existen. Por eso viste `relation "dependencias" does not exist`.

## Proyecto que YA tenía el sistema viejo

Ahí sí: `migrations/saas_multitenant.sql` en el SQL Editor.

## Multi-tenant (SaaS)

Si el proyecto ya tiene el schema original, **no re-ejecutes el SQL de la sección 2**.
Corré `migrations/saas_multitenant.sql` en el SQL Editor.

Variables extra:

```
SUPABASE_SERVICE_ROLE_KEY=...   # solo servidor, para /platform
NEXT_PUBLIC_DEFAULT_MUNICIPIO_SLUG=san-benito
```

Después del SQL: `SELECT public.grant_platform_admin('tu@email.com');` y re-login de RRHH.

## 1. Variables de Entorno

Creá un archivo `.env.local` en la raíz del proyecto con:

```
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role
NEXT_PUBLIC_DEFAULT_MUNICIPIO_SLUG=san-benito
```

## 2. Esquema de Base de Datos

Ejecutá el siguiente SQL en tu proyecto de Supabase (SQL Editor):

```sql
-- Tabla de dependencias
CREATE TABLE dependencias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  direccion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de fichadas
CREATE TABLE fichadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dependencia_id UUID REFERENCES dependencias(id) ON DELETE CASCADE,
  documento VARCHAR(20) NOT NULL,
  tipo VARCHAR(10) NOT NULL DEFAULT 'entrada' CHECK (tipo IN ('entrada', 'salida')),
  foto_url TEXT,
  latitud DECIMAL(10, 8),
  longitud DECIMAL(11, 8),
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_fichadas_dependencia ON fichadas(dependencia_id);
CREATE INDEX idx_fichadas_documento ON fichadas(documento);
CREATE INDEX idx_fichadas_fecha ON fichadas(fecha_hora);
CREATE INDEX idx_fichadas_tipo ON fichadas(tipo);

-- Habilitar Row Level Security
ALTER TABLE dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichadas ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (permitir lectura y escritura pública para simplificar)
-- Podés ajustar esto según tus necesidades de seguridad
CREATE POLICY "Permitir lectura de dependencias" ON dependencias
  FOR SELECT USING (true);

CREATE POLICY "Permitir escritura de fichadas" ON fichadas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir lectura de fichadas" ON fichadas
  FOR SELECT USING (true);
```

## 3. Configurar Storage

1. Ve a Storage en tu dashboard de Supabase
2. Crea un bucket llamado `fotos-fichadas`
3. Configura las políticas de acceso:

```sql
-- Permitir subir fotos
CREATE POLICY "Permitir subir fotos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'fotos-fichadas');

-- Permitir ver fotos
CREATE POLICY "Permitir ver fotos" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos-fichadas');
```

## 4. Datos de Ejemplo

```sql
-- Insertar algunas dependencias de ejemplo
INSERT INTO dependencias (nombre, codigo, direccion) VALUES
  ('Intendencia', 'INT-001', 'Calle Principal 123'),
  ('Obras Públicas', 'OBR-001', 'Av. Trabajo 456'),
  ('Desarrollo Social', 'SOC-001', 'Barrio Centro');
```
