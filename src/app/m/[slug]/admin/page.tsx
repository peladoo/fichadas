"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminPanel from "@/components/AdminPanel";
import AdminLogin from "@/components/AdminLogin";
import { useMunicipio } from "@/components/MunicipioProvider";
import { canAccessMunicipio } from "@/lib/tenant";
import type { User } from "@supabase/supabase-js";

function AdminGate() {
  const municipio = useMunicipio();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const applySession = (nextUser: User | null) => {
      setUser(nextUser);
      if (!nextUser) {
        setDenied(false);
        return;
      }
      setDenied(!canAccessMunicipio(nextUser, municipio.id));
    };

    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        applySession(session?.user ?? null);
      } catch (error) {
        console.error("Error al verificar sesión:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session?.user ?? null);
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [municipio.id]);

  const handleLoginSuccess = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const nextUser = session?.user ?? null;
    setUser(nextUser);
    setDenied(nextUser ? !canAccessMunicipio(nextUser, municipio.id) : false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b6c544] mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  if (denied) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Sin acceso a este municipio
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tu usuario de RRHH no pertenece a {municipio.nombre}.
            Si acabás de migrar a multi-tenant, cerrá sesión y volvé a entrar
            para refrescar el acceso.
          </p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              setUser(null);
              setDenied(false);
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}

export default function MunicipioAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#b6c544]" />
        </div>
      }
    >
      <AdminGate />
    </Suspense>
  );
}
