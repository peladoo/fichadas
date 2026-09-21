import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase-admin";
import {
  isPlatformAdmin,
  isValidSlug,
  slugifyMunicipio,
} from "@/lib/tenant";

async function requirePlatformAdmin(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return { error: NextResponse.json({ error: "Supabase no configurado" }, { status: 500 }) };
  }

  const auth = req.headers.get("authorization");
  if (!auth) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const client = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user || !isPlatformAdmin(user)) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  return { user };
}

export async function POST(req: NextRequest) {
  const gate = await requirePlatformAdmin(req);
  if (gate.error) return gate.error;

  let body: {
    nombre?: string;
    slug?: string;
    color_primario?: string;
    timezone?: string;
    rrhh_email?: string;
    rrhh_password?: string;
    rol?: "owner" | "rrhh";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombre = body.nombre?.trim() || "";
  const slug = slugifyMunicipio(body.slug?.trim() || nombre);
  const color = body.color_primario?.trim() || "#b6c544";
  const timezone =
    body.timezone?.trim() || "America/Argentina/Buenos_Aires";
  const email = body.rrhh_email?.trim().toLowerCase() || "";
  const password = body.rrhh_password || "";
  const rol = body.rol === "rrhh" ? "rrhh" : "owner";

  if (!nombre) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Slug inválido" }, { status: 400 });
  }
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email y contraseña de RRHH (mín. 8 caracteres) son obligatorios" },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falta service role" },
      { status: 500 },
    );
  }

  const { data: municipio, error: muniError } = await admin
    .from("municipios")
    .insert({
      nombre,
      slug,
      color_primario: color,
      timezone,
      activo: true,
    })
    .select("*")
    .single();

  if (muniError || !municipio) {
    return NextResponse.json(
      { error: muniError?.message || "No se pudo crear el municipio" },
      { status: 400 },
    );
  }

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        municipio_id: municipio.id,
        rol,
      },
    });

  let userId = created?.user?.id;

  if (createError || !userId) {
    const msg = createError?.message || "";
    if (!msg.toLowerCase().includes("already")) {
      await admin.from("municipios").delete().eq("id", municipio.id);
      return NextResponse.json(
        { error: msg || "No se pudo crear el usuario RRHH" },
        { status: 400 },
      );
    }

    const { data: listed } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const existing = listed?.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!existing) {
      await admin.from("municipios").delete().eq("id", municipio.id);
      return NextResponse.json(
        { error: "El email ya existe pero no se pudo localizar el usuario" },
        { status: 400 },
      );
    }
    userId = existing.id;
  }

  const { error: memberError } = await admin.from("municipio_usuarios").insert({
    municipio_id: municipio.id,
    user_id: userId,
    rol,
  });

  if (memberError) {
    await admin.from("municipios").delete().eq("id", municipio.id);
    return NextResponse.json(
      { error: memberError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    municipio,
    punch_url: `/m/${municipio.slug}`,
    admin_url: `/m/${municipio.slug}/admin`,
  });
}
