"use client";

import { Suspense } from "react";
import FichadasForm from "@/components/FichadasForm";

export default function MunicipioPunchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Cargando...
        </div>
      }
    >
      <FichadasForm />
    </Suspense>
  );
}
