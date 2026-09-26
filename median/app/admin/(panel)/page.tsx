import { retryDeadJobs } from "@/lib/admin/actions";
import { config, llmEnabled } from "@/lib/core/config";
import { db } from "@/lib/core/db";
import { formatDate } from "@/lib/core/utils";
import { usageToday } from "@/lib/pipeline/llm";
import { siteStatus } from "@/lib/data/queries";

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border-t-2 border-rule-strong pt-2">
      <div className="kicker text-ink-3">{label}</div>
      <div className="mono mt-1 text-[28px]">{value}</div>
      {note && <div className="meta">{note}</div>}
    </div>
  );
}

export default function Dashboard() {
  const d = db();
  const st = siteStatus();
  const u = usageToday();
  const jobs = d.prepare("SELECT type, status, COUNT(*) AS n FROM jobs GROUP BY type, status ORDER BY type").all() as { type: string; status: string; n: number }[];
  const review = (d.prepare("SELECT COUNT(*) AS n FROM articles WHERE status = 'review'").get() as { n: number }).n;
  const reports = (d.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'nou'").get() as { n: number }).n;
  const published = (d.prepare("SELECT COUNT(*) AS n FROM articles WHERE status = 'published' AND published_at > ?").get(Date.now() - 86400_000) as { n: number }).n;
  const events = d.prepare("SELECT at, level, message FROM events ORDER BY id DESC LIMIT 40").all() as { at: number; level: string; message: string }[];
  const dead = d.prepare("SELECT type, key, last_error FROM jobs WHERE status = 'dead' ORDER BY updated_at DESC LIMIT 10").all() as { type: string; key: string; last_error: string }[];
  const failing = d.prepare("SELECT name, feed_url, last_error, fail_count FROM sources WHERE enabled = 1 AND fail_count > 0 ORDER BY fail_count DESC LIMIT 15").all() as {
    name: string;
    feed_url: string;
    last_error: string;
    fail_count: number;
  }[];
  return (
    <div className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fluxuri active" value={`${st.sourcesOk}/${st.sourcesTotal}`} note={st.lastFetch ? `ultima colectare ${formatDate(st.lastFetch)}` : "nicio colectare încă"} />
        <Stat label="Articole publicate (24h)" value={published} note={`${review} de aprobat · ${reports} semnalări noi`} />
        <Stat label="Cost AI azi" value={`$${u.cost_usd.toFixed(3)}`} note={`buget $${config.llm.dailyBudgetUsd} · ${u.articles} articole · ${u.briefs} scurte · ${u.calls} apeluri`} />
        <Stat label="Redactor AI" value={llmEnabled() ? "activ" : "oprit"} note={llmEnabled() ? `${config.llm.model}` : "setează LLM_BASE_URL"} />
      </div>

      <section>
        <h2 className="kicker text-ink-2">Coada de lucru</h2>
        <table className="mono mt-2 w-full max-w-xl text-[13px]">
          <tbody>
            {jobs.map((j) => (
              <tr key={j.type + j.status} className="border-b border-rule">
                <td className="py-1.5">{j.type}</td>
                <td className="py-1.5 text-ink-2">{j.status}</td>
                <td className="py-1.5 text-right">{j.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dead.length > 0 && (
          <div className="mt-4">
            <h3 className="kicker text-accent-ink">Joburi eșuate definitiv</h3>
            <ul className="mono mt-1 text-[12px] text-ink-2">
              {dead.map((j) => (
                <li key={j.key}>
                  {j.key}: {j.last_error}
                </li>
              ))}
            </ul>
            <form action={retryDeadJobs}>
              <button className="mt-2 text-[13px] font-semibold underline">Reîncearcă toate</button>
            </form>
          </div>
        )}
      </section>

      {failing.length > 0 && (
        <section>
          <h2 className="kicker text-ink-2">Fluxuri cu erori</h2>
          <ul className="mt-2 text-[13px]">
            {failing.map((f) => (
              <li key={f.feed_url} className="border-b border-rule py-1.5">
                <b>{f.name}</b> <span className="mono text-ink-3">{f.feed_url}</span> — {f.last_error} ({f.fail_count}×)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="kicker text-ink-2">Jurnal</h2>
        <ul className="mono mt-2 max-h-[420px] overflow-y-auto text-[12px]">
          {events.map((e, i) => (
            <li key={i} className={`border-b border-rule py-1 ${e.level === "error" ? "text-accent-ink" : e.level === "warn" ? "text-ink" : "text-ink-2"}`}>
              {formatDate(e.at)} · {e.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
