"use client";

import { useEffect, useState } from "react";
import { createSignedFotoUrl } from "@/lib/storage";

interface FotoImgProps {
  path?: string | null;
  alt: string;
  className?: string;
}

export function useSignedFotoUrl(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }

    createSignedFotoUrl(path).then((signed) => {
      if (!cancelled) setUrl(signed);
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

export default function FotoImg({ path, alt, className }: FotoImgProps) {
  const url = useSignedFotoUrl(path);

  if (!path) return null;
  if (!url) {
    return (
      <div
        className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
        aria-label="Cargando foto"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} loading="lazy" className={className} />
  );
}

export function FotoDownloadLink({
  path,
  className,
  children,
}: {
  path: string;
  className?: string;
  children: React.ReactNode;
}) {
  const url = useSignedFotoUrl(path);
  if (!url) {
    return <span className={className}>{children}</span>;
  }
  return (
    <a
      href={url}
      download
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
