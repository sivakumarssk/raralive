// Writes a static HTML file per route into dist/ after `vite build`.
// /child-safety → dist/child-safety/index.html, and so on.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href)

const SITE = 'https://raralive.in'
const ROUTES = {
  '/': {
    title: 'Rara Live – Live Voice Rooms, Streaming & Gifting',
    description:
      'Rara Live is a live voice-room and video-streaming app by TANUSH INFO (OPC) PRIVATE LIMITED. Join rooms, go live, chat with friends and send gifts.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy – Rara Live',
    description: 'How TANUSH INFO (OPC) PRIVATE LIMITED collects, uses and protects your data in the Rara Live app.',
  },
  '/terms': {
    title: 'Terms of Service – Rara Live',
    description: 'Terms of Service for the Rara Live app by TANUSH INFO (OPC) PRIVATE LIMITED.',
  },
  '/delete-account': {
    title: 'Delete Your Account – Rara Live',
    description: 'How to delete your Rara Live account and associated data.',
  },
  '/child-safety': {
    title: 'Child Safety Standards (CSAE Policy) – Rara Live',
    description:
      'Rara Live by TANUSH INFO prohibits child sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM). Our standards, reporting and child safety contact.',
  },
}

const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')

for (const [route, meta] of Object.entries(ROUTES)) {
  const url = SITE + (route === '/' ? '/' : route)
  const html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(meta.title)}</title>`)
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${escapeAttr(meta.description)}" />`)
    .replace(/<meta property="og:url"[^>]*\/>/, `<meta property="og:url" content="${url}" />\n    <link rel="canonical" href="${url}" />`)
    .replace('<div id="root"></div>', `<div id="root" data-route="${route}">${render(route)}</div>`)

  const out = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, html)
  console.log(`prerendered ${route} → ${path.relative(root, out)}`)
}
