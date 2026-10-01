import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const areas = ['Events', 'Organizations', 'Attendance'];

export function WorkspaceView() {
  return (
    <div id="dashboard" className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-2xl bg-[#027013] p-6 text-white shadow-sm sm:p-8">
        <Badge className="border-white/20 bg-white/10 text-white" dot>Foundation phase</Badge>
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">HNU DASH Web</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">A clean, responsive frontend foundation for the future HNU DASH management experience.</p>
      </section>
      <section aria-labelledby="foundation-heading">
        <div className="mb-4"><h2 id="foundation-heading" className="text-xl font-bold text-slate-900 dark:text-slate-100">Frontend workspace</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Navigation areas are visual placeholders. Product workflows and backend integration are intentionally deferred.</p></div>
        <div className="grid gap-4 md:grid-cols-3">
          {areas.map((area) => <Card id={area.toLowerCase()} key={area}><CardHeader><CardTitle>{area}</CardTitle><CardDescription>Reserved for a future backend-backed workflow.</CardDescription></CardHeader><CardContent><Badge variant="outline">Not implemented</Badge></CardContent></Card>)}
        </div>
      </section>
    </div>
  );
}
