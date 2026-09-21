"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Loader2,
  Lock,
  LogOut,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isPlatformAdmin, slugifyMunicipio, type Municipio } from "@/lib/tenant";
import type { User } from "@supabase/supabase-js";
import { handleSupabaseError } from "@/lib/utils";

export default function PlatformPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [listError, setListError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#b6c544");
  const [timezone, setTimezone] = useState("America/Argentina/Buenos_Aires");
  const [rrhhEmail, setRrhhEmail] = useState("");
  const [rrhhPassword, setRrhhPassword] = useState("");
  const [rol, setRol] = useState<"owner" | "rrhh">("owner");

  const loadMunicipios = useCallback(async () => {
    const { data, error } = await supabase
      .from("municipios")
      .select("*")
      .order("nombre");
    if (error) {
      setListError(error.message);
      return;
    }
    setListError("");
    setMunicipios((data || []) as Municipio[]);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user && isPlatformAdmin(session.user)) {
        await loadMunicipios();
      }
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, [loadMunicipios]);

  useEffect(() => {
    if (user && isPlatformAdmin(user)) {
      loadMunicipios();
    }
  }, [user, loadMunicipios]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setAuthError(
        error.message.includes("Invalid login credentials")
          ? "Email o contraseña incorrectos"
          : error.message,
      );
      return;
    }
    setUser(data.user);
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesión expirada");

      const res = await fetch("/api/platform/municipios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nombre,
          slug: slug || slugifyMunicipio(nombre),
          color_primario: color,
          timezone,
          rrhh_email: rrhhEmail,
          rrhh_password: rrhhPassword,
          rol,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "No se pudo crear");

      setFormSuccess(
        `Municipio creado. Punch: ${payload.punch_url} · Admin: ${payload.admin_url}`,
      );
      setNombre("");
      setSlug("");
      setRrhhEmail("");
      setRrhhPassword("");
      await loadMunicipios();
    } catch (err) {
      setFormError(handleSupabaseError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#b6c544]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#076633] flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-4"
        >
          <div className="text-center">
            <ShieldCheck className="w-12 h-12 mx-auto text-[#076633] mb-2" />
            <h1 className="text-2xl font-bold">Plataforma Fichadas</h1>
            <p className="text-sm text-gray-500">Acceso exclusivo del operador</p>
          </div>
          {authError && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {authError}
            </p>
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="w-full border rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            className="w-full bg-[#b6c544] text-white py-2 rounded-lg font-medium"
          >
            Entrar
          </button>
        </form>
      </div>
    );
  }

  if (!isPlatformAdmin(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-lg bg-white rounded-2xl shadow-xl p-8 space-y-4">
          <h1 className="text-xl font-bold">No sos admin de plataforma</h1>
          <p className="text-sm text-gray-600">
            En el SQL Editor de Supabase ejecutá, con el email de esta cuenta:
          </p>
          <pre className="bg-gray-100 text-xs p-3 rounded overflow-x-auto">
            {`SELECT public.grant_platform_admin('${user.email}');`}
          </pre>
          <p className="text-sm text-gray-600">
            Después cerrá sesión y volvé a entrar para refrescar el JWT.
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 text-red-600"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white rounded-2xl shadow p-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plataforma</h1>
            <p className="text-sm text-gray-500">
              Alta de municipios · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>

        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl shadow p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#076633]" />
            <h2 className="text-lg font-semibold">Nuevo municipio</h2>
          </div>
          {formError && (
            <p className="text-sm text-red-600">{formError}</p>
          )}
          {formSuccess && (
            <p className="text-sm text-green-700">{formSuccess}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                if (!slug) setSlug(slugifyMunicipio(e.target.value));
              }}
              placeholder="Nombre (Municipalidad de …)"
              className="border rounded-lg px-3 py-2"
            />
            <input
              required
              value={slug}
              onChange={(e) => setSlug(slugifyMunicipio(e.target.value))}
              placeholder="slug (san-benito)"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 border rounded-lg px-2"
            />
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Timezone"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="email"
              required
              value={rrhhEmail}
              onChange={(e) => setRrhhEmail(e.target.value)}
              placeholder="Email primer usuario RRHH"
              className="border rounded-lg px-3 py-2"
            />
            <input
              type="password"
              required
              minLength={8}
              value={rrhhPassword}
              onChange={(e) => setRrhhPassword(e.target.value)}
              placeholder="Contraseña RRHH (mín. 8)"
              className="border rounded-lg px-3 py-2"
            />
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as "owner" | "rrhh")}
              className="border rounded-lg px-3 py-2"
            >
              <option value="owner">Owner</option>
              <option value="rrhh">RRHH</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-[#b6c544] text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Crear municipio y usuario
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Municipios</h2>
          {listError && <p className="text-sm text-red-600 mb-3">{listError}</p>}
          {municipios.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay municipios.</p>
          ) : (
            <ul className="divide-y">
              {municipios.map((m) => (
                <li
                  key={m.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ background: m.color_primario }}
                    />
                    <div>
                      <p className="font-medium">{m.nombre}</p>
                      <p className="text-xs text-gray-500">
                        {m.slug} · {m.activo ? "activo" : "inactivo"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 text-sm">
                    <Link
                      href={`/m/${m.slug}`}
                      className="text-[#076633] hover:underline"
                    >
                      Punch
                    </Link>
                    <Link
                      href={`/m/${m.slug}/admin`}
                      className="text-[#076633] hover:underline"
                    >
                      RRHH
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
