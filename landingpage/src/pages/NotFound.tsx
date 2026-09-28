import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <section className="px-4 py-32 text-center sm:px-5">
      <h1 className="text-brand mb-3 text-6xl font-extrabold">404</h1>
      <p className="mb-8 text-muted">This page doesn't exist.</p>
      <Link to="/" className="bg-brand rounded-full px-6 py-3 font-semibold text-white hover:brightness-110">
        Back to home
      </Link>
    </section>
  )
}
