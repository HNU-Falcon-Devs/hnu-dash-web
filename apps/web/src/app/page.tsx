export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16">
      <section className="w-full max-w-2xl border-l-4 border-blue-800 bg-white px-8 py-10 shadow-sm sm:px-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-800">
          Web management application
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          HNU DASH
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
          The management foundation for university event attendance. Event and
          attendance workflows will be introduced in later development phases.
        </p>
      </section>
    </main>
  );
}
