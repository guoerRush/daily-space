import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import type { JournalEntry } from "@/lib/journals";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RemoteDiary = {
  id: string;
  userId: string;
  date: string;
  title: string | null;
  content: string;
  mood: string | null;
  template: "free" | "touch" | "review";
  touchEvent: string | null;
  touchWhy: string | null;
  touchAction: string | null;
  reviewDesc: string | null;
  reviewAnalysis: string | null;
  reviewAction: string | null;
  linkedDiaryIds: string[];
  metaCognition: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

export type DiaryRemoteResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; reason: "not-configured" | "not-authenticated" | "query-failed"; message?: string };

type DiaryRow = {
  id: string;
  user_id: string;
  date: string;
  title: string | null;
  content: string;
  mood: string | null;
  template: "free" | "touch" | "review";
  touch_event: string | null;
  touch_why: string | null;
  touch_action: string | null;
  review_desc: string | null;
  review_analysis: string | null;
  review_action: string | null;
  linked_diary_ids: string[] | null;
  meta_cognition: Record<string, boolean> | null;
  created_at: string;
  updated_at: string;
};

type DiaryAuthResult =
  | {
      ok: true;
      client: SupabaseClient;
      userId: string;
    }
  | {
      ok: false;
      reason: "not-configured" | "not-authenticated";
    };

function mapDiary(row: DiaryRow): RemoteDiary {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    title: row.title,
    content: row.content,
    mood: row.mood,
    template: row.template,
    touchEvent: row.touch_event,
    touchWhy: row.touch_why,
    touchAction: row.touch_action,
    reviewDesc: row.review_desc,
    reviewAnalysis: row.review_analysis,
    reviewAction: row.review_action,
    linkedDiaryIds: row.linked_diary_ids ?? [],
    metaCognition: row.meta_cognition ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAuthenticatedDiaryClient(): Promise<DiaryAuthResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, reason: "not-configured" as const };
  }
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    return { ok: false, reason: "not-authenticated" as const };
  }
  return { ok: true, client, userId: session.user.id };
}

/**
 * Keeps the existing local-first journal flow intact while mirroring a diary
 * to the relational table when the signed-in user's database is configured.
 */
export async function upsertDiaryRemote(
  entry: Omit<JournalEntry, "updatedAt">,
): Promise<DiaryRemoteResult> {
  const auth = await getAuthenticatedDiaryClient();
  if (!auth.ok) return auth;

  const { error } = await auth.client.from("diaries").upsert(
    {
      user_id: auth.userId,
      date: entry.date,
      content: entry.content,
      mood: entry.mood,
      template: entry.template ?? "free",
      touch_event: entry.touchEvent ?? null,
      touch_why: entry.touchWhy ?? null,
      touch_action: entry.touchAction ?? null,
      review_desc: entry.reviewDesc ?? null,
      review_analysis: entry.reviewAnalysis ?? null,
      review_action: entry.reviewAction ?? null,
      // Older local journals are addressed by date. They remain available in
      // local storage, while only real diary UUIDs can enter the uuid[] column.
      linked_diary_ids: (entry.linkedDiaryIds ?? []).filter((id) =>
        uuidPattern.test(id),
      ),
      meta_cognition: entry.metaCognition ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" },
  );
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  return { ok: true, data: undefined };
}

export async function listDiariesRemote(): Promise<
  DiaryRemoteResult<RemoteDiary[]>
> {
  const auth = await getAuthenticatedDiaryClient();
  if (!auth.ok) return auth;
  const { data, error } = await auth.client
    .from("diaries")
    .select("*")
    .eq("user_id", auth.userId)
    .order("date", { ascending: false });
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  return { ok: true, data: ((data ?? []) as DiaryRow[]).map(mapDiary) };
}

export async function getDiaryRemote(
  date: string,
): Promise<DiaryRemoteResult<RemoteDiary | null>> {
  const auth = await getAuthenticatedDiaryClient();
  if (!auth.ok) return auth;
  const { data, error } = await auth.client
    .from("diaries")
    .select("*")
    .eq("user_id", auth.userId)
    .eq("date", date)
    .maybeSingle<DiaryRow>();
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  return { ok: true, data: data ? mapDiary(data) : null };
}

export async function deleteDiaryRemote(
  date: string,
): Promise<DiaryRemoteResult> {
  const auth = await getAuthenticatedDiaryClient();
  if (!auth.ok) return auth;
  const { error } = await auth.client
    .from("diaries")
    .delete()
    .eq("user_id", auth.userId)
    .eq("date", date);
  if (error) return { ok: false, reason: "query-failed", message: error.message };
  return { ok: true, data: undefined };
}
