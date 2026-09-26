import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8">
      <div className="max-w-2xl border-t-2 border-rule-strong pt-4">
        <div className="mono text-[13px] text-ink-3">404</div>
        <h1 className="section-head mt-2 text-[44px] sm:text-[64px]">Pagina nu există</h1>
        <p className="dek mt-4 text-[20px]">Poate a fost mutată sau subiectul a fost retras. Găsești cele mai noi știri pe prima pagină.</p>
        <div className="ui mt-6 flex gap-6 text-[14px] font-semibold">
          <Link href="/" className="underline underline-offset-4">Prima pagină</Link>
          <Link href="/cauta" className="underline underline-offset-4">Căutare</Link>
        </div>
      </div>
    </main>
  );
}
