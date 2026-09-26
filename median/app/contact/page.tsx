import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ReportForm } from "@/components/report-form";
import { config } from "@/lib/core/config";

export const metadata: Metadata = { title: "Contact și drepturi de autor" };

export default function Contact() {
  return (
    <PageShell kicker="Redacția" title="Contact">
      <p>
        Redacția Median: <a href={`mailto:${config.contactEmail}`}>{config.contactEmail}</a>
        {config.company ? ` · ${config.company}` : ""}.
      </p>
      <h2>Drepturi de autor și retragere</h2>
      <p>
        Dacă reprezinți o publicație sau deții drepturi asupra unui material și dorești corectarea, retragerea unei preluări sau excluderea
        fluxului tău din Median, scrie-ne. Răspundem în cel mult 48 de ore.
      </p>
      <div className="not-prose ui">
        <ReportForm kind="drepturi" />
      </div>
    </PageShell>
  );
}
