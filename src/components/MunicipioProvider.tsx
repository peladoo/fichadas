"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PRIMARY_COLOR, type Municipio } from "@/lib/tenant";

const NEAR_BLACK = "#1a1a1a";

function safeHex(color: string): string {
  const value = color.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
    ? value
    : DEFAULT_PRIMARY_COLOR;
}

function expandHex(hex: string): string {
  if (hex.length !== 4) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

function relativeLuminance(hex: string): number {
  const full = expandHex(hex);
  const n = Number.parseInt(full.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function onPrimary(hex: string): string {
  const luminance = relativeLuminance(hex);
  const onWhite = contrastRatio(luminance, 1);
  const onBlack = contrastRatio(luminance, relativeLuminance(NEAR_BLACK));
  return onWhite >= onBlack ? "#ffffff" : NEAR_BLACK;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function faviconDataUri(color: string, onColor: string, nombre: string): string {
  const initial = escapeXml((nombre.trim().charAt(0) || "F").toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="${color}"/><text x="32" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${onColor}">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyIconHref(link: HTMLLinkElement, href: string) {
  link.href = href;
  const isSvg =
    href.startsWith("data:image/svg+xml") || href.toLowerCase().includes(".svg");
  if (isSvg) {
    link.type = "image/svg+xml";
    link.removeAttribute("sizes");
    return;
  }
  link.removeAttribute("type");
}

interface MunicipioContextValue {
  municipio: Municipio;
}

const MunicipioContext = createContext<MunicipioContextValue | null>(null);

export function useMunicipio(): Municipio {
  const ctx = useContext(MunicipioContext);
  if (!ctx) {
    throw new Error("useMunicipio debe usarse dentro de MunicipioProvider");
  }
  return ctx.municipio;
}

export function MunicipioProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [municipio, setMunicipio] = useState<Municipio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "get_municipio_by_slug",
        { slug_input: slug },
      );

      if (cancelled) return;

      if (rpcError) {
        setError(rpcError.message);
        setMunicipio(null);
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError("Municipio no encontrado");
        setMunicipio(null);
        setLoading(false);
        return;
      }

      setMunicipio(row as Municipio);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!municipio) return;
    const color = safeHex(municipio.color_primario || DEFAULT_PRIMARY_COLOR);
    const onColor = onPrimary(color);
    const root = document.documentElement;
    root.style.setProperty("--muni-primary", color);
    root.style.setProperty("--muni-on-primary", onColor);
    root.style.setProperty("--color-primary", color);
    document.title = `Fichadas · ${municipio.nombre}`;

    const iconHref = municipio.logo_url?.trim()
      ? municipio.logo_url.trim()
      : faviconDataUri(color, onColor, municipio.nombre);

    let theme = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const createdTheme = !theme;
    const previousTheme = theme?.getAttribute("content") ?? null;
    if (!theme) {
      theme = document.createElement("meta");
      theme.name = "theme-color";
      document.head.appendChild(theme);
    }
    theme.setAttribute("content", color);

    const rels = ["icon", "apple-touch-icon"] as const;
    const snapshots = rels.flatMap((rel) =>
      [...document.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)].map(
        (el) => ({
          el,
          href: el.getAttribute("href"),
          type: el.getAttribute("type"),
        }),
      ),
    );
    const createdLinks: HTMLLinkElement[] = [];
    for (const rel of rels) {
      const existing = document.querySelectorAll<HTMLLinkElement>(
        `link[rel="${rel}"]`,
      );
      if (existing.length === 0) {
        const link = document.createElement("link");
        link.rel = rel;
        document.head.appendChild(link);
        createdLinks.push(link);
        applyIconHref(link, iconHref);
      } else {
        existing.forEach((link) => applyIconHref(link, iconHref));
      }
    }

    return () => {
      root.style.removeProperty("--muni-primary");
      root.style.removeProperty("--muni-on-primary");
      root.style.setProperty("--color-primary", DEFAULT_PRIMARY_COLOR);
      if (createdTheme) {
        theme.remove();
      } else if (previousTheme == null) {
        theme.removeAttribute("content");
      } else {
        theme.setAttribute("content", previousTheme);
      }
      for (const snap of snapshots) {
        if (snap.href == null) snap.el.removeAttribute("href");
        else snap.el.setAttribute("href", snap.href);
        if (snap.type == null) snap.el.removeAttribute("type");
        else snap.el.setAttribute("type", snap.type);
      }
      createdLinks.forEach((link) => link.remove());
    };
  }, [municipio]);

  const value = useMemo(
    () => (municipio ? { municipio } : null),
    [municipio],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muni-canvas">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 spinner-muni mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Cargando municipio...</p>
        </div>
      </div>
    );
  }

  if (error || !value) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Municipio no encontrado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            El enlace no corresponde a un municipio activo. Pedile a RRHH el QR
            o la URL correcta.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MunicipioContext.Provider value={value}>
      {children}
    </MunicipioContext.Provider>
  );
}
