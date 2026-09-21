-- ========================================
-- SAAS MULTI-TENANT (solo si YA existen las tablas)
-- ========================================
-- Proyecto VACÍO / recién creado: NO uses este archivo.
-- Corré migrations/bootstrap_proyecto_nuevo.sql
--
-- Este archivo es para un San Benito que ya tenía dependencias/fichadas.
-- Fecha: 2026-09-19
-- Después: logout/login de usuarios RRHH para refrescar el JWT.
-- Primer admin de plataforma (SQL Editor, con tu email):
--   SELECT public.grant_platform_admin('tu@email.com');
-- Luego cerrá sesión y volvé a entrar.

DO $$
BEGIN
  IF to_regclass('public.dependencias') IS NULL
     OR to_regclass('public.fichadas') IS NULL THEN
    RAISE EXCEPTION
      'Proyecto vacío: las tablas dependencias/fichadas no existen. Corré migrations/bootstrap_proyecto_nuevo.sql (no este archivo).';
  END IF;
END $$;

-- ----------------------------------------
-- 1. Municipios y membresías
-- ----------------------------------------

CREATE TABLE IF NOT EXISTS municipios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  color_primario VARCHAR(16) NOT NULL DEFAULT '#b6c544',
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT municipios_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS municipio_usuarios (
  municipio_id UUID NOT NULL REFERENCES municipios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol VARCHAR(20) NOT NULL DEFAULT 'rrhh' CHECK (rol IN ('owner', 'rrhh')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (municipio_id, user_id),
  CONSTRAINT municipio_usuarios_user_unico UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_municipio_usuarios_user
  ON municipio_usuarios (user_id);

INSERT INTO municipios (slug, nombre, activo, color_primario, timezone)
VALUES (
  'san-benito',
  'Municipalidad de San Benito',
  true,
  '#b6c544',
  'America/Argentina/Buenos_Aires'
)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------
-- 2. municipio_id en tablas de negocio
-- ----------------------------------------

ALTER TABLE dependencias
  ADD COLUMN IF NOT EXISTS municipio_id UUID REFERENCES municipios(id) ON DELETE CASCADE;

ALTER TABLE fichadas
  ADD COLUMN IF NOT EXISTS municipio_id UUID REFERENCES municipios(id) ON DELETE CASCADE;

ALTER TABLE fichadas_extras
  ADD COLUMN IF NOT EXISTS municipio_id UUID REFERENCES municipios(id) ON DELETE CASCADE;

UPDATE dependencias
SET municipio_id = (SELECT id FROM municipios WHERE slug = 'san-benito')
WHERE municipio_id IS NULL;

UPDATE fichadas
SET municipio_id = (SELECT id FROM municipios WHERE slug = 'san-benito')
WHERE municipio_id IS NULL;

UPDATE fichadas_extras
SET municipio_id = (SELECT id FROM municipios WHERE slug = 'san-benito')
WHERE municipio_id IS NULL;

ALTER TABLE dependencias
  ALTER COLUMN municipio_id SET NOT NULL;

ALTER TABLE fichadas
  ALTER COLUMN municipio_id SET NOT NULL;

ALTER TABLE fichadas_extras
  ALTER COLUMN municipio_id SET NOT NULL;

ALTER TABLE dependencias
  DROP CONSTRAINT IF EXISTS dependencias_codigo_key;

CREATE UNIQUE INDEX IF NOT EXISTS dependencias_municipio_codigo_key
  ON dependencias (municipio_id, codigo);

CREATE INDEX IF NOT EXISTS idx_dependencias_municipio
  ON dependencias (municipio_id);

CREATE INDEX IF NOT EXISTS idx_fichadas_municipio_fecha
  ON fichadas (municipio_id, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_fichadas_municipio_documento_fecha
  ON fichadas (municipio_id, documento, fecha_hora DESC);

CREATE INDEX IF NOT EXISTS idx_extras_municipio_fecha
  ON fichadas_extras (municipio_id, fecha_hora_entrada DESC);

CREATE INDEX IF NOT EXISTS idx_extras_municipio_documento
  ON fichadas_extras (municipio_id, documento, fecha_hora_entrada DESC);

-- Usuarios Auth existentes quedan como owner de San Benito
INSERT INTO municipio_usuarios (municipio_id, user_id, rol)
SELECT m.id, u.id, 'owner'
FROM municipios m
CROSS JOIN auth.users u
WHERE m.slug = 'san-benito'
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------
-- 3. Claims JWT (app_metadata)
-- ----------------------------------------

CREATE OR REPLACE FUNCTION public.jwt_municipio_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'municipio_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.jwt_rol()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'rol';
$$;

CREATE OR REPLACE FUNCTION public.sync_municipio_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  meta jsonb;
  membership RECORD;
  is_platform boolean;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);

  SELECT raw_app_meta_data INTO meta FROM auth.users WHERE id = uid;
  meta := COALESCE(meta, '{}'::jsonb);
  is_platform := COALESCE((meta ->> 'is_platform_admin')::boolean, false);

  SELECT mu.municipio_id, mu.rol
  INTO membership
  FROM public.municipio_usuarios mu
  WHERE mu.user_id = uid
  LIMIT 1;

  IF membership.municipio_id IS NOT NULL THEN
    meta := meta || jsonb_build_object(
      'municipio_id', membership.municipio_id,
      'rol', CASE WHEN is_platform THEN 'platform' ELSE membership.rol END
    );
  ELSE
    meta := meta - 'municipio_id';
    IF NOT is_platform THEN
      meta := meta - 'rol';
    END IF;
  END IF;

  IF is_platform THEN
    meta := meta || jsonb_build_object('is_platform_admin', true, 'rol', 'platform');
  END IF;

  UPDATE auth.users SET raw_app_meta_data = meta WHERE id = uid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_municipio_claims ON municipio_usuarios;
CREATE TRIGGER trigger_sync_municipio_claims
  AFTER INSERT OR UPDATE OR DELETE ON municipio_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_municipio_claims();

CREATE OR REPLACE FUNCTION public.grant_platform_admin(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('is_platform_admin', true, 'rol', 'platform')
  WHERE email = user_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe un usuario Auth con email %', user_email;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_platform_admin(text) FROM PUBLIC, anon, authenticated;

-- Refrescar claims de usuarios ya asignados
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT user_id FROM municipio_usuarios LOOP
    UPDATE municipio_usuarios SET rol = rol WHERE user_id = rec.user_id;
  END LOOP;
END $$;

-- ----------------------------------------
-- 4. Rate limit y validaciones por tenant
-- ----------------------------------------

CREATE OR REPLACE FUNCTION check_fichada_rate_limit(
  dni_input VARCHAR,
  municipio_input UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  ultima_fichada TIMESTAMP WITH TIME ZONE;
  tiempo_minimo_minutos INTEGER := 5;
BEGIN
  SELECT MAX(fecha_hora) INTO ultima_fichada
  FROM fichadas
  WHERE documento = dni_input
    AND (municipio_input IS NULL OR municipio_id = municipio_input);

  IF ultima_fichada IS NULL THEN
    RETURN TRUE;
  END IF;

  IF ultima_fichada > NOW() - INTERVAL '1 minute' * tiempo_minimo_minutos THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validar_fichada_antes_insertar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.municipio_id IS NULL THEN
    RAISE EXCEPTION 'municipio_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM municipios WHERE id = NEW.municipio_id AND activo) THEN
    RAISE EXCEPTION 'El municipio no existe o está inactivo';
  END IF;

  IF NEW.documento !~ '^\d{7,8}$' THEN
    RAISE EXCEPTION 'DNI inválido. Debe ser numérico de 7 u 8 dígitos. DNI: %', NEW.documento;
  END IF;

  IF NEW.tipo NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'Tipo de fichada inválido. Debe ser "entrada" o "salida". Tipo: %', NEW.tipo;
  END IF;

  IF NEW.dependencia_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM dependencias d
      WHERE d.id = NEW.dependencia_id AND d.municipio_id = NEW.municipio_id
    ) THEN
      RAISE EXCEPTION 'La dependencia no pertenece a este municipio';
    END IF;
  END IF;

  IF COALESCE(NEW.origen, 'App') NOT IN ('Manual_RRHH', 'Reloj_Fisico') THEN
    IF NOT check_fichada_rate_limit(NEW.documento, NEW.municipio_id) THEN
      RAISE EXCEPTION 'Debes esperar al menos 5 minutos entre fichadas. DNI: %', NEW.documento;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validar_extra_antes_insertar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.municipio_id IS NULL THEN
    RAISE EXCEPTION 'municipio_id es obligatorio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM municipios WHERE id = NEW.municipio_id AND activo) THEN
    RAISE EXCEPTION 'El municipio no existe o está inactivo';
  END IF;

  IF NEW.documento !~ '^\d{7,8}$' THEN
    RAISE EXCEPTION 'DNI inválido. Debe ser numérico de 7 u 8 dígitos. DNI: %', NEW.documento;
  END IF;

  IF NEW.dependencia_id_entrada IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM dependencias d
      WHERE d.id = NEW.dependencia_id_entrada AND d.municipio_id = NEW.municipio_id
    ) THEN
      RAISE EXCEPTION 'La dependencia de entrada no pertenece a este municipio';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_extra ON fichadas_extras;
CREATE TRIGGER trigger_validar_extra
  BEFORE INSERT ON fichadas_extras
  FOR EACH ROW
  EXECUTE FUNCTION validar_extra_antes_insertar();

CREATE OR REPLACE FUNCTION get_ultima_fichada(
  dni_input VARCHAR,
  municipio_input UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  documento VARCHAR,
  tipo VARCHAR,
  fecha_hora TIMESTAMP WITH TIME ZONE,
  dependencia_id UUID,
  minutos_desde_ultima INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id,
    f.documento,
    f.tipo,
    f.fecha_hora,
    f.dependencia_id,
    (EXTRACT(EPOCH FROM (NOW() - f.fecha_hora))::INTEGER / 60) AS minutos_desde_ultima
  FROM fichadas f
  WHERE f.documento = dni_input
    AND (municipio_input IS NULL OR f.municipio_id = municipio_input)
  ORDER BY f.fecha_hora DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_estado_fichadas(
  dni_input VARCHAR,
  municipio_input UUID
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extra_row jsonb;
  ultima_row jsonb;
BEGIN
  IF municipio_input IS NULL OR NOT EXISTS (
    SELECT 1 FROM municipios WHERE id = municipio_input AND activo
  ) THEN
    RAISE EXCEPTION 'municipio inválido';
  END IF;

  SELECT to_jsonb(e) INTO extra_row
  FROM fichadas_extras e
  WHERE e.documento = dni_input
    AND e.municipio_id = municipio_input
    AND e.fecha_hora_salida IS NULL
  ORDER BY e.fecha_hora_entrada DESC
  LIMIT 1;

  SELECT to_jsonb(f) INTO ultima_row
  FROM fichadas f
  WHERE f.documento = dni_input
    AND f.municipio_id = municipio_input
  ORDER BY f.fecha_hora DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'extra_abierta', extra_row,
    'ultima_fichada', ultima_row
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_municipio_by_slug(slug_input TEXT)
RETURNS TABLE (
  id UUID,
  slug VARCHAR,
  nombre VARCHAR,
  activo BOOLEAN,
  logo_url TEXT,
  color_primario VARCHAR,
  timezone VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.slug, m.nombre, m.activo, m.logo_url, m.color_primario, m.timezone
  FROM municipios m
  WHERE m.slug = slug_input AND m.activo = true;
$$;

CREATE OR REPLACE FUNCTION public.get_dependencias_publicas(municipio_input UUID)
RETURNS SETOF dependencias
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM dependencias d
  JOIN municipios m ON m.id = d.municipio_id
  WHERE d.municipio_id = municipio_input AND m.activo = true
  ORDER BY d.nombre;
$$;

GRANT EXECUTE ON FUNCTION public.jwt_municipio_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_platform_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_rol() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_municipio_by_slug(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dependencias_publicas(UUID) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.cerrar_fichada_extra(
  extra_id UUID,
  municipio_input UUID,
  dependencia_salida UUID,
  foto_salida TEXT,
  lat_salida DECIMAL,
  lng_salida DECIMAL,
  fecha_salida TIMESTAMP WITH TIME ZONE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id UUID;
BEGIN
  IF municipio_input IS NULL OR NOT EXISTS (
    SELECT 1 FROM municipios WHERE id = municipio_input AND activo
  ) THEN
    RAISE EXCEPTION 'municipio inválido';
  END IF;

  IF dependencia_salida IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM dependencias d
    WHERE d.id = dependencia_salida AND d.municipio_id = municipio_input
  ) THEN
    RAISE EXCEPTION 'La dependencia no pertenece a este municipio';
  END IF;

  UPDATE fichadas_extras
  SET
    dependencia_id_salida = dependencia_salida,
    foto_url_salida = foto_salida,
    latitud_salida = lat_salida,
    longitud_salida = lng_salida,
    fecha_hora_salida = fecha_salida
  WHERE id = extra_id
    AND municipio_id = municipio_input
    AND fecha_hora_salida IS NULL
  RETURNING id INTO updated_id;

  RETURN updated_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_estado_fichadas(VARCHAR, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ultima_fichada(VARCHAR, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cerrar_fichada_extra(UUID, UUID, UUID, TEXT, DECIMAL, DECIMAL, TIMESTAMP WITH TIME ZONE) TO anon, authenticated;

-- ----------------------------------------
-- 5. RLS
-- ----------------------------------------

ALTER TABLE municipios ENABLE ROW LEVEL SECURITY;
ALTER TABLE municipio_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichadas_extras ENABLE ROW LEVEL SECURITY;

-- Municipios
DROP POLICY IF EXISTS "anon lee municipios activos" ON municipios;
CREATE POLICY "anon lee municipios activos" ON municipios
  FOR SELECT TO anon
  USING (activo = true);

DROP POLICY IF EXISTS "auth lee su municipio o plataforma" ON municipios;
CREATE POLICY "auth lee su municipio o plataforma" ON municipios
  FOR SELECT TO authenticated
  USING (jwt_is_platform_admin() OR id = jwt_municipio_id());

DROP POLICY IF EXISTS "plataforma gestiona municipios" ON municipios;
CREATE POLICY "plataforma gestiona municipios" ON municipios
  FOR ALL TO authenticated
  USING (jwt_is_platform_admin())
  WITH CHECK (jwt_is_platform_admin());

-- Membresías
DROP POLICY IF EXISTS "usuario lee su membresia" ON municipio_usuarios;
CREATE POLICY "usuario lee su membresia" ON municipio_usuarios
  FOR SELECT TO authenticated
  USING (jwt_is_platform_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "plataforma gestiona membresias" ON municipio_usuarios;
CREATE POLICY "plataforma gestiona membresias" ON municipio_usuarios
  FOR ALL TO authenticated
  USING (jwt_is_platform_admin())
  WITH CHECK (jwt_is_platform_admin());

-- Dependencias: drop legacy
DROP POLICY IF EXISTS "Permitir lectura de dependencias" ON dependencias;

DROP POLICY IF EXISTS "anon lee dependencias activas" ON dependencias;
CREATE POLICY "anon lee dependencias activas" ON dependencias
  FOR SELECT TO anon
  USING (
    municipio_id IN (SELECT id FROM municipios WHERE activo)
  );

DROP POLICY IF EXISTS "rrhh lee dependencias de su municipio" ON dependencias;
CREATE POLICY "rrhh lee dependencias de su municipio" ON dependencias
  FOR SELECT TO authenticated
  USING (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id());

DROP POLICY IF EXISTS "rrhh escribe dependencias de su municipio" ON dependencias;
CREATE POLICY "rrhh escribe dependencias de su municipio" ON dependencias
  FOR ALL TO authenticated
  USING (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id())
  WITH CHECK (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id());

-- Fichadas: drop legacy
DROP POLICY IF EXISTS "Permitir escritura de fichadas" ON fichadas;
DROP POLICY IF EXISTS "Permitir lectura de fichadas" ON fichadas;
DROP POLICY IF EXISTS "rrhh inserta fichadas" ON fichadas;
DROP POLICY IF EXISTS "rrhh actualiza fichadas" ON fichadas;
DROP POLICY IF EXISTS "rrhh elimina fichadas" ON fichadas;

DROP POLICY IF EXISTS "anon inserta fichadas del municipio activo" ON fichadas;
CREATE POLICY "anon inserta fichadas del municipio activo" ON fichadas
  FOR INSERT TO anon
  WITH CHECK (municipio_id IN (SELECT id FROM municipios WHERE activo));

DROP POLICY IF EXISTS "rrhh gestiona fichadas de su municipio" ON fichadas;
CREATE POLICY "rrhh gestiona fichadas de su municipio" ON fichadas
  FOR ALL TO authenticated
  USING (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id())
  WITH CHECK (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id());

-- Extras: drop legacy
DROP POLICY IF EXISTS "lectura publica extras" ON fichadas_extras;
DROP POLICY IF EXISTS "insert publico extras" ON fichadas_extras;
DROP POLICY IF EXISTS "cerrar extra abierta" ON fichadas_extras;
DROP POLICY IF EXISTS "rrhh gestiona extras" ON fichadas_extras;

DROP POLICY IF EXISTS "anon inserta extras del municipio activo" ON fichadas_extras;
CREATE POLICY "anon inserta extras del municipio activo" ON fichadas_extras
  FOR INSERT TO anon
  WITH CHECK (municipio_id IN (SELECT id FROM municipios WHERE activo));

DROP POLICY IF EXISTS "anon cierra extra abierta" ON fichadas_extras;
CREATE POLICY "anon cierra extra abierta" ON fichadas_extras
  FOR UPDATE TO anon
  USING (
    fecha_hora_salida IS NULL
    AND municipio_id IN (SELECT id FROM municipios WHERE activo)
  )
  WITH CHECK (
    fecha_hora_salida IS NOT NULL
    AND municipio_id IN (SELECT id FROM municipios WHERE activo)
  );

DROP POLICY IF EXISTS "rrhh gestiona extras de su municipio" ON fichadas_extras;
CREATE POLICY "rrhh gestiona extras de su municipio" ON fichadas_extras
  FOR ALL TO authenticated
  USING (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id())
  WITH CHECK (jwt_is_platform_admin() OR municipio_id = jwt_municipio_id());

GRANT SELECT ON municipios TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON municipios TO authenticated;

GRANT SELECT ON municipio_usuarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON municipio_usuarios TO authenticated;

GRANT SELECT ON dependencias TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON dependencias TO authenticated;

REVOKE SELECT ON fichadas FROM anon, public;
GRANT INSERT ON fichadas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fichadas TO authenticated;

REVOKE SELECT ON fichadas_extras FROM anon, public;
GRANT INSERT ON fichadas_extras TO anon;
REVOKE UPDATE ON fichadas_extras FROM anon, public;
GRANT UPDATE (
  dependencia_id_salida,
  foto_url_salida,
  latitud_salida,
  longitud_salida,
  fecha_hora_salida
) ON fichadas_extras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fichadas_extras TO authenticated;

-- ----------------------------------------
-- 6. Storage privado por municipio
-- ----------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id = 'fotos-fichadas';

DROP POLICY IF EXISTS "Permitir subir fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir ver fotos" ON storage.objects;
DROP POLICY IF EXISTS "anon sube fotos de municipio activo" ON storage.objects;
DROP POLICY IF EXISTS "auth sube fotos de su municipio" ON storage.objects;
DROP POLICY IF EXISTS "auth lee fotos de su municipio" ON storage.objects;

CREATE POLICY "anon sube fotos de municipio activo" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'fotos-fichadas'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM municipios WHERE activo
    )
  );

CREATE POLICY "auth sube fotos de su municipio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos-fichadas'
    AND (
      jwt_is_platform_admin()
      OR (storage.foldername(name))[1] = jwt_municipio_id()::text
    )
  );

CREATE POLICY "auth lee fotos de su municipio" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos-fichadas'
    AND (
      jwt_is_platform_admin()
      OR (storage.foldername(name))[1] = jwt_municipio_id()::text
      OR (
        position('/' in name) = 0
        AND jwt_municipio_id() = (SELECT id FROM municipios WHERE slug = 'san-benito' LIMIT 1)
      )
    )
  );

-- ----------------------------------------
-- Checklist de aislamiento A vs B (después del deploy)
-- ----------------------------------------
-- 1. / redirige a /m/san-benito
-- 2. Punch San Benito no lista dependencias de otro slug
-- 3. Crear municipio de prueba en /platform
-- 4. Fichar en A; en admin de B no aparece
-- 5. RRHH de A no entra a /m/B/admin
-- 6. Foto de A no es URL pública adivinable (signed URL)
-- 7. Import reloj en A no inserta en B
-- 8. Logout/login de usuarios RRHH existentes para refrescar JWT

