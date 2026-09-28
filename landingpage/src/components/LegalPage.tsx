import { useEffect, type ReactNode } from 'react'
import { LEGAL_UPDATED } from '../company'

type Props = {
  title: string
  intro?: ReactNode
  children: ReactNode
}

export default function LegalPage({ title, intro, children }: Props) {
  useEffect(() => {
    document.title = `${title} – Rara Live`
    return () => { document.title = 'Rara Live – Live Voice Rooms, Streaming & Gifting' }
  }, [title])

  return (
    <article className="px-4 py-14 sm:px-5 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        <p className="mb-8 text-sm text-muted">Last updated: {LEGAL_UPDATED}</p>
        {intro && <div className="mb-8 rounded-2xl border border-white/10 border-l-4 border-l-brand-pink bg-card p-5 text-[#d9cfe6]">{intro}</div>}
        <div className="prose-legal">{children}</div>
      </div>
    </article>
  )
}
