import { supabase } from "@/lib/supabase";

export const FOTOS_BUCKET = "fotos-fichadas";
const SIGNED_TTL_SECONDS = 60 * 60;

export function fotoStoragePath(municipioId: string, fileName: string): string {
  return `${municipioId}/${fileName}`;
}

/** Extrae el path del bucket desde un path crudo o una URL pública legacy. */
export function extractStoragePath(fotoUrl: string | null | undefined): string | null {
  if (!fotoUrl) return null;
  const trimmed = fotoUrl.trim();
  if (!trimmed) return null;

  const marker = `/object/public/${FOTOS_BUCKET}/`;
  const signedMarker = `/object/sign/${FOTOS_BUCKET}/`;
  const idxPublic = trimmed.indexOf(marker);
  if (idxPublic >= 0) {
    return decodeURIComponent(trimmed.slice(idxPublic + marker.length).split("?")[0]);
  }
  const idxSigned = trimmed.indexOf(signedMarker);
  if (idxSigned >= 0) {
    return decodeURIComponent(trimmed.slice(idxSigned + signedMarker.length).split("?")[0]);
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split(`/${FOTOS_BUCKET}/`);
      if (parts.length > 1) return decodeURIComponent(parts[1]);
    } catch {
      return null;
    }
    return null;
  }

  return trimmed.replace(/^\//, "");
}

export async function uploadFichadaFoto(
  municipioId: string,
  fileName: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  const path = fotoStoragePath(municipioId, fileName);
  const { error } = await supabase.storage.from(FOTOS_BUCKET).upload(path, blob, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createSignedFotoUrl(
  fotoUrl: string | null | undefined,
): Promise<string | null> {
  const path = extractStoragePath(fotoUrl);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(FOTOS_BUCKET)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    if (fotoUrl?.startsWith("http")) return fotoUrl;
    return null;
  }
  return data.signedUrl;
}
