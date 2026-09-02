-- ========================================
-- Permitir más de una extra abierta por DNI
-- ========================================
-- Fecha: 2026-09-02
-- Motivo: una jornada (normal o extra) sin salida no debe trabar
--         una fichada posterior. El unique impedía dos filas extra
--         con fecha_hora_salida NULL para el mismo documento.
--
-- Correr en el SQL Editor de Supabase (prod y cualquier ambiente).

DROP INDEX IF EXISTS uniq_extra_abierta_por_documento;
