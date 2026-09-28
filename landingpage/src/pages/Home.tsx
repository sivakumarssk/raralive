import type { ReactNode } from 'react'
import { APP, COMPANY } from '../company'

const FEATURES = [
  { icon: '🎙️', title: 'Live voice rooms', text: 'Create or join party rooms, take a mic seat and talk with people who share your interests.' },
  { icon: '📹', title: 'Go live', text: 'Stream live video to your followers and interact with viewers in real time.' },
  { icon: '⚔️', title: 'PK battles', text: 'Challenge other hosts to live battles and let your supporters decide the winner.' },
  { icon: '🎁', title: 'Gifts & rewards', text: 'Send animated gifts to your favourite hosts and climb the leaderboards.' },
  { icon: '💬', title: 'Private chat', text: 'Message friends one-to-one and keep the conversation going after the room ends.' },
  { icon: '🏆', title: 'Levels & badges', text: 'Earn XP, unlock levels and show off your status across the community.' },
]

const SAFETY = [
  { title: 'Report & remove', text: 'Report any user from their profile, and room hosts can remove and block people from their rooms. Our team reviews reports.' },
  { title: `${APP.minAge}+ only`, text: `${APP.name} is for adults aged ${APP.minAge} and above. Every account is linked to a verified phone number.` },
  { title: 'Zero tolerance', text: 'Nudity, harassment, hate speech and child exploitation lead to permanent bans.' },
]

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-14 pb-20 sm:px-5 md:pt-24 md:pb-28">
        <div className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-pink/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-brand-purple/30 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="mb-5 inline-block rounded-full bg-brand-orange/15 px-3 py-1.5 text-xs font-semibold tracking-wider text-orange-300 uppercase">
              Live · Voice · Gifts
            </span>
            <h1 className="mb-5 text-4xl leading-tight font-extrabold text-white sm:text-5xl lg:text-6xl">
              Talk, stream and <span className="text-brand">celebrate live</span>
            </h1>
            <p className="mb-8 max-w-xl text-lg text-muted">
              {APP.name} brings people together in live voice rooms and video streams. Make new friends, support your
              favourite hosts with gifts and be part of a real-time community.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={APP.playStoreUrl}
                className="bg-brand inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white shadow-xl shadow-pink-600/30 transition hover:brightness-110"
              >
                <PlayIcon /> Get it on Google Play
              </a>
              <a href="#features" className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/5">
                Explore features
              </a>
            </div>
          </div>
          <div className="order-first flex justify-center md:order-none">
            <img
              src="/logo.png"
              alt="Rara Live logo"
              className="w-52 rounded-[2.5rem] bg-white shadow-[0_30px_80px_-10px_rgba(219,39,119,0.55)] ring-1 ring-white/20 sm:w-64 md:w-80"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 border-y border-white/10 bg-ink-2 px-4 py-20 sm:px-5">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-3 text-3xl font-bold text-white sm:text-4xl">Everything happens live</h2>
            <p className="text-muted">One app for voice parties, live video and a community that shows up for you.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-card p-6 transition hover:border-white/20">
                <div className="bg-brand mb-4 grid h-12 w-12 place-items-center rounded-xl text-xl">{f.icon}</div>
                <h3 className="mb-1.5 text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="px-4 py-20 sm:px-5">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="mb-3 text-3xl font-bold text-white sm:text-4xl">A safe place to be yourself</h2>
            <p className="text-muted">Safety is built into {APP.name} from day one.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {SAFETY.map((s) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-card p-6">
                <h3 className="mb-1.5 text-lg font-semibold text-white">{s.title}</h3>
                <p className="text-sm text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-16 border-y border-white/10 bg-ink-2 px-4 py-20 sm:px-5">
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">About us</h2>
            <p className="mb-3 text-muted">
              {APP.name} is developed and operated by <strong className="text-white">{COMPANY.legalName}</strong>, a
              technology company based in Kamareddy, Telangana, India.
            </p>
            <p className="text-muted">
              We build social and entertainment apps that help people connect in real time. {APP.name} is our live
              audio and video community platform, available on Android through Google Play.
            </p>
          </div>

          {/* Contact */}
          <div id="contact" className="scroll-mt-16 rounded-2xl border border-white/10 bg-card p-6 sm:p-8">
            <h3 className="mb-6 text-xl font-semibold text-white">Contact us</h3>
            <div className="space-y-5">
              <ContactRow icon="🏢" label="Company">{COMPANY.legalName}</ContactRow>
              <ContactRow icon="📍" label="Registered address">
                {COMPANY.addressLines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </ContactRow>
              <ContactRow icon="✉️" label="Email">
                <a href={`mailto:${COMPANY.email}`} className="break-all hover:underline">{COMPANY.email}</a>
              </ContactRow>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function ContactRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="bg-brand grid h-10 w-10 flex-none place-items-center rounded-xl">{icon}</div>
      <div>
        <div className="text-xs font-medium text-muted">{label}</div>
        <div className="text-white">{children}</div>
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M3.6 1.8c-.3.3-.4.7-.4 1.2v18c0 .5.1.9.4 1.2l.1.1L13.8 12.2v-.2L3.7 1.7l-.1.1zM17.2 15.6l-3.4-3.4v-.2l3.4-3.4.1.1 4 2.3c1.1.6 1.1 1.7 0 2.3l-4 2.3h-.1zM17.3 15.5 13.8 12 3.6 22.2c.4.4 1 .4 1.7.1l12-6.8M17.3 8.5l-12-6.8c-.7-.4-1.3-.3-1.7.1L13.8 12l3.5-3.5z" />
    </svg>
  )
}
