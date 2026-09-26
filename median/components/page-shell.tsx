export function PageShell({ kicker, title, dek, children }: { kicker?: string; title: string; dek?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[1320px] px-4 sm:px-8">
      <header className="pt-10">
        {kicker && <div className="kicker text-ink-3">{kicker}</div>}
        <h1 className="section-head mt-1 text-[44px] sm:text-[72px]">{title}</h1>
        {dek && <p className="dek mt-3 max-w-3xl text-[20px]">{dek}</p>}
        <div className="mt-4 h-[2px] bg-rule-strong" />
      </header>
      <div className="prose-median mt-8 max-w-[680px] [&_h2]:mt-10 [&_li]:mb-2 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </main>
  );
}
