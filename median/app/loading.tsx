export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-5 sm:px-6" aria-busy="true" aria-label="Se încarcă">
      <div className="skeleton h-11 rounded-2xl" />
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <div className="skeleton h-[440px] rounded-3xl lg:col-span-8 lg:h-[560px]" />
        <div className="grid gap-5 lg:col-span-4">
          <div className="skeleton h-[240px] rounded-2xl" />
          <div className="skeleton h-[240px] rounded-2xl" />
        </div>
      </div>
      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="skeleton aspect-[3/2] rounded-2xl" />
            <div className="skeleton mt-4 h-4 w-20" />
            <div className="skeleton mt-3 h-5" />
            <div className="skeleton mt-2 h-5 w-3/4" />
          </div>
        ))}
      </div>
    </main>
  );
}
