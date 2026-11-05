import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'
import { APP, COMPANY } from '../company'

export default function ChildSafety() {
  return (
    <LegalPage
      title="Child Safety Standards"
      intro={
        <>
          These are the published child safety standards for the <strong className="text-white">{APP.name}</strong> app
          on Google Play, developed by <strong className="text-white">{COMPANY.developerName}</strong> (
          {COMPANY.legalName}). <strong className="text-white">{APP.name} strictly prohibits child sexual abuse and
          exploitation (CSAE)</strong>, including child sexual abuse material (CSAM). We have zero tolerance for it.
        </>
      }
    >
      <h2>1. Prohibited: child sexual abuse and exploitation (CSAE)</h2>
      <p>
        Child sexual abuse and exploitation is strictly prohibited on {APP.name}. A child is anyone under 18. Users must
        not create, upload, share, stream, request or link to any content or behaviour that sexually abuses, exploits
        or endangers children. This includes:
      </p>
      <ul>
        <li>child sexual abuse material (CSAM) of any kind, including drawn, edited or AI-generated imagery;</li>
        <li>grooming: contacting or befriending a child in order to sexually abuse or exploit them;</li>
        <li>sextortion: threatening or blackmailing a child using intimate images;</li>
        <li>sexualising minors in images, video, live streams, voice rooms, chat messages, usernames or profiles;</li>
        <li>child trafficking, or advertising or soliciting a child for sexual purposes;</li>
        <li>any other conduct that sexually exploits or endangers a child.</li>
      </ul>
      <p>
        These standards apply to every part of {APP.name}: profiles, posts, voice rooms, live streams, private chats,
        audio calls and gifts. They form part of our <Link to="/terms">Terms of Service</Link>.
      </p>

      <h2>2. Age requirement</h2>
      <p>
        {APP.name} is only for users aged {APP.minAge} and over. Accounts found to belong to minors are removed.
      </p>

      <h2>3. How to report in the app</h2>
      <ul>
        <li><strong>A user:</strong> open their profile, tap <strong>Report</strong> and choose <strong>Child safety concern</strong>.</li>
        <li><strong>A voice room:</strong> open the room's <strong>⋮</strong> menu and tap <strong>Report Chatroom</strong>.</li>
        <li><strong>A chat message or live comment:</strong> press and hold it (or tap it) and choose <strong>Report</strong>.</li>
      </ul>
      <p>
        You can also email <a href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('Child safety report')}`}>{COMPANY.email}</a> with
        the subject "Child safety report". Include the username, room name and time if you know them. Child safety
        reports are reviewed first.
      </p>

      <h2>4. How we enforce these standards</h2>
      <ul>
        <li>We immediately remove CSAE content and permanently ban the accounts involved.</li>
        <li>We moderate reported profiles, rooms, live streams and messages, and act on repeated reports automatically.</li>
        <li>We preserve relevant evidence and report apparent CSAM to the authorities. In India, that includes the National Cyber Crime Reporting Portal (cybercrime.gov.in) and local police. Where applicable, we also report to the National Center for Missing &amp; Exploited Children (NCMEC).</li>
        <li>We comply with child safety law and cooperate with law enforcement, including under the Protection of Children from Sexual Offences (POCSO) Act, 2012 and the Information Technology Act, 2000.</li>
      </ul>

      <h2>5. Child safety point of contact</h2>
      <p>
        Our designated contact for child safety and CSAM prevention, including enquiries from Google Play and law
        enforcement:
        <br />
        <strong>Child Safety Officer, {COMPANY.developerName} ({COMPANY.legalName})</strong>
        <br />
        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </p>

      <p>
        If a child is in immediate danger, contact local police (<strong>112</strong>) or Childline India (
        <strong>1098</strong>) first.
      </p>
    </LegalPage>
  )
}
