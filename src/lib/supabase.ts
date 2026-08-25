import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos para las tablas
export interface Dependencia {
  id: string;
  nombre: string;
  codigo: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  radio_metros?: number;
  created_at: string;
}

export type TipoFichada = 'entrada' | 'salida';
export type TipoJornada = 'normal' | 'extra';

export interface Fichada {
  id: string;
  dependencia_id: string;
  documento: string;
  tipo: TipoFichada;
  foto_url?: string;
  latitud?: number;
  longitud?: number;
  fecha_hora: string;
  origen: string;
  created_at: string;
  editado_por?: string | null;
  editado_at?: string | null;
  motivo_edicion?: string | null;
}

export interface FichadaInsert {
  dependencia_id: string;
  documento: string;
  tipo: TipoFichada;
  foto_url?: string;
  latitud?: number;
  longitud?: number;
  origen?: string;
  fecha_hora?: string;
}

export interface FichadaExtra {
  id: string;
  documento: string;
  dependencia_id_entrada?: string | null;
  foto_url_entrada?: string | null;
  latitud_entrada?: number | null;
  longitud_entrada?: number | null;
  fecha_hora_entrada: string;
  dependencia_id_salida?: string | null;
  foto_url_salida?: string | null;
  latitud_salida?: number | null;
  longitud_salida?: number | null;
  fecha_hora_salida?: string | null;
  origen: string;
  editado_por?: string | null;
  editado_at?: string | null;
  motivo_edicion?: string | null;
  created_at: string;
}

export interface FichadaExtraInsert {
  documento: string;
  dependencia_id_entrada: string;
  foto_url_entrada?: string;
  latitud_entrada?: number;
  longitud_entrada?: number;
  fecha_hora_entrada?: string;
  origen?: string;
}

export interface FichadaExtraCierre {
  dependencia_id_salida: string;
  foto_url_salida?: string;
  latitud_salida?: number;
  longitud_salida?: number;
  fecha_hora_salida: string;
}

export interface FichadaConDependencia extends Fichada {
  dependencia?: Dependencia;
}

export interface FichadaExtraConDeps extends FichadaExtra {
  dependenciaEntrada?: Dependencia;
  dependenciaSalida?: Dependencia;
}
