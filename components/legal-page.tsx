import { ShieldCheck } from 'lucide-react'

import { Card } from '@/components/ui/card'
import type { LegalPage } from '@/lib/i18n/legal'

export function LegalView({ page }: { page: LegalPage }) {
  return (
    <div className="container grid max-w-3xl gap-6 py-10">
      <header className="grid gap-3">
        <h1 className="m-0 flex items-center gap-3 text-4xl md:text-5xl">
          <ShieldCheck className="size-10 shrink-0 max-sm:hidden" aria-hidden="true" />
          {page.title}
        </h1>
        <p className="m-0 text-lg text-muted-foreground">{page.lead}</p>
        <p className="alert alert-warn m-0 text-sm">{page.draft}</p>
      </header>
      {page.sections.map((s) => (
        <Card key={s.title} flat className="gap-3">
          <h2 className="m-0 text-2xl">{s.title}</h2>
          <ul className="m-0 grid gap-2 pl-5">
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
