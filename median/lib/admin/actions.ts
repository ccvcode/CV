"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, logEvent, setSetting } from "../core/db";
import { enqueue } from "../pipeline/jobs";
import { publishArticle } from "../pipeline/writer";
import { destroySession, requireAdmin } from "./auth";

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

export async function approveArticle(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const a = db().prepare("SELECT story_id, headline, region FROM articles WHERE id = ? AND status = 'review'").get(id) as { story_id: string; headline: string; region: string | null } | undefined;
  if (!a) return;
  const story = db().prepare("SELECT category, sensitive FROM stories WHERE id = ?").get(a.story_id) as { category: string; sensitive: string | null };
  const ok = publishArticle(a.story_id, id, a.headline, story.category, a.region, story.sensitive?.split(",").filter(Boolean) ?? []);
  if (!ok) {
    logEvent("warn", `aprobarea nu a publicat „${a.headline}”: există deja o versiune mai nouă sau un articol complet`);
    revalidatePath("/admin");
    return;
  }
  db().prepare("UPDATE articles SET review_reason = NULL WHERE id = ?").run(id);
  enqueue("image", `image:${a.story_id}:${id}`, { storyId: a.story_id }, { priority: 5 });
  logEvent("info", `articol aprobat manual: ${a.headline}`);
  revalidatePath("/admin");
}

export async function rejectArticle(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  db().prepare("UPDATE articles SET status = 'rejected', updated_at = ? WHERE id = ? AND status = 'review'").run(Date.now(), id);
  revalidatePath("/admin");
}

export async function regenerateStory(formData: FormData) {
  await requireAdmin();
  const storyId = String(formData.get("storyId"));
  enqueue("write", `write:${storyId}`, { storyId, force: "1" }, { priority: 50, requeue: true });
  logEvent("info", `regenerare cerută manual pentru ${storyId}`);
  revalidatePath("/admin");
}

export async function setStoryFlag(formData: FormData) {
  await requireAdmin();
  const storyId = String(formData.get("storyId"));
  const flag = String(formData.get("flag"));
  const value = String(formData.get("value"));
  if (flag === "pinned" || flag === "breaking") db().prepare(`UPDATE stories SET ${flag} = ? WHERE id = ?`).run(value === "1" ? 1 : 0, storyId);
  if (flag === "status" && (value === "active" || value === "hidden")) db().prepare("UPDATE stories SET status = ? WHERE id = ?").run(value, storyId);
  revalidatePath("/admin/subiecte");
}

export async function addCorrection(formData: FormData) {
  await requireAdmin();
  const storyId = String(formData.get("storyId"));
  const text = String(formData.get("text") ?? "").trim();
  if (text.length < 5) return;
  db().prepare("INSERT INTO corrections(story_id, text, created_at) VALUES (?, ?, ?)").run(storyId, text.slice(0, 1000), Date.now());
  revalidatePath("/admin/subiecte");
}

export async function toggleSource(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const field = String(formData.get("field"));
  if (field !== "enabled" && field !== "hero_images") return;
  db().prepare(`UPDATE sources SET ${field} = 1 - ${field}, next_fetch_at = 0 WHERE id = ?`).run(id);
  revalidatePath("/admin/surse");
}

export async function resolveReport(formData: FormData) {
  await requireAdmin();
  db().prepare("UPDATE reports SET status = 'rezolvat' WHERE id = ?").run(Number(formData.get("id")));
  revalidatePath("/admin/semnalari");
}

export async function retryDeadJobs() {
  await requireAdmin();
  db().prepare("UPDATE jobs SET status = 'queued', attempts = 0, run_after = 0 WHERE status = 'dead'").run();
  revalidatePath("/admin");
}

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  setSetting("note", String(formData.get("note") ?? "").slice(0, 2000));
  revalidatePath("/admin");
}
