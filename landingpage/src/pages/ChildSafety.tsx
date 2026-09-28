import LegalPage from '../components/LegalPage'
import { APP, COMPANY } from '../company'

export default function ChildSafety() {
  return (
    <LegalPage
      title="Child Safety Standards"
      intro={
        <>
          <strong className="text-white">{COMPANY.legalName}</strong> has zero tolerance for child sexual abuse and
          exploitation (CSAE) and child sexual abuse material (CSAM) on {APP.name}. This page sets out our published
          standards.
        </>
      }
    >
      <h2>1. Our standards</h2>
      <ul>
        <li>{APP.name} is only for users aged {APP.minAge} and over. Accounts found to belong to minors are removed.</li>
        <li>Any content, conversation or behaviour that sexualises, grooms, exploits or endangers a child is strictly prohibited.</li>
        <li>This covers images, video, live streams, audio, text, links, usernames and profile content.</li>
      </ul>

      <h2>2. How users can report</h2>
      <ul>
        <li><strong>In the app:</strong> open the user's profile and use the <strong>Report</strong> option.</li>
        <li><strong>By email:</strong> write to <a href={`mailto:${COMPANY.email}?subject=${encodeURIComponent('Child safety report')}`}>{COMPANY.email}</a> with the subject "Child safety report". Include the username, room name and time, if known.</li>
      </ul>
      <p>Child safety reports are prioritised and reviewed as quickly as possible.</p>

      <h2>3. How we respond</h2>
      <ul>
        <li>We immediately remove violating content and permanently ban the accounts involved.</li>
        <li>We preserve relevant evidence and report apparent CSAM to the appropriate authorities. In India, that includes the National Cyber Crime Reporting Portal (cybercrime.gov.in) and local police. Where applicable, we also report to the National Center for Missing &amp; Exploited Children (NCMEC).</li>
        <li>We cooperate with law enforcement investigations as the law requires, including the Protection of Children from Sexual Offences (POCSO) Act, 2012 and the Information Technology Act, 2000.</li>
      </ul>

      <h2>4. Child safety point of contact</h2>
      <p>
        Our designated contact for child safety matters, including enquiries from Google Play and law enforcement:
        <br />
        <strong>Child Safety Officer, {COMPANY.legalName}</strong>
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
