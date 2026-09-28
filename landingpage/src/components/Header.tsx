import { Link } from 'react-router-dom'
import { APP } from '../company'

const NAV = [
  { to: '/#features', label: 'Features' },
  { to: '/#about', label: 'About' },
  { to: '/#contact', label: 'Contact' },
  { to: '/privacy-policy', label: 'Privacy' },
]

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-5">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-bold text-white">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl" />
          {APP.name}
        </Link>
        <nav className="hidden gap-6 md:flex">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm font-medium text-muted transition hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <a
          href={APP.playStoreUrl}
          className="bg-brand rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-600/30 transition hover:brightness-110 sm:px-5"
        >
          Get the app
        </a>
      </div>
    </header>
  )
}
