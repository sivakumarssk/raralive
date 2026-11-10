// In-app copies of the legal pages on raralive.in (landingpage/src/pages).
// Keep the two in step: when a policy changes there, change it here too and
// bump LEGAL_UPDATED.
//
// Text can mark **bold** words; everything else is plain.

export const COMPANY = {
  legalName: 'TANUSH INFO (OPC) PRIVATE LIMITED',
  developerName: 'TANUSH INFO',
  address: 'Kamareddy - 503144, India',
  email: 'tanushinfopvtltd@gmail.com',
};

export const LEGAL_UPDATED = '28 October 2026';

export type LegalBlock =
  | { h2: string }
  | { h3: string }
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: [string, string]; rows: [string, string][] } };

export type LegalDocId = 'privacy-policy' | 'terms' | 'delete-account';

export type LegalDoc = { title: string; intro: string; blocks: LegalBlock[] };

const APP = 'Rara Live';
const MIN_AGE = 18;
const { legalName, developerName, address, email } = COMPANY;

const contactBlock = `${legalName}\n${address}\nEmail: ${email}`;

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  'privacy-policy': {
    title: 'Privacy Policy',
    intro: `This Privacy Policy explains how **${legalName}** ("we", "us", "our") collects, uses, shares and protects your information when you use the ${APP} mobile application and the website raralive.in (together, the "Service").`,
    blocks: [
      { h2: '1. Who we are' },
      { p: `${APP} is developed and operated by ${legalName}, registered at ${address}. We are the data controller (data fiduciary) for the personal data described in this policy. You can contact us at ${email}.` },

      { h2: '2. Information we collect' },
      { h3: '2.1 Information you give us' },
      { ul: [
        '**Account details:** mobile phone number, password (stored only in encrypted/hashed form) and, optionally, email address.',
        '**Profile details:** display name, username, gender, date of birth, preferred language, profile photo and cover photo.',
        '**Posts and comments:** photos, videos, captions and comments you publish, and posts you like.',
        '**Private messages:** text, photos, videos, voice messages and files you send in one-to-one chats.',
        '**Rooms:** room name, description, cover image and the city, state and district you add to a room.',
        '**Friend Zone application:** if you apply to be listed for paid calls, your full name, gender, date of birth, city, "About me" text, languages and photo.',
        '**Reports and support requests:** information you send when you report a user or contact us by email or WhatsApp.',
        '**Agencies and hosts who receive payouts:** to verify identity and pay earnings, we collect the account holder name, bank name, account number and IFSC, Aadhaar number, PAN, and copies of the Aadhaar card, PAN card and bank proof. These are used only for verification, payouts and legal/tax compliance, are never shown to other users, and are accessible only to authorised staff.',
      ] },
      { h3: '2.2 Information collected when you use the Service' },
      { ul: [
        '**Live audio and video:** when you join a mic seat, go live or make a call, your microphone audio and (if you turn it on) camera video are transmitted in real time to other participants.',
        '**Activity data:** rooms you join, users you follow, gifts sent and received, calls made (with duration), PK battle results, coin and gem balances, levels, tasks and transaction history.',
        "**Location (optional):** only if you grant location permission when creating a room, we read your device location once to fill in the room's city, state and district. We store those place names, not your GPS coordinates, and we do not track your location in the background.",
        '**Technical data:** IP address, request logs, device type and app version, used to run, secure and troubleshoot the Service.',
      ] },
      { h3: '2.3 Device permissions' },
      { table: {
        head: ['Permission', 'Why we ask'],
        rows: [
          ['Microphone', 'Speak in voice rooms, go live, make calls and record voice messages.'],
          ['Camera', 'Video live streams and calls, and taking photos for your profile, posts and chats.'],
          ['Photos and videos', 'Choose media for your profile, posts and chats, and save images to your gallery when you ask.'],
          ['Location (optional)', 'Auto-fill the city, state and district of a room you create.'],
          ['Notifications', 'Alert you about messages, calls and activity.'],
          ['Bluetooth', 'Play room and call audio through your Bluetooth headset.'],
        ],
      } },
      { p: 'You can turn any permission off in your device settings. Some features will not work without it.' },

      { h2: '3. How we use your information' },
      { ul: [
        'To create and secure your account, including verifying your phone number by OTP.',
        'To provide voice rooms, live streams, calls, chat, gifts, leaderboards and other features.',
        'To process coin purchases, gift transactions, and host and agency earnings and withdrawals.',
        'To verify the identity of agencies and hosts who receive payouts, and to meet tax obligations.',
        'To keep the community safe: review reports, detect fraud and abuse, and enforce our Terms of Service.',
        'To send service notifications and respond to support requests.',
        'To fix bugs, measure performance and improve the Service.',
        'To comply with legal obligations and lawful requests from authorities.',
      ] },
      { p: 'We do not sell your personal data. We do not use your data for third-party advertising.' },

      { h2: '4. What other users can see' },
      { p: 'Your display name, username, profile and cover photos, bio, level, gender, follower counts, posts, comments and public activity (such as rooms you host and gifts you send in rooms) are visible to other users. If you are listed in Friend Zone, your Friend Zone profile is visible to other users. Anything you say or show in a room, live stream or call is seen and heard by the people in it. Private messages are visible to you and the person you send them to.' },

      { h2: '5. How we share information' },
      { p: 'We share personal data only with:' },
      { ul: [
        '**Service providers** who process data on our behalf: our cloud hosting provider, Agora (Agora.io, which delivers real-time audio and video for rooms, live streams and calls) and SMS providers that deliver verification codes.',
        "**WhatsApp (Meta)**, only if you choose to contact us through WhatsApp, for example about buying coins or withdrawing earnings. The app opens WhatsApp with a pre-filled message containing your username and the amount. WhatsApp's own privacy policy applies to that conversation.",
        '**Payment and banking partners**, to complete payments and payouts. We do not store your card or UPI PIN details.',
        '**Agencies** you choose to join as a host, which can see your host performance and earnings.',
        '**Law enforcement or regulators** when required by law, or to protect the safety of our users or the public.',
        '**A successor entity** if our business is merged or sold, subject to this policy.',
      ] },

      { h2: '6. Data retention' },
      { ul: [
        'Account and profile data is kept while your account is active.',
        'When you delete your account, we delete or anonymise your personal data within 30 days, except where we must keep it longer.',
        'Transaction and payout records, and the KYC details of agencies and hosts who received payouts, are kept for up to 8 years to meet Indian tax and accounting law.',
        'Records linked to safety reports or legal matters may be kept for as long as needed to resolve them.',
      ] },

      { h2: '7. Security' },
      { p: 'Data is sent over encrypted connections (HTTPS/TLS), passwords are hashed, and access to our systems is limited to authorised staff. No method of transmission or storage is completely secure, but we work to protect your information and will notify you and the authorities of a breach where the law requires.' },

      { h2: '8. Your rights' },
      { p: "Subject to applicable law, including India's Digital Personal Data Protection Act, 2023, you can:" },
      { ul: [
        'access and correct your personal data (most profile details can be edited in the app);',
        'request deletion of your account and data (see Delete Account in the profile menu);',
        'withdraw consent, such as by turning off permissions;',
        'raise a grievance with us, and if unresolved, with the Data Protection Board of India.',
      ] },
      { p: `Email ${email} from, or quoting, the phone number registered to your account. We respond within 30 days.` },

      { h2: '9. Age restriction' },
      { p: `${APP} is only for people aged ${MIN_AGE} and over. We do not knowingly collect data from anyone under ${MIN_AGE}. If we learn that an account belongs to a minor, we delete it. Report suspected underage users to ${email}.` },

      { h2: '10. International transfers' },
      { p: 'Your data may be stored and processed on servers in India or other countries where we or our service providers (for example, cloud hosting and real-time media delivery) operate. When that happens, we require appropriate safeguards.' },

      { h2: '11. Changes to this policy' },
      { p: 'We may update this policy. We will change the "Last updated" date above and, for significant changes, notify you in the app.' },

      { h2: '12. Grievance Officer and contact' },
      { p: `**Grievance Officer, ${legalName}**\n${address}\nEmail: ${email}` },
    ],
  },

  terms: {
    title: 'Terms of Service',
    intro: `These Terms govern your use of the ${APP} app and website, provided by **${legalName}** ("we", "us"). By creating an account or using ${APP}, you agree to these Terms and our Privacy Policy.`,
    blocks: [
      { h2: '1. Eligibility' },
      { p: `You must be at least ${MIN_AGE} years old and legally able to enter into a contract to use ${APP}. You may hold only one account, and you are responsible for everything done through it. Keep your password and OTP private.` },

      { h2: '2. Community rules' },
      { p: `You must not use ${APP} to post, stream, say or send anything that:` },
      { ul: [
        'involves nudity, sexual content or sexual solicitation;',
        'sexually abuses or exploits children (CSAE), including child sexual abuse material, or involves minors in any way that is sexual, harmful or exploitative. We report this to the authorities;',
        'harasses, bullies, threatens or impersonates anyone;',
        'promotes hate, violence, self-harm, terrorism, or illegal drugs or weapons;',
        'is fraudulent, spam, a scam, or promotes gambling;',
        "infringes anyone's copyright, trademark or privacy;",
        "shares someone's personal information without their consent.",
      ] },
      { p: 'You must also not hack, reverse-engineer, scrape or disrupt the Service, use bots or multiple accounts to manipulate rankings or rewards, or buy and sell coins, gems or accounts outside the app.' },

      { h2: '3. Your content' },
      { p: 'You own the content you create. You give us a non-exclusive, worldwide, royalty-free licence to host, store, display, transmit and moderate it for as long as needed to operate and promote the Service. You confirm that you have the rights to everything you share.' },

      { h2: '4. Virtual items: coins, gifts and gems' },
      { ul: [
        '**Coins** are purchased with real money through the payment options offered in the app and used to send virtual gifts and access features. Coins have no cash value, cannot be exchanged for money, and are non-transferable except as gifts inside the app.',
        '**Gifts** are sent at your own choice and are final once sent.',
        '**Gems** are earned by eligible hosts from gifts and activity. Hosts may redeem gems under our host and agency rules, subject to identity verification, minimum thresholds and applicable taxes.',
        'Purchases are non-refundable except as required by law or by the refund policy of the payment provider you used.',
        'We may change prices, exchange rates and item availability. Items obtained through fraud, chargebacks or bugs may be removed.',
      ] },

      { h2: '5. Hosts and agencies' },
      { p: `Hosts and agencies who earn through ${APP} must follow these Terms and any additional host or agency policies we publish. We may withhold or reverse earnings obtained through fraud, fake gifting, collusion or rule violations.` },

      { h2: '6. Moderation and termination' },
      { p: 'We may review, remove or restrict content, and warn, mute, suspend or permanently ban accounts that break these Terms or the law, with or without notice. Balances in banned accounts may be forfeited where the ban results from a serious violation. You can delete your account at any time (see Delete Account in the profile menu).' },

      { h2: '7. Disclaimers' },
      { p: 'The Service is provided "as is" and "as available". We do not guarantee that it will be uninterrupted or error-free. We do not control, and are not responsible for, what other users say or do in live rooms and streams.' },

      { h2: '8. Limitation of liability' },
      { p: `To the extent permitted by law, ${legalName} is not liable for indirect, incidental or consequential losses. Our total liability to you for any claim is limited to the amount you paid us in the 3 months before the claim arose.` },

      { h2: '9. Governing law' },
      { p: 'These Terms are governed by the laws of India. Disputes are subject to the exclusive jurisdiction of the courts at Kamareddy, Telangana.' },

      { h2: '10. Changes' },
      { p: `We may update these Terms. If you keep using ${APP} after changes take effect, you accept the updated Terms.` },

      { h2: '11. Contact and grievances' },
      { p: contactBlock },
    ],
  },

  'delete-account': {
    title: 'Delete Account',
    intro: `This page explains how to request deletion of your **${APP}** account and associated data. ${APP} is developed by **${developerName}** (${legalName}).`,
    blocks: [
      { h2: 'How to request deletion' },
      { ol: [
        `Tap **Email a deletion request** below, or send an email to ${email} with the subject **"Rara Live – Account deletion request"**.`,
        'Include the **phone number registered to your account** and, if you know it, your username.',
        'To confirm that you own the account, we may send an OTP to that number or ask you to reply from the app.',
        'We will confirm and complete the deletion within **30 days**, and email you when it is done.',
      ] },

      { h2: 'What we delete' },
      { ul: [
        'Your account: phone number, email and password.',
        'Your profile: name, username, gender, date of birth, language, and profile and cover photos.',
        'Your followers and following lists, and the rooms you created.',
        'Your chat messages, posts and uploaded images.',
        'Coin, gem and level balances. **Remaining balances are lost and cannot be refunded.**',
      ] },

      { h2: 'What we keep, and for how long' },
      { ul: [
        '**Purchase, gift and payout records:** kept for up to 8 years, as Indian tax and accounting law requires. They are no longer linked to an active profile.',
        '**Data related to safety reports, fraud or legal requests:** kept until the matter is resolved, or for as long as the law requires.',
        '**Server backups:** overwritten within 90 days.',
      ] },
      { p: 'Messages you sent to other people may stay visible in their conversations, attributed to a deleted account.' },

      { h2: 'Deleting only some data' },
      { p: `You can change or remove your profile photo, cover photo and profile details in the app at any time. To delete specific data without closing your account, email ${email} and tell us what you would like removed.` },

      { h2: 'Contact' },
      { p: `${legalName}\nEmail: ${email}` },
    ],
  },
};
