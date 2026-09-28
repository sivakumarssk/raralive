import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'
import { APP, COMPANY } from '../company'

export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          This Privacy Policy explains how <strong className="text-white">{COMPANY.legalName}</strong> ("we", "us",
          "our") collects, uses, shares and protects your information when you use the {APP.name} mobile application
          and the website {APP.domain} (together, the "Service").
        </>
      }
    >
      <h2>1. Who we are</h2>
      <p>
        {APP.name} is developed and operated by {COMPANY.legalName}, registered at {COMPANY.addressLines.join(', ')}.
        We are the data controller (data fiduciary) for the personal data described in this policy. You can contact us
        at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>2. Information we collect</h2>
      <h3>2.1 Information you give us</h3>
      <ul>
        <li><strong>Account details:</strong> mobile phone number, password (stored only in encrypted/hashed form) and, optionally, email address.</li>
        <li><strong>Profile details:</strong> display name, username, gender, date of birth, preferred language, profile photo and cover photo.</li>
        <li><strong>Content you create:</strong> room names and descriptions, chat messages, comments, posts and images you upload.</li>
        <li><strong>Reports and support requests:</strong> information you send when you report a user or contact us.</li>
        <li><strong>Hosts and agencies:</strong> if you apply to earn as a host or run an agency, we collect the details needed to pay you, such as account holder name, bank name, account number and IFSC.</li>
      </ul>

      <h3>2.2 Information collected when you use the Service</h3>
      <ul>
        <li><strong>Live audio and video:</strong> when you join a mic seat, go live or make a call, your microphone audio and (if you turn it on) camera video are transmitted in real time to other participants.</li>
        <li><strong>Activity data:</strong> rooms you join, users you follow, gifts sent and received, coin and gem balances, levels, tasks and transaction history.</li>
        <li><strong>Approximate location (optional):</strong> only if you grant location permission when creating a room, we use your device location to fill in your city. We store the city name, not your precise coordinates.</li>
        <li><strong>Device and technical data:</strong> device model, operating system, app version, IP address, crash logs and push-notification token.</li>
      </ul>

      <h3>2.3 Device permissions</h3>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Permission</th><th>Why we ask</th></tr>
          </thead>
          <tbody>
            <tr><td>Microphone</td><td>Speak in voice rooms, go live and make calls.</td></tr>
            <tr><td>Camera</td><td>Video live streams, video calls and taking profile photos.</td></tr>
            <tr><td>Photos / media</td><td>Choose a profile photo, cover photo or images to share.</td></tr>
            <tr><td>Location (optional)</td><td>Show your city on rooms you create.</td></tr>
            <tr><td>Notifications</td><td>Tell you about messages, followers and live events.</td></tr>
            <tr><td>Bluetooth</td><td>Route room audio to your Bluetooth headset.</td></tr>
          </tbody>
        </table>
      </div>
      <p>You can turn any permission off in your device settings. Some features will not work without it.</p>

      <h2>3. How we use your information</h2>
      <ul>
        <li>To create and secure your account, including verifying your phone number by OTP.</li>
        <li>To provide voice rooms, live streams, calls, chat, gifts, leaderboards and other features.</li>
        <li>To process coin purchases, gift transactions and host/agency earnings.</li>
        <li>To keep the community safe: review reports, detect fraud and abuse, and enforce our <Link to="/terms">Terms of Service</Link>.</li>
        <li>To send service notifications and respond to support requests.</li>
        <li>To fix bugs, measure performance and improve the Service.</li>
        <li>To comply with legal obligations and lawful requests from authorities.</li>
      </ul>
      <p>We do not sell your personal data. We do not use your data for third-party advertising.</p>

      <h2>4. What other users can see</h2>
      <p>
        Your display name, username, profile and cover photos, level, gender, follower counts and public activity (such
        as rooms you host and gifts you send in public rooms) are visible to other users. Anything you say or show in a
        room or live stream is seen and heard by the people in it.
      </p>

      <h2>5. How we share information</h2>
      <p>We share personal data only with:</p>
      <ul>
        <li><strong>Service providers</strong> who process data on our behalf, including our cloud hosting provider, Agora (real-time audio and video delivery), SMS/OTP providers and push-notification services (Expo / Firebase Cloud Messaging).</li>
        <li><strong>Google Play</strong>, which processes coin purchases. We never receive your card or UPI details.</li>
        <li><strong>Agencies</strong> you choose to join as a host, which can see your host performance and earnings.</li>
        <li><strong>Law enforcement or regulators</strong> when required by law, or to protect the safety of our users or the public.</li>
        <li><strong>A successor entity</strong> if our business is merged or sold, subject to this policy.</li>
      </ul>

      <h2>6. Data retention</h2>
      <ul>
        <li>Account and profile data is kept while your account is active.</li>
        <li>When you delete your account, we delete or anonymise your personal data within 30 days, except where we must keep it longer.</li>
        <li>Transaction and payout records are kept for up to 8 years to meet Indian tax and accounting law.</li>
        <li>Records linked to safety reports or legal matters may be kept for as long as needed to resolve them.</li>
      </ul>

      <h2>7. Security</h2>
      <p>
        Data is sent over encrypted connections (HTTPS/TLS), passwords are hashed, and access to our systems is limited
        to authorised staff. No method of transmission or storage is completely secure, but we work to protect your
        information and will notify you and the authorities of a breach where the law requires.
      </p>

      <h2>8. Your rights</h2>
      <p>Subject to applicable law, including India's Digital Personal Data Protection Act, 2023, you can:</p>
      <ul>
        <li>access and correct your personal data (most profile details can be edited in the app);</li>
        <li>request deletion of your account and data. See <Link to="/delete-account">Delete Account</Link>;</li>
        <li>withdraw consent, such as by turning off permissions;</li>
        <li>raise a grievance with us, and if unresolved, with the Data Protection Board of India.</li>
      </ul>
      <p>
        Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> from, or quoting, the phone number registered to
        your account. We respond within 30 days.
      </p>

      <h2>9. Age restriction</h2>
      <p>
        {APP.name} is only for people aged {APP.minAge} and over. We do not knowingly collect data from anyone under{' '}
        {APP.minAge}. If we learn that an account belongs to a minor, we delete it. Report suspected underage users to{' '}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>. See our <Link to="/child-safety">Child Safety Standards</Link>.
      </p>

      <h2>10. International transfers</h2>
      <p>
        Your data may be stored and processed on servers in India or other countries where we or our service providers
        (for example, cloud hosting and real-time media delivery) operate. When that happens, we require appropriate
        safeguards.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy. We will change the "Last updated" date above and, for significant changes, notify you
        in the app.
      </p>

      <h2>12. Grievance Officer and contact</h2>
      <p>
        <strong>Grievance Officer, {COMPANY.legalName}</strong>
        <br />
        {COMPANY.addressLines.map((l) => (
          <span key={l}>{l}<br /></span>
        ))}
        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
        <br />
      </p>
    </LegalPage>
  )
}
