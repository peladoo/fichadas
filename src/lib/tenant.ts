import type { User } from "@supabase/supabase-js";

export const DEFAULT_MUNICIPIO_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_MUNICIPIO_SLUG || "san-benito";

export const DEFAULT_PRIMARY_COLOR = "#b6c544";

export type MunicipioRol = "owner" | "rrhh" | "platform";

export interface Municipio {
  id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  logo_url?: string | null;
  color_primario: string;
  timezone: string;
  created_at?: string;
}

export interface MunicipioUsuario {
  municipio_id: string;
  user_id: string;
  rol: MunicipioRol;
  created_at: string;
}

export function slugifyMunicipio(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

function appMeta(user: User | null | undefined): Record<string, unknown> {
  return (user?.app_metadata ?? {}) as Record<string, unknown>;
}

export function isPlatformAdmin(user: User | null | undefined): boolean {
  const meta = appMeta(user);
  return meta.is_platform_admin === true || meta.rol === "platform";
}

export function userMunicipioId(user: User | null | undefined): string | null {
  const id = appMeta(user).municipio_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function userRol(user: User | null | undefined): MunicipioRol | null {
  const rol = appMeta(user).rol;
  if (rol === "owner" || rol === "rrhh" || rol === "platform") return rol;
  return null;
}

export function canAccessMunicipio(
  user: User | null | undefined,
  municipioId: string,
): boolean {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return userMunicipioId(user) === municipioId;
}
