import { toggleSource } from "@/lib/admin/actions";
import { db } from "@/lib/core/db";
import { formatDate } from "@/lib/core/utils";

export default function AdminSources() {
  const rows = db().prepare("SELECT id, name, feed_url, category, tier, enabled, hero_images, last_status, last_error, last_fetch_at, items_total FROM sources ORDER BY name, category").all() as {
    id: string;
    name: string;
    feed_url: string;
    category: string;
    tier: number;
    enabled: number;
    hero_images: number;
    last_status: string | null;
    last_error: string | null;
    last_fetch_at: number | null;
    items_total: number;
  }[];
  return (
    <>
      <p className="meta mb-4 max-w-3xl">
        „Poze principale” permite folosirea fotografiilor publicației ca imagine principală a articolelor. Activează doar pentru publicațiile cu
        care ai un acord; altfel pozele lor apar doar ca miniaturi, cu credit.
      </p>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="kicker border-b border-rule text-left text-ink-3">
            <th className="py-2">Flux</th>
            <th className="py-2">Stare</th>
            <th className="py-2 text-right">Articole</th>
            <th className="py-2">Setări</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-b border-rule align-top ${r.enabled ? "" : "opacity-50"}`}>
              <td className="py-2 pr-4">
                <b>{r.name}</b> <span className="text-ink-3">· {r.category} · nivel {r.tier}</span>
                <div className="mono break-all text-[11px] text-ink-3">{r.feed_url}</div>
              </td>
              <td className="py-2">
                <span className={r.last_status === "error" ? "text-accent-ink" : ""}>{r.last_status ?? "—"}</span>
                {r.last_error && <div className="text-[11px] text-ink-3">{r.last_error}</div>}
                {r.last_fetch_at && <div className="meta text-[11px]">{formatDate(r.last_fetch_at)}</div>}
              </td>
              <td className="mono py-2 text-right">{r.items_total}</td>
              <td className="space-y-1 py-2 pl-4">
                {(["enabled", "hero_images"] as const).map((field) => (
                  <form key={field} action={toggleSource}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="field" value={field} />
                    <button className="underline decoration-rule underline-offset-4">
                      {field === "enabled" ? (r.enabled ? "Dezactivează" : "Activează") : r.hero_images ? "Poze principale: DA" : "Poze principale: nu"}
                    </button>
                  </form>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
