# Free Hand — interactive prototype

**Free Hand** is a service for shoppers in malls. A shopper pays each store for their purchases as usual. Store staff link the paid receipt to the shopper's phone number. Free Hand then collects all the bags in one service order and delivers them to the shopper's **home** (via a delivery company) or to **their car in the mall parking**. The shopper pays only the Free Hand collection and delivery fees, and the order is confirmed after that payment.

The user interface is Arabic and right-to-left. On desktop the app is shown inside a phone frame; on a phone it fills the screen.

> Prototype scope: sign-in codes, payment (Apple Pay, mada/card) and shipping are **simulated**. No SMS is sent, no money is charged, no shipment is booked. See [Prototype limitations](#prototype-limitations).

---

## Run it

No build step and nothing to install. Any static file server works.

```bash
# from this folder
python -m http.server 8790 --bind 127.0.0.1
```

Open <http://127.0.0.1:8790/>.

- If the port is taken, use another one (`python -m http.server 8800 …`). Note that on Windows two servers can bind the same port, and the browser may reach the older one. If you see an old version of the app, pick a port nobody else is using.
- Alternatives: `npx serve .` or any IDE "live server".
- Opening `index.html` directly from the file system is not supported (browsers restrict storage and fonts for `file://`).
- Device location needs `localhost` / `127.0.0.1` or HTTPS, and the browser's permission.
- The map tiles (OpenStreetMap) and address lookup (Photon) need an internet connection. Everything else works offline, including saving a place without the map.

## Demo accounts

All demo credentials are also listed in **أدوات العرض** (demo tools): on desktop in the panel beside the phone, and on a phone from the landing page link «نسخة تجريبية · أدوات العرض» or from the account screens. Its «تعبئة» buttons fill the business sign-in form, and «مسح بيانات العرض» resets everything.

| Role | Sign-in | Password / code |
|---|---|---|
| Shopper (new) | any valid number starting with `05` (10 digits), e.g. `0551234567` | code `1234` |
| Shopper (returning demo, named «نورة») | `0500000000` | code `1234` |
| Mall management — مول الواجهة | `mall@example.com` | `Demo1234!` |
| Store — لين للأزياء | `store@example.com` | `Demo1234!` |
| Store — خطوة للأحذية | `shoes@example.com` | `Demo1234!` |
| Operations team — مول الواجهة | `ops@example.com` | `Demo1234!` |
| Delivery partner (all malls) | `delivery@example.com` | `Demo1234!` |
| Free Hand admin | `admin@example.com` | `Demo1234!` |

New mall and store accounts can be registered from the app; their passwords are stored salted and hashed (SHA-256) in the browser.

## Complete an order (receipts → payment → tracking)

1. Landing page → «دخول المتسوّق». Enter `0551234567` → «إرسال رمز التحقق» → code `1234`.
2. Choose «مول الواجهة».
3. Open the «المشتريات» tab → «إضافة فواتير تجريبية» (adds three paid demo receipts, marked «تجريبية»).
4. «اطلب جمع مشترياتي».
5. Choose a delivery place, or add one:
   - **Home**: tap the map to drop the pin (the street fills in when available), or use «استخدم موقعي الحالي», or type the city, district, street and building number. «حفظ المكان».
   - **Car**: choose the gate, level and space number (or drop a pin). «حفظ المكان».
   Saving takes you straight to review.
6. «المراجعة والدفع»: for home delivery pick a carrier (fee and ETA shown), pick Apple Pay or mada/card (both simulated), check purchases, fees and total → «ادفع …».
7. In the payment sheet: «تأكيد الدفع». To test failure use «للعرض: تجربة رفض الدفع», then «إعادة المحاولة». «إلغاء» keeps all choices.
8. The confirmation shows the order number and tracking. The «الطلبات» tab lists it.
9. To move the order forward: sign out, sign in as `ops@example.com` (or `delivery@example.com`), open the order, confirm each store pickup, then «تسليم الطلب إلى …» / «بدء التوصيل إلى السيارة», then confirm delivery. Sign back in as the shopper to see each status.

## Entry points by role

| Role | Start | Main screens |
|---|---|---|
| Shopper | «دخول المتسوّق» | المتاجر · المشتريات · الطلبات · الأماكن (tabs); mall chip and account in the top bar |
| Store | «حسابات الأعمال» → sign in | المتجر (receipts waiting for the courier) · إضافة فاتورة (link a paid receipt) · الملف |
| Store applicant | «حسابات الأعمال» → «انضمام متجر إلى مول» | application form → status (sign in with the application e-mail to see pending / rejected + reason, then edit & resubmit) |
| Mall management | «حسابات الأعمال» → sign in | لوحة المول (applications awaiting decision, stores, delivery options) · المتاجر · التوصيل · التسليم عند السيارة (gates & levels) |
| New mall | «حسابات الأعمال» → «تسجيل مول جديد» | registration → status until Free Hand approves (rejected → edit & resubmit) |
| Operations team | sign in as `ops@example.com` | مهام الجمع for its own mall → pickups → hand to carrier / deliver to car |
| Delivery partner | sign in as `delivery@example.com` | same task screens, all malls |
| Free Hand admin | sign in as `admin@example.com` | المولات: approve or reject mall registrations with a reason |

Who reviews what: **Free Hand admin** approves malls; **each mall's management** approves stores that apply to that mall. A store account cannot open its workspace until its mall approves it.

---

## What changed

### Design and brand
- **New logo**: a geometric "F" (stem + two bars) whose middle bar ends in a lime dot, the drop-off point. Readable at favicon size. No period after the name. Files in `assets/brand/`: `free-hand-icon.svg` (app icon), `free-hand-wordmark.svg`, `free-hand-mark-mono.svg`, `free-hand-wordmark-mono.svg`; favicon `assets/favicon.svg`. (`assets/free-hand-signature.svg` now holds the new mark so older references stay valid.)
- **One design system** in `design.css`: palette tokens (`#f7f7ef`, `#fffefa`, `#182e25`, `#20523e`, `#11392b`, `#e9f0e5`, `#e1edaa`), status colours, type scale (min 12px), spacing, radii, and all shared components. All text/background pairs are ≥ 4.5:1 contrast.
- **Numbers**: Western digits throughout. Previously Arabic-Indic digits next to «·» separators made `الرياض · ٤ متاجر` read as «٤٠ متاجر», and the pay button `· ٣١ ر.س` read as «٣١٠». Phone numbers, receipt numbers, order IDs, floors and dates are bidi-isolated so they keep their order inside Arabic text. Arabic counts are grammatical («فاتورة واحدة», «فاتورتان», «3 فواتير», «11 فاتورة»).
- **App shell**: tab screens show one compact top bar with the screen title, the **active mall chip** (tap to change) and account; sub-screens show a back header only. Toasts sit above the action bar. On phones the app uses the full screen, respects safe areas, shrinks with the on-screen keyboard (tabs hide, the focused field scrolls into view).
- **Landing**: headline «نجمع مشترياتك ونوصّلها لك», a three-step visual (pay in stores → we collect → your home or your car), shopper and business sign-in. «كيف تعمل الخدمة؟» is optional. The stock shopping-bag image and repeated cards were removed.
- **States**: inline field errors, loading buttons, empty states with a next step, success confirmations, a drop animation for the map pin and a check animation for successful payment. Motion is short and disabled under `prefers-reduced-motion`. All controls are buttons/links with accessible names; choices use `aria-pressed` / `role=radio`; status changes use `role=status` / `aria-live`.
- **Demo tools** moved out of the product UI (side panel on desktop, sheet on phones).

### Shopper journey
- Sign-in in two clear steps with inline validation; the phone screen explains that this number links receipts.
- **Stores**: active-order shortcut, a "pay → give your number → receipts appear" explainer showing the shopper's number, search and categories.
- **Purchases** (scoped to account + selected mall): paid receipts grouped by store, labelled «مدفوعة للمتجر» and «تجريبية» for demo ones. A summary separates **purchase value (already paid to stores)** from the **Free Hand fee**. «إضافة فواتير تجريبية» is the primary action for a new shopper; repeated taps add one set only. When unavailable (active order in this mall, or no active stores) the screen says why and offers «تتبّع الطلب» / «اختيار مول آخر». «رمز الربط الاحتياطي» is still available when phone linking fails.
- **Places tab** («الأماكن»): save a home address or a car spot before ordering; set the default per mall; edit or delete. Parking spots belong to a mall and show only there.
- **Place editor**: map tap drops the pin and starts the address lookup immediately; saving never waits for the lookup. Device location with clear permission/timeout messages. City list plus district / street / building / unit, optional national short address (format check only) and courier notes. Car spots use the mall's own gates and levels. Map failure shows a manual-entry message.
- **Checkout shortened to two steps**: place → review & pay (carrier choice moved into the review screen). One tap on a saved place goes to review; «إضافة مكان جديد» is always there.
- **Review & pay** shows delivery method and place, carrier (fee + ETA), purchases per store (marked as already paid), collection and delivery fees, total, and the simulated payment methods. The button names what is missing («اختر شركة التوصيل» / «اختر طريقة الدفع»).
- **Simulated payment sheet**: confirm → processing (cannot be dismissed) → success, or decline → failure with retry / change method. Cancel and failure keep every choice. The order is created **only after success**, once (repeated taps are ignored).
- **Tracking**: current status, «الخطوة التالية», «المطلوب منك», a timeline that differs for car delivery vs home shipping, carrier + ETA, the delivery place **as it was at checkout**, stores and fees.

### Business and operations
- **Business sign-in** separates: sign in · «تسجيل مول جديد» · «انضمام متجر إلى مول», and explains who reviews each. No credentials on the screen.
- **Store application**: approved malls only, required details and attachments, input (including chosen files) kept when going back. Status screen after sign-in shows the reviewer, status, rejection reason and next step; rejected applications can be **edited and resubmitted** (new attachments optional).
- **Mall dashboard**: applications awaiting decision first, then active stores, open orders, carriers, and the **car-delivery setup** (service point, gates, levels — used by the shopper's parking editor). Application review shows details, downloadable attachments, prior rejection, and requires a verification check / a reason.
- **Mall registration** status (reviewed by Free Hand), with edit & resubmit after rejection. Admin screen lists pending malls first.
- **Store receipt linking**: find the shopper by phone (format check), fallback code if no account, then receipt number / amount / bags with inline validation (format, 2 decimals, 1–25 bags, duplicates per store). A confirmation screen shows exactly which shopper got the receipt. The store home lists orders whose bags are waiting for the courier.
- **Operations login fixed** (`ops@example.com` could not sign in before). Operations see only their mall's orders, including after direct navigation; the delivery partner sees all malls. Each order shows «التالي: …» (who acts next); delivery completion asks for confirmation.

## Source map

The app is plain HTML/CSS/JS loaded in layers by `index.html`; later files override earlier screen definitions.

| File | Role now |
|---|---|
| `app.js` | Core: state, router, render, sheet/toast, helpers |
| `customer.js`, `partners.js`, `enterprise.js`, `studio.js`, `unified.js`, `journey.js` | Original prototype layers. Mostly superseded; kept for shared helpers and the hidden desktop studio. Routes they define that are not in the allow-lists are unreachable |
| `access.js` | Accounts, sessions, password hashing, route allow-lists per role |
| `visit.js` | Data model (malls, stores, carriers, receipts, orders), demo receipts guard, order creation |
| `visit-work.js` | Business actions: login dispatch, mall/admin/store/courier actions, supported routes per role |
| `mall-joining.js` | Store applications, attachments (IndexedDB), approval rules |
| `address-location.js` | Leaflet map, pin, device location, reverse address lookup |
| `saved-places.js` | Saved places storage (per account, per mall selection) |
| `design.js` | Focus management and nav highlighting |
| **`shell.js`** | New: formatting, plural counts, data migration, app bar, keyboard/safe areas, map fallback, demo tools |
| **`shopper.js`** | New: final shopper screens and the simulated payment flow |
| **`business.js`** | New: final business, admin and operations screens |
| **`design.css`** | Design system (last stylesheet) |

The original files are kept as received in `git` history (commit `Baseline: prototype as received`, branch `improvements` holds the changes) and as a full copy in `../free-hand-demo-original-baseline/` on the machine where this was built.

## Data, storage and migration

- Accounts, receipts, orders and malls: `sessionStorage` (per browser tab). Saved places: `localStorage` per shopper account. Store-application attachments: IndexedDB (`fh-join-documents`). No sync between devices.
- **Migration (schema 2)** runs automatically on load and is additive: carrier ETAs and service points switch to Western digits, malls get a `parkingConfig` (gates and levels). Orders gain optional fields (`collectionFee`, `carrierFee`, `carrierEta`, `invoiceTotal`, `paidAt`). Parking places gain an optional `level`. Older records stay valid: a home place saved as free text appears as «العنوان المحفوظ سابقًا» and is kept on save; an old parking «area» is kept and shown. Tested by creating data in the original prototype and opening it in this version.

## Dependencies

All bundled locally, no package install:
- Leaflet 1.9.4 (`assets/leaflet.*`, licence in `assets/LEAFLET-LICENSE.txt`), maps.
- Lucide 1.8.0 icons (`assets/lucide.min.js`, ISC).
- IBM Plex Sans Arabic (`assets/arabic-*.ttf`, `fonts.css`).

External services used at runtime (internet required): OpenStreetMap tiles for the map, Photon (komoot) for reverse address lookup. For production a licensed map/geocoding provider is needed.

## Prototype limitations

- Verification codes, payments and shipping are simulated. Carrier names, prices and ETAs are examples.
- Saudi National Address (SPL) lookup is **not connected**; the short-address field only checks the format.
- Tracking shows the statuses recorded by the operations/delivery accounts. There is **no live courier GPS tracking**.
- Device location needs browser support and permission; the map and manual entry work without it.
- Data lives in this browser (tab session / local storage). Business and shopper accounts in the same tab share one data set to simulate the back end; switching roles requires signing out.
- Mall registration attachments store file names only; store application attachments are stored in the browser and downloadable by the reviewing mall.

## Verification

Checked in Chromium (Playwright) against this build:

- New shopper (`0551234567`): invalid phone and wrong code errors, sign-in, mall choice, demo receipts (triple tap → 3 receipts, not 9), home delivery with map pin + manual fields, carrier choice, Apple Pay: cancel (no order, choices kept) → decline (failure, no order) → retry → success → exactly one order → confirmation and tracking.
- Second mall (مول الحدائق): demo receipts while mall 1 has an active order; car delivery entered manually (gate, level, space, note); mada payment; parking spot hidden at the other mall.
- Mall 1 purchases with an active order: demo receipts unavailable, reason and «تتبّع الطلب» shown.
- Editing a saved place after checkout does not change the confirmed order's address.
- Returning shopper in the same tab (orders restored) and `0500000000` («نورة»); receipts linked to one phone are invisible to another.
- Device location: denied/timeout message; granted (stubbed position) fills the street from Photon and keeps typed fields. Map tile failure and missing map library show the manual-entry fallback; saving without the map works.
- Operations: sees only مول الواجهة orders (direct navigation to another mall's order is refused), pickups, hand to carrier. Delivery partner: both malls, car delivery with confirmation sheet → delivered. Shopper tracking reflects each status.
- Store: role isolation (mall screens refused), unknown phone, invalid phone, invalid receipt number / amount / bags, duplicate receipt number, successful link with confirmation.
- Store application: back navigation keeps fields and files; pending status on sign-in; wrong password refused; mall rejects without reason (blocked) then with reason; applicant sees reason, edits, resubmits with new file; mall approves (verification check required); store signs in.
- Mall registration → pending status (mall screens locked) → admin approves → mall dashboard.
- Access after page reload: mall account refused admin, store, shopper, operations and delivery routes, and a forced route.
- Viewports 320×640, 375×667, 390×844, 430×932 and desktop 1366×900: no horizontal overflow on shopper and business screens; primary buttons visible; simulated keyboard (shortened viewport) keeps the field and button visible and hides tabs.
- Accessible names on all buttons/links and labels on all inputs on the main screens; colour contrast ≥ 4.5:1 for text tokens; reduced-motion preference disables animations.
- Data migration from the original prototype (see above).
- Console: no errors or warnings on normal use (errors appear only during the deliberate map-failure test).

Not verified: real iOS/Android devices and their actual on-screen keyboards, VoiceOver/TalkBack reading order, Safari and Firefox, a real browser location permission prompt (the automated browser cannot grant it), attachment migration across origins (IndexedDB format is unchanged).

## Screenshots

`docs/screenshots/` — main screens at 390×844 and the desktop preview (`00-desktop-preview.png`). `docs/screenshots/before/` — the same areas in the original prototype for comparison.
