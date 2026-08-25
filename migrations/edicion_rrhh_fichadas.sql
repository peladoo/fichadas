-- ========================================
-- EDICIÓN DESDE RRHH SOBRE FICHADAS NORMALES
-- ========================================
-- Fecha: 2026-08-25
-- Descripción: Columnas de auditoría, políticas RLS para authenticated
--              y ajuste del rate limit para no bloquear cargas de RRHH
--              ni importaciones del reloj físico.

ALTER TABLE fichadas
  ADD COLUMN IF NOT EXISTS editado_por TEXT,
  ADD COLUMN IF NOT EXISTS editado_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS motivo_edicion TEXT;

-- Políticas RLS para que RRHH pueda insertar, actualizar y eliminar
ALTER TABLE fichadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rrhh inserta fichadas" ON fichadas;
CREATE POLICY "rrhh inserta fichadas" ON fichadas
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "rrhh actualiza fichadas" ON fichadas;
CREATE POLICY "rrhh actualiza fichadas" ON fichadas
  FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rrhh elimina fichadas" ON fichadas;
CREATE POLICY "rrhh elimina fichadas" ON fichadas
  FOR DELETE TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON fichadas TO authenticated;

-- ========================================
-- RATE LIMIT: no aplicar a cargas de RRHH ni reloj físico
-- ========================================

CREATE OR REPLACE FUNCTION validar_fichada_antes_insertar()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que el documento sea numérico y tenga 7-8 dígitos
  IF NEW.documento !~ '^\d{7,8}$' THEN
    RAISE EXCEPTION 'DNI inválido. Debe ser numérico de 7 u 8 dígitos. DNI: %', NEW.documento;
  END IF;

  -- Validar que el tipo sea 'entrada' o 'salida'
  IF NEW.tipo NOT IN ('entrada', 'salida') THEN
    RAISE EXCEPTION 'Tipo de fichada inválido. Debe ser "entrada" o "salida". Tipo: %', NEW.tipo;
  END IF;

  -- Rate limit de 5 minutos no aplica a registros manuales de RRHH
  -- ni a importaciones del reloj físico
  IF COALESCE(NEW.origen, 'App') NOT IN ('Manual_RRHH', 'Reloj_Fisico') THEN
    IF NOT check_fichada_rate_limit(NEW.documento) THEN
      RAISE EXCEPTION 'Debes esperar al menos 5 minutos entre fichadas. DNI: %', NEW.documento;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
