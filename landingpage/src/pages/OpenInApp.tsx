import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { APP } from '../company'

type Kind = 'user' | 'room' | 'post'

const COPY: Record<Kind, { title: string; text: string }> = {
  user: { title: 'View this profile in Rara Live', text: 'Open the app to see their profile, posts and rooms.' },
  room: { title: 'Join this chat room in Rara Live', text: 'Open the app to join the room and talk live.' },
  post: { title: 'See this post in Rara Live', text: 'Open the app to see the post, like it and comment.' },
}

/**
 * Landing page for a shared link (/user/:id, /room/:id, /post/:id). With the
 * app installed, Android normally opens the app before this page even loads
 * (App Links — see /.well-known/assetlinks.json). Otherwise it redirects at
 * once: on Android to the app if it's there, else Google Play; elsewhere
 * straight to Google Play. The page itself only shows if a redirect is blocked.
 */
export default function OpenInApp({ kind }: { kind: Kind }) {
  const { pathname } = useLocation()
  const copy = COPY[kind]
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
  // Chrome "intent:" link: opens the app at this exact path, or Play Store if it isn't installed
  const intentUrl =
    `intent://${APP.domain}${pathname}#Intent;scheme=https;package=${APP.packageId};` +
    `S.browser_fallback_url=${encodeURIComponent(APP.playStoreUrl)};end`

  useEffect(() => {
    document.title = `${copy.title} – Rara Live`
    window.location.replace(isAndroid ? intentUrl : APP.playStoreUrl)
    return () => { document.title = 'Rara Live – Live Voice Rooms, Streaming & Gifting' }
  }, [copy.title, isAndroid, intentUrl])

  return (
    <section className="px-4 py-24 text-center sm:px-5">
      <img src="/logo.png" alt="Rara Live" className="mx-auto mb-6 h-20 w-20 rounded-2xl" />
      <h1 className="mb-3 text-2xl font-bold text-white sm:text-3xl">{copy.title}</h1>
      <p className="mx-auto mb-8 max-w-md text-muted">{copy.text}</p>
      <div className="flex flex-col items-center gap-3">
        {isAndroid && (
          <a href={intentUrl} className="bg-brand rounded-full px-7 py-3 font-semibold text-white shadow-xl shadow-pink-600/30 hover:brightness-110">
            Open in Rara Live
          </a>
        )}
        <a
          href={APP.playStoreUrl}
          className="rounded-full border border-white/15 px-7 py-3 font-semibold text-white hover:bg-white/5"
        >
          Get it on Google Play
        </a>
      </div>
    </section>
  )
}
