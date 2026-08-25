-- ========================================
-- TABLA DE FICHADAS DE HORAS EXTRAS
-- ========================================
-- Fecha: 2026-08-25
-- Descripción: Tabla session-based (entrada + salida en la misma fila)
--              para registrar horas extras de forma independiente a la
--              jornada laboral normal.

CREATE TABLE IF NOT EXISTS fichadas_extras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  documento VARCHAR(20) NOT NULL,
  dependencia_id_entrada UUID REFERENCES dependencias(id) ON DELETE SET NULL,
  foto_url_entrada TEXT,
  latitud_entrada DECIMAL(10, 8),
  longitud_entrada DECIMAL(11, 8),
  fecha_hora_entrada TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  dependencia_id_salida UUID REFERENCES dependencias(id) ON DELETE SET NULL,
  foto_url_salida TEXT,
  latitud_salida DECIMAL(10, 8),
  longitud_salida DECIMAL(11, 8),
  fecha_hora_salida TIMESTAMP WITH TIME ZONE,
  origen VARCHAR(20) NOT NULL DEFAULT 'App',
  editado_por TEXT,
  editado_at TIMESTAMP WITH TIME ZONE,
  motivo_edicion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT salida_posterior_a_entrada
    CHECK (fecha_hora_salida IS NULL OR fecha_hora_salida > fecha_hora_entrada)
);

-- Garantía a nivel de base: una sola fila abierta por empleado
CREATE UNIQUE INDEX IF NOT EXISTS uniq_extra_abierta_por_documento
  ON fichadas_extras (documento) WHERE fecha_hora_salida IS NULL;

CREATE INDEX IF NOT EXISTS idx_extras_documento_fecha
  ON fichadas_extras (documento, fecha_hora_entrada DESC);
CREATE INDEX IF NOT EXISTS idx_extras_dep_entrada
  ON fichadas_extras (dependencia_id_entrada, fecha_hora_entrada DESC);
CREATE INDEX IF NOT EXISTS idx_extras_fecha
  ON fichadas_extras (fecha_hora_entrada DESC);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE fichadas_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectura publica extras" ON fichadas_extras;
CREATE POLICY "lectura publica extras" ON fichadas_extras
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert publico extras" ON fichadas_extras;
CREATE POLICY "insert publico extras" ON fichadas_extras
  FOR INSERT WITH CHECK (true);

-- Solo se puede cerrar una fila abierta, nunca reabrirla ni tocar una cerrada
DROP POLICY IF EXISTS "cerrar extra abierta" ON fichadas_extras;
CREATE POLICY "cerrar extra abierta" ON fichadas_extras
  FOR UPDATE
  USING (fecha_hora_salida IS NULL)
  WITH CHECK (fecha_hora_salida IS NOT NULL);

-- RRHH (rol authenticated) con permisos completos
DROP POLICY IF EXISTS "rrhh gestiona extras" ON fichadas_extras;
CREATE POLICY "rrhh gestiona extras" ON fichadas_extras
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Restricción por columna: anon no puede alterar documento, entrada ni origen
REVOKE UPDATE ON fichadas_extras FROM anon, public;
GRANT UPDATE (
  dependencia_id_salida,
  foto_url_salida,
  latitud_salida,
  longitud_salida,
  fecha_hora_salida
) ON fichadas_extras TO anon;

-- authenticated necesita UPDATE completo para editar desde RRHH
GRANT SELECT, INSERT, UPDATE, DELETE ON fichadas_extras TO authenticated;
GRANT SELECT, INSERT ON fichadas_extras TO anon;
