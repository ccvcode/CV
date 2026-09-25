import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <div className="numeral text-[8rem] leading-none">404</div>
      <h1 className="font-display mt-4 text-3xl font-bold">Pagina nu mai este aici</h1>
      <p className="mt-3 text-ink-muted">Știrile vechi sunt arhivate automat după câteva zile. Poate găsești ce cauți printre cele mai noi.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg">Prima pagină</Link>
        <Link href="/cauta" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">Caută</Link>
      </div>
    </main>
  );
}
