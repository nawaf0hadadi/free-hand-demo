# Free Hand — interactive prototype

**Free Hand** collects purchases that shoppers have already paid for in stores inside a mall. The shopper pays each store as usual and gives the cashier their mobile number; the cashier links the paid receipt to the shopper's Free Hand account. The shopper then requests collection of all linked receipts in **one service order**, chooses delivery to their **home** or to **their car at the mall**, and pays the Free Hand collection and delivery fees. The order is confirmed only after that payment.

The interface is Arabic and right-to-left. On a phone it fills the screen; on desktop it is shown in a phone frame next to the demo tools.

> Prototype scope: verification codes, payments (Apple Pay, mada/card), shipping and receipt-barcode scanning are **simulated**. No SMS is sent, nothing is charged, no shipment is booked, no camera or point-of-sale system is used. See [Prototype limits](#prototype-limits).

---

## Run it

No build step and nothing to install.

```bash
# from this folder
python -m http.server 8790 --bind 127.0.0.1
```

Open <http://127.0.0.1:8790/>.

- Any static server works (`npx serve .`, an IDE live server). Opening `index.html` from the file system is not supported.
- If you see an older version of the app, another server is probably bound to the same port; pick a free port.
- Map tiles (OpenStreetMap) and address lookup (Photon) need internet. Everything else works offline, including saving a place without the map.
- Device location needs `localhost`/`127.0.0.1` or HTTPS and the browser's permission.

## Demo accounts (synthetic)

All details are also in **أدوات العرض** (demo tools): the panel beside the phone on desktop, or «نسخة تجريبية · أدوات العرض» on the landing page and «أدوات العرض» in each account screen on a phone. Its «تعبئة» buttons fill the business sign-in form; «مسح بيانات العرض» resets everything.

| Role | Sign-in | Password / code |
|---|---|---|
| New shopper | any 10-digit number starting with `05`, e.g. `0551234567` | code `1234`, then a first name |
| Seeded demo shopper «نورة» | `0500000000` (exists without signing up, so a cashier can find it) | code `1234` |
| Mall management — مول الواجهة | `mall@example.com` | `Demo1234!` |
| Store — لين للأزياء (مول الواجهة) | `store@example.com` | `Demo1234!` |
| Store — خطوة للأحذية (مول الواجهة) | `shoes@example.com` | `Demo1234!` |
| Operations team — مول الواجهة | `ops@example.com` | `Demo1234!` |
| Delivery partner (all malls) | `delivery@example.com` | `Demo1234!` |
| Free Hand admin | `admin@example.com` | `Demo1234!` |

Password recovery uses the simulated code `1234`. Accounts created in the app store salted SHA-256 password hashes in the browser.

## Cashier → shopper walkthrough (reproducible)

All roles share one browser tab, so switching roles means signing out and in again; the data stays.

1. **Shopper:** landing → «دخول المتسوّق» → `0551234567` → «إرسال رمز التحقق» → code `1234` → first name «سارة» → «مول الواجهة». The Stores screen shows the number to give the cashier; Purchases explains the four linking steps.
2. Sign out: avatar (top bar) → «تسجيل الخروج».
3. **Cashier:** landing → «حسابات الأعمال» → `store@example.com` / `Demo1234!` → «ربط فاتورة».
4. Enter `0551234567` → «البحث عن العميل». The match card shows **سارة · ••••••4567**. Ask the shopper to confirm, then «نعم، هذا العميل».
5. Enter receipt `LN-30215`, amount `420.00`, bags `2` (or «تعبئة تجريبية من باركود الفاتورة», which fills receipt data only) → «ربط الفاتورة بحساب سارة». The confirmation shows the masked destination, mall and receipt reference; «ربط فاتورة أخرى» or «الفواتير المرتبطة».
6. Sign out («الحساب» → «تسجيل الخروج»), then sign in as the shopper with `0551234567` / `1234`.
7. **Shopper:** «المشتريات» shows LN-30215 under لين للأزياء, paid 420.00 ر.س, «ربطها الكاشير», «جاهزة للجمع». → «اطلب جمع مشترياتي» → add a home address or car spot → review → carrier + payment method → «ادفع …» → «تأكيد الدفع» → order confirmation and tracking.
8. Optional: sign in as `ops@example.com` (or `delivery@example.com`), open the order, confirm the store pickup, hand to the carrier / start car delivery, confirm delivery; the shopper's tracking follows each step. The store's home screen lists the order under «جهّزها للمندوب» until pickup.

Edge cases you can try on the cashier screen: an unregistered number (guidance to correct it or have the shopper sign in and choose the mall; the receipt draft is kept), editing the number after a match (the match is cleared), submitting before confirming, linking the same receipt number twice (refused per store), the shopper's fallback code from «اعرض رمزك الاحتياطي» (must match this mall's visit; a blank or unknown code never matches), a different shopper (`0500000000`), and another mall (receipts stay in the store's mall).

**Without a cashier:** Purchases → «إضافة فواتير تجريبية» adds paid demo receipts marked «تجريبية».

## Role entry points

| Role | Start | What they do | Reviewed by |
|---|---|---|---|
| Shopper | «دخول المتسوّق» | Stores · Purchases · Orders · Places; mall chip and account in the top bar | — |
| Store staff | «حسابات الأعمال» → sign in | Link paid receipts, see receipts waiting for the courier, store profile | — |
| Store applicant | «حسابات الأعمال» → «انضمام متجر إلى مول» | Apply; sign in with the application e-mail to see pending / rejected + reason; edit and resubmit | The chosen mall's management |
| Mall manager | «حسابات الأعمال» → sign in | Applications awaiting decision, stores, home-delivery carriers, car-delivery gates and levels, live orders | — |
| New mall | «حسابات الأعمال» → «تسجيل مول جديد» | Register; status screen until approved; edit and resubmit after rejection | Free Hand admin |
| Free Hand admin | sign in as `admin@example.com` | Mall queue: inspect details and documents, approve, or reject with a reason | — |
| Operations team | sign in as `ops@example.com` | Collection tasks for its own mall: store pickups, hand to carrier, car delivery | — |
| Delivery partner | sign in as `delivery@example.com` | Same task screens for every mall | — |

Pending and rejected accounts see only their application status. Operational screens open after approval.

## Permissions and data

- **Routes** are allowed per role (`access.js`, `visit-work.js`). **Action and form handlers** also check the signed-in role and approval state (`business.js`, «Role guards»), so a stale button or a direct call does nothing outside the account's scope. Mall managers only see and decide their own mall's applications; operations staff only their mall's orders; store staff only their store's receipts; shoppers only their own receipts for the selected mall.
- A stored session must match a stored account with the same role; an edited role signs the session out on the next load.
- **These checks run in the browser only.** In the full build every rule must be enforced on the server, with server-side sessions, password hashing, file storage and audit logs.
- Storage: accounts, receipts, orders, malls and stores live in `sessionStorage` for the current tab (closing the tab clears them); saved places in `localStorage` per shopper; store and mall attachments in IndexedDB (`fh-join-documents`). Nothing syncs between devices or browsers.
- Passwords never enter drafts, saved state, logs or screenshots; password fields support password managers (`autocomplete`) and a show/hide button.
- Data migration (schema 2) is additive and runs on load; data saved by earlier versions keeps working.

## What changed in this update

- **Brand:** a new mark — two cupped hands holding a parcel ("we carry it; your hands are free") — replaces the F-with-dot. It reads from 16 to 96 px; candidates and the comparison are in `docs/brand/exploration.html` and `docs/brand/*.png`. Assets: `assets/brand/free-hand-icon.svg` (app icon), `free-hand-mark.svg`, `free-hand-mark-mono.svg`, `free-hand-wordmark.svg`, `free-hand-wordmark-mono.svg`, favicon `assets/favicon.svg`. The mark identifies the brand only; workflow steps use workflow icons.
- **Landing:** the blank band above the headline came from `margin-top: auto` on the headline; content now starts at the top and only the sign-in actions settle at the bottom when there is spare height. Order: promise → home or car → what it costs → shopper sign-in → business accounts. The process card that repeated the brand mark was removed; the full steps live in «كيف تعمل؟» and the first Purchases screen.
- **Receipt linking:** the shopper guidance now says what the cashier does (find by number, confirm name and last four digits, link) and how the result appears (Purchases, ready to collect, no scanning). New shoppers give a first name so the cashier has something to confirm. The cashier screen is one focused screen with a progress indicator: number → confirm match → receipt; editing the number clears a stale match; the draft survives an unmatched number; duplicate receipt numbers are refused per store; double taps link once. The fallback shopper code is real (per mall visit) and the old shortcut that matched a blank code to a default shopper is gone. Receipt barcode scanning is a labelled demo fill only.
- **Purchases:** each receipt shows store, floor, reference, paid amount, source («ربطها الكاشير» or «تجريبية») and whether it is ready to collect.
- **Onboarding:** business sign-in separates sign in · register a mall · apply as a store, with the reviewer named. Forms list what you need first, mark optional fields, validate every field inline (errors beside the field, typed values and chosen files kept), and every password flow asks for confirmation (mall registration, store application, store account created by a mall, password recovery, password change). «نسيت كلمة المرور؟» and «تغيير كلمة المرور» were added.
- **Admin:** queue split into awaiting decision / rejected awaiting the mall / approved; mall documents are now stored and downloadable; rejecting requires a reason shown to the mall; resubmissions are marked.
- **Consistency:** shared components across sign-in, forms, empty states, dashboards, status and confirmation screens; clearer tab labels per role; 44 px tap targets for checkboxes; amounts with fractions show two decimals.

The previous version is kept as git tag `v2-before-final-update` and as the folder `free-hand-demo-v2-baseline` next to this one; the original prototype is commit `fa1dd1f` and the folder `free-hand-demo-original-baseline`.

## Source map

`index.html` loads layers in order; later files override earlier screens and handlers.

| File | Role |
|---|---|
| `app.js` | Core state, router, render, sheets, toasts |
| `customer.js`, `partners.js`, `enterprise.js`, `studio.js`, `unified.js`, `journey.js` | Original layers, mostly superseded; kept for shared helpers |
| `access.js` | Accounts, sessions, password hashing, route allow-lists |
| `visit.js` | Data model, demo receipts, order creation |
| `visit-work.js` | Business actions (mall, admin, store, courier), supported routes per role |
| `mall-joining.js` | Store applications, attachments, mall approval rules |
| `address-location.js`, `saved-places.js` | Map, device location, address lookup, saved places |
| `design.js` | Focus management, nav highlighting |
| `shell.js` | Formatting, Arabic counts, migration, app bar, keyboard/safe areas, inline field errors, password rules, demo tools |
| `shopper.js` | Shopper screens, linking guidance, fallback code, checkout, simulated payment, tracking |
| `business.js` | Business sign-in, onboarding, recovery, admin, mall, cashier linking, operations, role guards |
| `design.css` | Design system (last stylesheet) |

Dependencies are bundled locally: Leaflet 1.9.4, Lucide 1.8.0, IBM Plex Sans Arabic. External services at runtime: OpenStreetMap tiles, Photon reverse geocoding.

## Verification (run in Chromium via Playwright on this build)

- **Cashier → shopper handoff through the normal screens:** new shopper with name step and mall choice → store sign-in → unmatched number (guidance shown, draft kept) → submit without match (blocked) → fallback code blank / wrong / correct (candidate needs confirmation) → editing the number clears the candidate and keeps focus → match «سارة ••••••4567» → submit before confirming (blocked) → confirm → editing after confirmation clears it → double-tap link (one receipt) → confirmation → same receipt number again, any case (refused) → receipt for a different shopper (`0500000000`) → shopper sees only her receipt, only in مول الواجهة (not in مول الحدائق, not Nora's) → order from the linked receipt with home delivery, carrier, mada, decline then retry (one order) → store sees it under «جهّزها للمندوب» → operations pickup and hand to carrier → delivery partner confirms → shopper tracking «تم التسليم».
- **Shopper regressions:** demo receipts (double tap adds one set), car spot saved from Places with mall-specific gates and level, saved place in one tap at checkout, Apple Pay cancel keeps choices, single car order, map pin with Photon street fill, saving with manual fields.
- **Mall registration:** empty submit (errors on all required fields), password mismatch (error beside the confirmation field; typed values, password and chosen file kept), error clears when typing, success → pending status with document; pending mall refused on dashboard routes and on a direct carrier action.
- **Admin:** sign-in from the business screen and after page refresh, queue, review with document download (file content verified), reject without reason (blocked) and with reason, applicant sees the reason and resubmits with a new file, review marks the resubmission, approve, mall dashboard opens.
- **Store application:** invalid fields (duplicate store name in the mall, short commercial registration, wrong file type, missing file, e-mail already used, weak password, missing confirmation tick), success, pending sign-in shows status, pending store refused on a direct action, a manager from another approved mall cannot see or approve it, the right mall approves, the store signs in.
- **Passwords:** change with mismatch / wrong current / success (old password refused, new accepted); recovery with wrong code / mismatch / success for `shoes@example.com`; other demo accounts still sign in with `Demo1234!`; no password value in drafts or saved state.
- **Unauthorized attempts:** store, mall manager, shopper and signed-out users calling the mall approve/reject handlers directly (no change), admin routes from each role (redirected), self-registration as admin (refused), tampered stored session role (signed out on reload).
- **Layout:** 320×568 and 320×640 (landing headline and both sign-in buttons on the first screen), 390×844, 430×932, desktop 1366×900; no horizontal overflow on every new or changed screen at 320 px; all buttons and links have accessible names; all inputs have labels; tap targets ≥ 36 px (checkbox rows 44 px).
- **Console and assets:** no errors or warnings during the runs above; every referenced local file returns 200; every icon name exists in the bundled Lucide.

Not verified: real phones and their keyboards, VoiceOver/TalkBack, Safari and Firefox, a real location-permission prompt (a granted position was stubbed in the previous pass), and data shared between tabs or devices (not supported by design).

## Prototype limits

- Sign-in codes, payments, shipping, receipt-barcode scanning and the fallback code are simulated; no SMS, camera, payment gateway or point-of-sale integration.
- Saudi National Address lookup is not connected (format check only); there is no live courier location tracking — tracking shows the steps recorded by staff accounts.
- Carrier names, prices and ETAs are examples.
- All permissions are enforced in the browser only; the full build needs server-side enforcement.
- Data lives in this browser tab (and saved places in this browser); all roles share one demo data set to simulate the back end.

## Screenshots

`docs/screenshots/` (390×844 unless noted):
`00-desktop-preview` · `01-landing` · `02-landing-320x568` · `03-shopper-name` · `04-stores-linking-card` · `05-purchases-before-linking` · `06-cashier-confirm-shopper` · `07-cashier-receipt` · `08-cashier-linked` · `09-shopper-receipt-linked` · `10-business-sign-in` · `11-store-application-password-mismatch` · `12-store-application-sent` · `13-mall-registration-status` · `14-admin-queue` · `15-admin-mall-review` · `16-mall-dashboard`. `docs/screenshots/before/` shows the original prototype for comparison.
