import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EventPayload = {
  id?: number;
  date?: string;
  time?: string;
  title?: string;
  notes?: string;
  category?: string;
};

function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase não configurado");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function canEdit(request: NextRequest) {
  const configuredPin = process.env.AGENDA_EDIT_PIN;
  return !configuredPin || request.headers.get("x-agenda-pin") === configuredPin;
}

function unauthorized() {
  return NextResponse.json({ error: "PIN de edição incorreto." }, { status: 401 });
}

function clean(payload: EventPayload) {
  return {
    date: String(payload.date || ""),
    time: String(payload.time || ""),
    title: String(payload.title || "").trim(),
    notes: String(payload.notes || "").trim(),
    category: String(payload.category || "rosa"),
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    const { data, error } = await database()
      .from("agenda_events")
      .select("id,date,time,title,notes,category")
      .order("date")
      .order("time");
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao carregar a agenda." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!canEdit(request)) return unauthorized();
  try {
    const item = clean(await request.json());
    if (!item.date || !item.title) {
      return NextResponse.json({ error: "Data e compromisso são obrigatórios." }, { status: 400 });
    }
    const { data, error } = await database()
      .from("agenda_events")
      .insert(item)
      .select("id,date,time,title,notes,category")
      .single();
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao salvar." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!canEdit(request)) return unauthorized();
  try {
    const payload: EventPayload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }
    const item = clean(payload);
    const { data, error } = await database()
      .from("agenda_events")
      .update(item)
      .eq("id", payload.id)
      .select("id,date,time,title,notes,category")
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao atualizar." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!canEdit(request)) return unauthorized();
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  try {
    const { error } = await database().from("agenda_events").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Falha ao excluir." }, { status: 500 });
  }
}
