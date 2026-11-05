# Rara Live — Play Console setup (new app: `com.tanushssts.raralive`)

Everything below repeats the answers worked out for the first app
(`com.sowsitechnologies.raralive`). Follow the sections in order.

Developer account: **TANUSH INFO (OPC) PRIVATE LIMITED** (organisation — no 12-tester rule).

---

## 0. Before building — put the app in release mode

`main` is currently in **development mode**. For any Play build, change:

| File | Development (now) | Play build |
|---|---|---|
| `app/services/api.ts` | `http://192.168.0.5:5000` | `https://api.raralive.in` (uncomment the two production lines) |
| `app/constants/features.ts` | `coinPurchases: true`, `spinAndWin: true` | both `false` (WhatsApp coin purchase is not allowed on Play) |
| Create tab gallery | full in-app gallery + `READ_MEDIA_*` | system photo picker (as in branch `release/1.0.0-build5`), **or** keep the gallery and fill the Photo & video permissions declaration (section 2.14) |

Package is already set: `app/app.json` → `"package": "com.tanushssts.raralive"`.

## 1. Build the AAB

```bash
cd app
eas build -p android --profile production
```

- EAS will say there are **no credentials for `com.tanushssts.raralive`** and offer to
  **generate a new keystore** → answer **Yes**. (Each package has its own keystore.)
- Upload should be ~30 MB (`.easignore` at repo root). If it shows bytes or >100 MB, stop.
- Download the `.aab` from the build page when it finishes.

## 2. Create the app in Play Console

**All apps → Create app**

| Field | Value |
|---|---|
| App name | `Rara Live` |
| Default language | English (United Kingdom) or English (India) — same as before |
| App or game | App |
| Free or paid | Free |
| Declarations | tick Developer Programme Policies + US export laws |

Then open **Dashboard → Set up your app** and complete each task below.

### 2.1 Privacy policy
`https://raralive.in/privacy-policy`

### 2.2 Sign-in details (App access)
- Is any part of your app restricted? **Yes**
- Name: `Reviewer test account`
- Username: `+91 9999999999`
- Password: the 4-digit OTP set for this number in `OTP_TEST_NUMBERS` on the live server (no SMS is sent)
- Other information:

```
Enter the phone number above on the login screen and tap Send OTP. No SMS is sent to this number; enter the fixed 4-digit code above on the next screen. The account has coins pre-loaded to test sending gifts, PK battles and Friend Zone audio calls (reviewers cannot purchase coins). Join any live room from the Home tab or create one from the "+" tab. Allow microphone and camera for voice rooms and live streaming. The app is for users aged 18+.
```

- Tick **"Sign-in details … provide full access to all the features…"**.
- The account must **exist on the live DB with coins** before you send for review.

### 2.3 Ads
Does your app contain ads? **No**

### 2.4 Content rating
- Email: `tanushinfopvtltd@gmail.com`
- Category: **Social or communication** → agree to IARC terms
- Type: **Social**

| Question | Answer |
|---|---|
| Significant portion used for dating / sexual relationships? | **No** |
| Public sharing of nudity? | **No** |
| Graphic real-world violence? | **No** |
| Shares user's current **precise** location with other users? | **No** |
| Users can purchase digital goods? | **Yes** |
| Random / loot-box purchases? | **No** |
| Block users / content? | **Yes** |
| Report users / content? | **Yes** |
| Chat moderation? | **Yes** |
| Interactions limited to invited friends only? | **No** |

Expected result: 12+ / Teen / PEGI parental guidance — normal. Save.

### 2.5 Target audience and content
- Target age groups: **18 and over only**
- Tick **"Restrict users that Google has determined to be minors"** (recommended)
- Could unintentionally appeal to children? **No**

### 2.6 News app
Is your app a news app? **No**

### 2.7 Data safety

**Data collection and security**

| Question | Answer |
|---|---|
| Collects or shares required user data? | **Yes** |
| All data encrypted in transit? | **Yes** (only true with the HTTPS API — section 0) |
| Account creation methods | **Phone number with OTP** |
| Delete account URL | `https://raralive.in/delete-account` |
| Can users request deletion of some data without deleting the account? | **Yes** |

**Data types** — for every type: **Collected only** (never "Shared"), **not ephemeral**.

| Data type | Required / optional | Purposes |
|---|---|---|
| Personal info → Name | Required | App functionality, Account management |
| Personal info → Email address | Optional | Account management |
| Personal info → User IDs | Required | App functionality, Account management |
| Personal info → Phone number | Required | Account management, Fraud prevention/security |
| Personal info → Other info (gender, date of birth) | Required | App functionality, Account management |
| Financial info → Purchase history | Required | App functionality, Fraud prevention/security |
| Location → Approximate location | Optional | App functionality |
| Messages → Other in-app messages | Optional | App functionality |
| Photos and videos → Photos | Optional | App functionality |
| Photos and videos → Videos | Optional | App functionality |
| Audio → Voice or sound recordings | Optional | App functionality |
| Files and docs | Optional | App functionality |
| App activity → App interactions | Required | App functionality, Personalisation |
| App activity → Other user-generated content | Optional | App functionality |

Do **not** declare: Device or other IDs, Precise location, Contacts, Calendar, Health,
Web browsing, Payment info, Credit score, Installed apps, Crash logs, Diagnostics,
Aadhaar/PAN/bank details (collected in the admin panel, not the app).

### 2.8 Government apps
**No**

### 2.9 Financial features
**My app doesn't provide any financial features**

### 2.10 Health apps
None / not a health app

### 2.11 Advertising ID
Does your app use advertising ID? **No**

### 2.12 Child safety standards
- Safety standards URL: `https://raralive.in/child-safety`
- Contact: **Use tanushinfopvtltd@gmail.com**
- Tick both boxes (in-app reporting; complies with child safety laws)

### 2.13 Foreground service permissions
Should **not** appear (media playback / projection are blocked in `app.json`).
If it does, stop and check the build.

### 2.14 Photo and video permissions (only if you ship the full gallery)
If the AAB contains `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`, declare:

```
Rara Live is a social media app where creating and sharing photo and video posts is a core feature. The Create tab (one of five main tabs) opens an in-app gallery where users browse all their photos and videos by album, select up to 10 items and publish them as a post to the Home feed, which is a photo/video feed. Users access their gallery frequently to create posts, so the one-time system photo picker does not support this core flow.
```

Add a 20–30 s unlisted YouTube demo if asked (Home feed → Create → albums → select → post).
Safer alternative: ship the photo picker version and this section disappears.

## 3. Store presence

### 3.1 App category and contact details
| Field | Value |
|---|---|
| App or game | App |
| Category | **Social** |
| Tags | Communication, Entertainment, Social, Text messaging, Video call |
| Email | `tanushinfopvtltd@gmail.com` |
| Phone | leave blank |
| Website | `https://raralive.in` |
| External marketing | leave on |

### 3.2 Main store listing
| Field | Value / file |
|---|---|
| App name | `Rara Live` |
| Short description | `Share photos & videos, join live voice rooms, go live and send gifts.` |
| Full description | copy from `store-assets/store-listing.txt` (from "Rara Live is a social app…" to the Support line) |
| App icon | `store-assets/app-icon-512.png` |
| Feature graphic | `store-assets/feature-graphic-1024x500.png` |
| Phone screenshots | 4–8 portrait shots — Home feed, voice room, live stream, gift panel, PK battle, leaderboard, chat, Create screen. **No Wallet prices / WhatsApp button, no suggestive photos.** |
| Video | leave empty |

**AI asset declaration**: label the feature graphic (and the icon if an AI tool made it), or
choose "Don't label assets" — either is acceptable.

## 4. Closed testing release

1. **Testing → Closed testing → Alpha** (or create track).
2. **Countries/regions** → add **India**.
3. **Testers** → Create email list `Rara Live team` → add testers' Gmail → tick → Feedback email `tanushinfopvtltd@gmail.com` → Save.
4. **Create new release** → upload the `.aab`.
   - Release name: `1.0.0 (1) – Closed testing` (use the versionCode EAS shows)
   - Release notes:

```
<en-GB>
First test release of Rara Live.
• Share photo and video posts to the Home feed
• Join live voice rooms and go live on video
• PK battles, animated gifts and leaderboards
• Private chat with photos, videos and voice messages
• Friend Zone audio calls
• Available in 8 Indian languages
</en-GB>
```
   (Keep whatever language tag Play pre-fills.)
5. Ignore the "no deobfuscation file" warning.

## 5. Send for review

1. Reviewer account `+91 9999999999` exists on the live DB, profile complete, coins added, OTP login tested with the fixed code from `OTP_TEST_NUMBERS`.
2. **Publishing overview** → no errors → **Send changes for review**.
3. After approval: **Testers** tab → copy **Join on the web** link → send to the team.

## 6. The old app (`com.sowsitechnologies.raralive`)

- Its package can't change. Don't promote it to production.
- In its Closed testing track, **Pause track** (or remove the release) so testers move to the new app.
- Leave it unpublished; deleting may not be allowed once it has had a release.
- Testers must uninstall the old app — the new package installs as a separate app.

## 7. Before production (later)

- MSG91 OTP live on the backend; remove hard-coded `1234` and `devOtp`; allow-list `9999999999` for the reviewer.
- Reset the DB → re-create the reviewer account with the same credentials + coins.
- Coin purchases only via Google Play Billing (or keep hidden).
- Promote the tested closed-testing release to **Production** (countries: India).
