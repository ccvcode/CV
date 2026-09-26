import Link from "next/link";
import { resolveReport } from "@/lib/admin/actions";
import { db } from "@/lib/core/db";
import { formatDate } from "@/lib/core/utils";

export default function Reports() {
  const rows = db().prepare("SELECT * FROM reports ORDER BY status = 'nou' DESC, created_at DESC LIMIT 100").all() as {
    id: number;
    kind: string;
    story_id: string | null;
    email: string | null;
    message: string;
    status: string;
    created_at: number;
  }[];
  if (!rows.length) return <p className="dek text-[18px]">Nicio semnalare.</p>;
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.id} className={`border-b border-rule py-3 ${r.status !== "nou" ? "opacity-60" : ""}`}>
          <div className="meta">
            {formatDate(r.created_at)} · {r.kind} · {r.status}
            {r.email && ` · ${r.email}`}
            {r.story_id && (
              <>
                {" · "}
                <Link href={`/stire/${r.story_id}`} className="underline">
                  articolul
                </Link>
              </>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-[15px]">{r.message}</p>
          {r.status === "nou" && (
            <form action={resolveReport}>
              <input type="hidden" name="id" value={r.id} />
              <button className="mt-1 text-[13px] font-semibold underline">Marchează rezolvat</button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
