import { Link } from 'react-router-dom'
import { APP, COMPANY } from '../company'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-white/10 bg-[#09050f] pt-12 pb-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-5">
        <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="mb-3 flex items-center gap-2.5 font-bold text-white">
              <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg" />
              {APP.name}
            </div>
            <p className="text-sm text-muted">
              {APP.name} is a product of <strong className="text-white">{COMPANY.legalName}</strong>.
            </p>
            <address className="mt-3 text-sm not-italic text-muted">
              {COMPANY.addressLines.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </address>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy-policy" className="text-muted hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-muted hover:text-white">Terms of Service</Link></li>
              <li><Link to="/child-safety" className="text-muted hover:text-white">Child Safety Standards</Link></li>
              <li><Link to="/delete-account" className="text-muted hover:text-white">Delete Account</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li><a href={`mailto:${COMPANY.email}`} className="break-all text-muted hover:text-white">{COMPANY.email}</a></li>
              <li><a href={COMPANY.phoneHref} className="text-muted hover:text-white">{COMPANY.phone}</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center text-xs text-muted">
          © {year} {COMPANY.legalName}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
