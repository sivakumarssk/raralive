import { Link } from 'react-router-dom'
import LegalPage from '../components/LegalPage'
import { APP, COMPANY } from '../company'

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <>
          These Terms govern your use of the {APP.name} app and website, provided by{' '}
          <strong className="text-white">{COMPANY.legalName}</strong> ("we", "us"). By creating an account or using{' '}
          {APP.name}, you agree to these Terms and our <Link to="/privacy-policy">Privacy Policy</Link>.
        </>
      }
    >
      <h2>1. Eligibility</h2>
      <p>
        You must be at least {APP.minAge} years old and legally able to enter into a contract to use {APP.name}. You may
        hold only one account, and you are responsible for everything done through it. Keep your password and OTP
        private.
      </p>

      <h2>2. Community rules</h2>
      <p>You must not use {APP.name} to post, stream, say or send anything that:</p>
      <ul>
        <li>involves nudity, sexual content or sexual solicitation;</li>
        <li>involves minors in any way that is sexual, harmful or exploitative (we report this to the authorities);</li>
        <li>harasses, bullies, threatens or impersonates anyone;</li>
        <li>promotes hate, violence, self-harm, terrorism, or illegal drugs or weapons;</li>
        <li>is fraudulent, spam, a scam, or promotes gambling;</li>
        <li>infringes anyone's copyright, trademark or privacy;</li>
        <li>shares someone's personal information without their consent.</li>
      </ul>
      <p>
        You must also not hack, reverse-engineer, scrape or disrupt the Service, use bots or multiple accounts to
        manipulate rankings or rewards, or buy and sell coins, gems or accounts outside the app.
      </p>

      <h2>3. Your content</h2>
      <p>
        You own the content you create. You give us a non-exclusive, worldwide, royalty-free licence to host, store,
        display, transmit and moderate it for as long as needed to operate and promote the Service. You confirm that you
        have the rights to everything you share.
      </p>

      <h2>4. Virtual items: coins, gifts and gems</h2>
      <ul>
        <li><strong>Coins</strong> are purchased through Google Play and used to send virtual gifts and access features. Coins have no cash value, cannot be exchanged for money, and are non-transferable except as gifts inside the app.</li>
        <li><strong>Gifts</strong> are sent at your own choice and are final once sent.</li>
        <li><strong>Gems</strong> are earned by eligible hosts from gifts and activity. Hosts may redeem gems under our host and agency rules, subject to identity verification, minimum thresholds and applicable taxes.</li>
        <li>Purchases are non-refundable except as required by law or Google Play's refund policy.</li>
        <li>We may change prices, exchange rates and item availability. Items obtained through fraud, chargebacks or bugs may be removed.</li>
      </ul>

      <h2>5. Hosts and agencies</h2>
      <p>
        Hosts and agencies who earn through {APP.name} must follow these Terms and any additional host or agency
        policies we publish. We may withhold or reverse earnings obtained through fraud, fake gifting, collusion or rule
        violations.
      </p>

      <h2>6. Moderation and termination</h2>
      <p>
        We may review, remove or restrict content, and warn, mute, suspend or permanently ban accounts that break these
        Terms or the law, with or without notice. Balances in banned accounts may be forfeited where the ban results from
        a serious violation. You can delete your account at any time. See <Link to="/delete-account">Delete Account</Link>.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available". We do not guarantee that it will be uninterrupted or
        error-free. We do not control, and are not responsible for, what other users say or do in live rooms and
        streams.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the extent permitted by law, {COMPANY.legalName} is not liable for indirect, incidental or consequential
        losses. Our total liability to you for any claim is limited to the amount you paid us in the 3 months before
        the claim arose.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts
        at Kamareddy, Telangana.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these Terms. If you keep using {APP.name} after changes take effect, you accept the updated
        Terms.
      </p>

      <h2>11. Contact and grievances</h2>
      <p>
        {COMPANY.legalName}
        <br />
        {COMPANY.addressLines.map((l) => (
          <span key={l}>{l}<br /></span>
        ))}
        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
      </p>
    </LegalPage>
  )
}
