import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const jsonObject = z.record(z.string(), z.unknown());

const saveCollectionSchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1).max(120),
  status: z.string().max(40),
  brief: jsonObject,
  palette: z.array(z.string().max(9)).max(5),
  pieces: z
    .array(
      z.object({
        id: uuid.optional(),
        applicationId: z.string().min(1).max(80),
        role: z.string().max(40),
        position: z.number().int().min(0).max(64),
        overrides: jsonObject,
      }),
    )
    .max(64),
});

export interface PieceInput {
  id?: string;
  applicationId: string;
  role: string;
  position: number;
  overrides: Record<string, unknown>;
}

export interface SaveCollectionInput {
  id?: string;
  name: string;
  status: string;
  brief: Record<string, unknown>;
  palette: string[];
  pieces: PieceInput[];
}

export const listCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("collections")
      .select("*, pieces(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("collections")
      .select("*, pieces(*), piece_versions(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SaveCollectionInput) => saveCollectionSchema.parse(data) as SaveCollectionInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let collectionId = data.id;
    if (collectionId) {
      const { error } = await supabase
        .from("collections")
        .update({
          name: data.name,
          status: data.status,
          brief: data.brief as never,
          palette: data.palette,
        })
        .eq("id", collectionId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("collections")
        .insert({
          user_id: userId,
          name: data.name,
          status: data.status,
          brief: data.brief as never,
          palette: data.palette,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      collectionId = created.id;
    }

    const keep = data.pieces.map((p) => p.id).filter(Boolean) as string[];
    let del = supabase.from("pieces").delete().eq("collection_id", collectionId);
    if (keep.length > 0) del = del.not("id", "in", `(${keep.join(",")})`);
    const { error: delError } = await del;
    if (delError) throw new Error(delError.message);

    const ids: Record<number, string> = {};
    for (const piece of data.pieces) {
      if (piece.id) {
        const { error } = await supabase
          .from("pieces")
          .update({
            application_id: piece.applicationId,
            role: piece.role,
            position: piece.position,
            overrides: piece.overrides as never,
          })
          .eq("id", piece.id);
        if (error) throw new Error(error.message);
        ids[piece.position] = piece.id;
      } else {
        const { data: created, error } = await supabase
          .from("pieces")
          .insert({
            collection_id: collectionId,
            application_id: piece.applicationId,
            role: piece.role,
            position: piece.position,
            overrides: piece.overrides as never,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        ids[piece.position] = created.id;
      }
    }

    return { collectionId, pieceIdByPosition: ids };
  });

export const updateDirection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, direction: jsonObject }).parse)
  .handler(async ({ data, context }) => {
    // Mantém o que o servidor gravou junto, como a conferência da prancha.
    const { data: current } = await context.supabase
      .from("collections")
      .select("direction")
      .eq("id", data.collectionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const previous = (current?.direction ?? {}) as Record<string, unknown>;
    const merged = { ...previous, ...data.direction };
    const { error } = await context.supabase
      .from("collections")
      .update({ direction: merged as never })
      .eq("id", data.collectionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCollectionPalette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ collectionId: uuid, palette: z.array(z.string().max(9)).max(8) }).parse)
  .handler(async ({ data, context }) => {
    const palette = data.palette
      .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
      .slice(0, 5);
    const { error } = await context.supabase
      .from("collections")
      .update({ palette })
      .eq("id", data.collectionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, palette };
  });

export const updateCollectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      collectionId: uuid,
      status: z.enum(["rascunho", "proposta", "motivos", "montagem", "pronta", "pronta_com_falhas"]),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collections")
      .update({ status: data.status })
      .eq("id", data.collectionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: uuid }).parse)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collections")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signPieceUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ paths: z.array(z.string().max(300)).max(200) }).parse)
  .handler(async ({ data, context }) => {
    if (data.paths.length === 0) return { urls: {} as Record<string, string> };
    const { data: signed, error } = await context.supabase.storage
      .from("pieces")
      .createSignedUrls(data.paths, 60 * 60);
    if (error) throw new Error(error.message);
    const urls: Record<string, string> = {};
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urls[item.path] = item.signedUrl;
    }
    return { urls };
  });
