import LegalPage from '../components/LegalPage'
import { APP, COMPANY } from '../company'

const MAIL_SUBJECT = encodeURIComponent('Rara Live – Account deletion request')
const MAIL_BODY = encodeURIComponent(
  'Please delete my Rara Live account and associated data.\n\n' +
    'Registered phone number: \n' +
    'Username (optional): \n\n' +
    'I understand that deletion is permanent and any remaining coins, gems and earnings will be lost.',
)

export default function DeleteAccount() {
  return (
    <LegalPage
      title="Delete your Rara Live account"
      intro={
        <>
          This page explains how to request deletion of your <strong className="text-white">{APP.name}</strong>{' '}
          account and associated data. {APP.name} is developed by{' '}
          <strong className="text-white">{COMPANY.developerName}</strong> ({COMPANY.legalName}).
        </>
      }
    >
      <h2>How to request deletion</h2>
      <ol>
        <li>
          Send an email to <a href={`mailto:${COMPANY.email}?subject=${MAIL_SUBJECT}&body=${MAIL_BODY}`}>{COMPANY.email}</a>{' '}
          with the subject <strong>"Rara Live – Account deletion request"</strong>.
        </li>
        <li>Include the <strong>phone number registered to your account</strong> and, if you know it, your username.</li>
        <li>To confirm that you own the account, we may send an OTP to that number or ask you to reply from the app.</li>
        <li>We will confirm and complete the deletion within <strong>30 days</strong>, and email you when it is done.</li>
      </ol>

      <p>
        <a
          href={`mailto:${COMPANY.email}?subject=${MAIL_SUBJECT}&body=${MAIL_BODY}`}
          className="bg-brand mt-2 inline-block rounded-full px-6 py-3 font-semibold text-white! no-underline! shadow-lg shadow-pink-600/30 hover:brightness-110"
        >
          Email a deletion request
        </a>
      </p>

      <h2>What we delete</h2>
      <ul>
        <li>Your account: phone number, email and password.</li>
        <li>Your profile: name, username, gender, date of birth, language, and profile and cover photos.</li>
        <li>Your followers and following lists, and the rooms you created.</li>
        <li>Your chat messages, posts and uploaded images.</li>
        <li>Coin, gem and level balances. <strong>Remaining balances are lost and cannot be refunded.</strong></li>
      </ul>

      <h2>What we keep, and for how long</h2>
      <ul>
        <li><strong>Purchase, gift and payout records:</strong> kept for up to 8 years, as Indian tax and accounting law requires. They are no longer linked to an active profile.</li>
        <li><strong>Data related to safety reports, fraud or legal requests:</strong> kept until the matter is resolved, or for as long as the law requires.</li>
        <li><strong>Server backups:</strong> overwritten within 90 days.</li>
      </ul>
      <p>Messages you sent to other people may stay visible in their conversations, attributed to a deleted account.</p>

      <h2>Deleting only some data</h2>
      <p>
        You can change or remove your profile photo, cover photo and profile details in the app at any time. To delete
        specific data without closing your account, email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> and
        tell us what you would like removed.
      </p>

      <h2>Contact</h2>
      <p>
        {COMPANY.legalName}
        <br />
        Email: <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </LegalPage>
  )
}
