# Appointment Texts (SMS) and 10DLC Registration

What's built for texting, how it works, and the steps to register the A2P 10DLC campaign and switch it on. Every quoted message below is produced by `src/lib/sms-templates.ts` (checked by `src/lib/sms.test.ts`). If you change the wording, update this file and bump `SMS_CONSENT_VERSION` in `src/lib/sms-consent.ts`.

Carrier rules change. Check each step against Twilio's current A2P 10DLC docs when you register. Nothing here is legal advice.

## 1. Status

**Built (2026-10-22):** opt-in box on `/register` and My Account, double opt-in (reply YES), consent log, Twilio sender with a dev console driver, texts for booking / reschedule / cancellation / standing appointments / 24h reminder, quiet hours, STOP / START / YES webhook, delivery-status webhook, texting status on the admin customer page, and `/privacy` and `/terms` pages with their SMS sections written.

**Not done:**
- Migration `20261022040455_add_sms_consent_and_messages` is applied to dev (2026-10-22). It isn't run against production yet; there is no production database.
- The general sections of `/privacy` and `/terms` are placeholders.
- Deploy.
- Twilio account, brand and campaign registration.

## 2. How it works

### Consent (double opt-in)

1. The customer ticks the box (`SmsConsentCheckbox`). It is never pre-checked, always optional, and booking never depends on it.
2. The server records `OPTED_IN` for the profile phone, normalised to E.164 by `toUsE164()`. US numbers only. It then sends one text:
   > Nail Image Inc.: Reply YES to get appointment texts (about 2 messages per booking). Msg & data rates may apply. Reply HELP for help, STOP to opt out.
3. The customer replies YES (or START). Twilio calls `POST /api/sms/inbound`, and the account is marked `CONFIRMED`. Only now do appointment texts start.
4. Texts stop (`OPTED_OUT`) in two ways:
   - **The number is forgotten** when the customer unticks the box on My Account, or when the profile phone changes (by the customer or by staff). They tick the box again to restart.
   - **The account is "stopped" and keeps the number** when the customer replies STOP or a synonym, or when Twilio refuses a send with error 21610 (the number had opted out). Texting START or YES from that number turns texts back on, as the terms say. The carrier blocks the number until then, so ticking the box shows "text START to …" instead.

All of this lives in `src/lib/sms-consent-data.ts`. Each change updates `User.smsOptIn / smsPhone / smsConfirmedAt / smsConfirmRequestedAt` and writes an append-only `SmsConsentEvent` row in the same transaction. That row records the number, the action, the source, and the disclosure version shown at opt-in. It is the proof of consent if a carrier asks.

**Why double opt-in:** the profile phone is typed by the customer and never verified. Without the YES step, a mistyped number, or someone else's, would receive appointment details. The worst case now is one "Reply YES" text, which repeats at most once a minute and is behind the register rate limit.

**Staff can't opt anyone in.** Consent has to come from the customer. The admin customer page only shows the status. Walk-ins have no login, so they don't get texts.

### Sending

| Event | Text | Sent from |
|---|---|---|
| Booking (one-off) | confirmation | `sendBookingConfirmation()` |
| Standing appointment created | one summary text | `sendRecurringConfirmation()` |
| Reschedule (customer or admin) | new time | `sendRescheduleNotice()` |
| Cancellation (customer, admin, or time off) | cancelled | `sendCancellationNotice()` |
| Standing appointment cancelled | one text | `sendRecurringCancelledNotice()` |
| 24 h before | reminder | the hourly job |

The email functions in `src/lib/appointment-emails.ts` also call their text counterpart in `src/lib/appointment-sms.ts`. Every route that emails a customer about an appointment therefore texts them as well, and no route can forget. Receipts and gift-card notices are email only.

Texts are sent only when the customer has opted in and confirmed. Nothing is sent about a past appointment.

Each attempt is logged as an `SmsMessage` row. `POST /api/sms/status` (Twilio's status callback) later updates its `status` to delivered, undelivered or failed.

**Reminders** use their own claim column, `Appointment.smsReminderSentAt`, with the same claim-then-send pattern as the email reminder, so concurrent job runs can't double-send. A reschedule clears it. A confirmation or reschedule text sent within 24 h of the appointment counts as the reminder.

**Quiet hours:** texts the app sends on its own (reminders, and any "Reply YES" texts still owed) go out only from 8 AM to 9 PM salon time (`isWithinTextingHours()`). Texts that answer something the customer or staff just did are sent at once.

**Cost:** every message uses only the GSM-7 character set (`toGsm7()`). Intl's narrow no-break space before "AM" would otherwise switch a text to UCS-2 and roughly double its cost. Every message fits in one 160-character segment; the tests check this.

### Configuration (`src/lib/sms.ts`)

| `TWILIO_*` set? | Dev | Production |
|---|---|---|
| All three | sends | sends |
| Missing | prints `[sms:dev] would send` to the console | sends nothing, no error report. The hourly job reports `sms.skipped: "not_configured"`. |

Opt-ins made before texting is configured are kept. Their "Reply YES" texts go out on the first job run within texting hours after it is configured.

### Webhooks

`/api/sms/inbound` and `/api/sms/status` take Twilio's form-encoded POSTs and check `X-Twilio-Signature` (HMAC-SHA1 with `TWILIO_AUTH_TOKEN`, `src/lib/twilio-signature.ts`). An invalid signature gets `403`; a missing token gets `503`. `route-guards.test.ts` checks that the signature check is the first thing each handler awaits. Both routes are exempt from the JSON/Origin CSRF rule, since Twilio sends no cookies.

### Testing locally

Leave `TWILIO_*` empty. Tick the box on `/register` or My Account and watch the dev console for `[sms:dev] would send`. To simulate the YES reply, POST a correctly signed request to `/api/sms/inbound`: set `TWILIO_AUTH_TOKEN` to any test value and compute the signature with `twilioSignature()`. You can also set `smsConfirmedAt` on the test user directly. With `TWILIO_AUTH_TOKEN` set and the other two empty, sends still go to the console.

## 3. Before registering (the reviewers check the live site)

- [ ] Site deployed on the salon's own domain over HTTPS (runbook). Not a `workers.dev` address, not a login wall.
- [ ] `SALON_CONTACT` in `src/lib/site.ts` filled in. The name, address, phone and email on the site must match the brand registration exactly.
- [ ] `/privacy` and `/terms` finished and client-approved, with no "To be written" left.
  - Both pages are complete: the client's Termly text, the SMS sections corrected to match the app, and no placeholders. They're awaiting client and lawyer review; the comment at the top of each page lists what isn't Termly's wording.
  - The contact email was kept as a personal Yahoo address by choice. A reviewer may still ask for one on the salon's domain.
  - Keep both SMS sections as worded, especially the privacy sentences starting "No mobile information will be shared…".
- [ ] The opt-in box is visible on `https://<domain>/register`.
- [ ] `EMAIL_FROM` and the support email are on the salon's domain, not Gmail.

## 4. From the client (exact-match sensitive)

- Legal business name **exactly as on the IRS EIN letter (CP 575)**, not the storefront name. A mismatch is the most common rejection.
- EIN. If there's no EIN, the Sole Proprietor path applies instead (lower throughput; OTP to a real mobile).
- Business type (LLC, corporation, …), registered address, website.
- Authorized representative: name, title, email, phone.
- When the EIN was issued. Very new EINs can fail validation for a while.
- The client's agreement in writing to the monthly cost (roughly $8–15 at this volume; see `docs/PROJECT_HISTORY.md`, Roadmap item 13).

## 5. Twilio setup (in the **salon's** account)

The salon owner creates the account with their own email and card, and adds Eric as a user.

1. Buy a local number (631 area code).
2. Create a **Messaging Service** and add the number to its sender pool.
3. Messaging Service → Integration → **Incoming messages: send a webhook** to `https://<domain>/api/sms/inbound`, HTTP POST.
4. Messaging Service → **Advanced Opt-Out**: on. Set these replies (each under 160 GSM-7 characters):
   - **Opt-in keywords** (START, YES, UNSTOP). Reply:
     > Nail Image Inc.: You're signed up for appointment texts, about 2 messages per booking. Msg & data rates may apply. Reply HELP for help, STOP to opt out.
   - **Opt-out keywords** (STOP, …). Reply:
     > Nail Image Inc.: You're unsubscribed and won't get more texts. Reply START to resubscribe.
   - **Help keywords** (HELP, INFO). Reply, with the real phone and email:
     > Nail Image Inc. appointment texts. Help: call (631) 608-8009 or email <support email>. Msg & data rates may apply. Reply STOP to opt out.

     Use the support email the client settles on. The current one is a personal Yahoo address; see §3.
5. Copy the Account SID, Auth Token and Messaging Service SID for §7. The status callback needs no console setting; each send names it.

## 6. Registration (Twilio console → Messaging → Regulatory compliance)

**Brand:** the client details from §4.

**Campaign:**
- **Use case:** the standard use case for appointment confirmations and reminders. Customer Care or Account Notifications are the usual fits; read Twilio's current descriptions. **Not Marketing.**
- **Campaign description:**
  > Nail Image Inc., a nail salon in Amityville, NY, sends transactional texts to customers who opt in on our website: booking confirmations, a reminder about 24 hours before each appointment, and notices when an appointment is rescheduled or cancelled. No marketing or promotional messages.
- **How customers opt in (message flow / call to action):**
  > Customers opt in on our website, either when creating an account at https://<domain>/register (a public page) or later on their My Account page, by ticking an optional, unchecked checkbox labelled "Text me appointment confirmations and reminders from Nail Image Inc." Under it: "Optional. We'll text you once to confirm — reply YES. Then about 2 messages per booking, plus a text if one changes. Message and data rates may apply. Reply HELP for help or STOP to stop at any time. Consent isn't a condition of booking. US mobile numbers only. See our Terms and Privacy Policy," with links to https://<domain>/terms#sms and https://<domain>/privacy. Booking never requires opting in. After opting in, the customer receives one text asking them to reply YES, and messages start only after they do. Each opt-in is recorded with a timestamp, the number and the version of the wording shown.
- **Privacy policy URL:** `https://<domain>/privacy`. **Terms URL:** `https://<domain>/terms`.
- **Sample messages** (use 3–5):
  > Nail Image Inc.: You're booked with Libby Bent on Thu, Oct 22 at 10:00 AM. Manage: <domain>/appointments Reply STOP to opt out.

  > Nail Image Inc.: Reminder: Libby Bent, Thu, Oct 22 at 10:00 AM. To change: <domain>/appointments Reply STOP to opt out.

  > Nail Image Inc.: Your appointment with Libby Bent moved to Thu, Oct 22 at 10:00 AM. Details: <domain>/appointments Reply STOP to opt out.

  > Nail Image Inc.: Your Thu, Oct 22 at 10:00 AM appointment with Libby Bent is cancelled. Sorry! Call or book online for a new time. Reply STOP to opt out.

  > Nail Image Inc.: Reply YES to get appointment texts (about 2 messages per booking). Msg & data rates may apply. Reply HELP for help, STOP to opt out.
- **Message contents:** embedded links: **yes** (the salon's own domain, never a link shortener). Embedded phone numbers: no. Age-gated content: no. Direct lending: no.
- **Opt-in / opt-out / help keywords and messages:** as in §5 step 4.
- If a reviewer asks to see the opt-in on My Account (behind sign-in), host a screenshot on the salon's domain and give its URL.

Campaign review has taken 10–15 business days. Build and test against the console driver while you wait.

## 7. After approval

1. `wrangler secret put` `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_MESSAGING_SERVICE_SID` (runtime secrets, runbook §1).
2. Set `SALON_CONTACT.smsNumber` (the terms page shows it) and deploy.
3. Exclude `/api/sms/*` from Cloudflare Bot Fight Mode, managed challenges and the rate limits (runbook §4). A challenged Twilio request would silently drop STOP replies.
4. Live test on your own phone:
   1. Opt in: you get the "Reply YES" text.
   2. Reply YES: you get the confirmation, and My Account says "on".
   3. Book: you get the confirmation text.
   4. Reschedule, then cancel: you get one text each.
   5. Reply STOP: My Account says "off", and an `OPTED_OUT` event with source `sms_reply` is recorded.
   6. Book again: no text.
   7. Reply START: you're confirmed again.
   8. Check the `SmsMessage` rows reach `delivered`.

## 8. Known limitations

- US numbers only (`toUsE164()`). Landlines pass the format check but Twilio can't deliver to them; the status shows `undelivered`.
- No "reply C to confirm your appointment". Replies other than keywords are ignored, and nobody reads them in the app.
- A customer who replied STOP has to text START (or YES) to the salon's number to restart; ticking the box tells them so. That message names the number only once `SALON_CONTACT.smsNumber` is set.
- If someone unticks the box while stopped and later ticks it again, the "Reply YES" text is refused (21610) and the account goes back to stopped. Texting START fixes it.
- Gap 33 ("delete my account") must handle `SmsConsentEvent` and `SmsMessage` rows (both `RESTRICT`). Keep or anonymise the consent log as the retention policy says.
