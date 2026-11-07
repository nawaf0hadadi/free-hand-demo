# Free Hand | يد متحررة — interactive prototype

**Free Hand** lets shoppers shop a participating mall hands-free. The shopper pays each store as usual; the cashier links the paid receipt and its bags to the shopper's account. Linked purchases from any number of stores appear together in the shopper's **Purchases**. When ready, the shopper selects what to collect, chooses delivery to their **home** or to **their car at the mall**, pays the Free Hand collection and delivery fees, and tracks collection and handover until delivery.

The interface is Arabic and right-to-left. On a phone it fills the screen; on desktop it is shown in a phone frame.

> Prototype scope: sign-in codes, payments (Apple Pay, mada/card), shipping and the receipt-barcode fill are **simulated**. No SMS is sent, nothing is charged, no shipment is booked, no point-of-sale system is connected. The shopper QR code and its scanning are real (see below). Data lives in this browser only. See [Limits](#limits).

---

## Run it

No build step and nothing to install.

```bash
# from this folder
python -m http.server 8790 --bind 127.0.0.1
```

Open <http://127.0.0.1:8790/>. Any static server works (`npx serve .`). Opening `index.html` from the file system is not supported. If an old version appears, another server is using the port — choose a free one.

**Self-test:** open <http://127.0.0.1:8790/?selftest=run>. It clears this browser's demo data, then drives the real screens through every role (≈80 checks, about one minute) and shows PASS/FAIL in a panel. Source: `tests/selftest.js`.

## Demo accounts (synthetic)

Also listed in **أدوات العرض** (demo tools): the button in the bottom corner on desktop, or «نسخة تجريبية · أدوات العرض» on the landing page and in each account screen.

| Role | Sign-in | Password / code |
|---|---|---|
| New shopper | any 10-digit number starting with `05` | code `1234`, then first name (last name optional) |
| Seeded demo shopper «نورة» | `0500000000` | code `1234` |
| Mall management — مول الواجهة | `mall@example.com` | `Demo1234!` |
| Store — لين للأزياء | `store@example.com` | `Demo1234!` |
| Store — خطوة للأحذية | `shoes@example.com` | `Demo1234!` |
| Operations team — مول الواجهة | `ops@example.com` | `Demo1234!` |
| Delivery partner (all malls) | `delivery@example.com` | `Demo1234!` |
| Free Hand admin | `admin@example.com` | `Demo1234!` |

## Walkthrough: purchase → link → collect → deliver

All roles share one browser tab; switch roles by signing out and in. Data stays.

1. **Shopper:** landing → «ابدأ الآن» → `0551234567` → code `1234` → first name «سارة» → «مول الواجهة». Home greets the shopper and shows the next step.
2. Tap **«رمزي»** (top bar). A real QR code and a short code (e.g. `7K3M-Q9XA`) appear, valid 10 minutes. Note the short code, or «حفظ صورة الرمز» to save the QR image. Sign out (avatar → «تسجيل الخروج»).
3. **Cashier:** «دخول حسابات الأعمال» → `store@example.com` / `Demo1234!` → «ربط فاتورة مدفوعة».
4. Identify the shopper: «مسح رمز العميل» (camera, or «اختيار صورة الرمز» with the saved image), or type the short code → «تحقق من الرمز». If the shopper has no code: «البحث برقم الجوال». The match card shows **سارة ا.** — confirm with «نعم، هذا العميل».
5. Enter receipt number, amount paid, bag count, optional item description; leave «الأكياس جاهزة للجمع الآن» ticked (or untick if bags are still being prepared) → «ربط الفاتورة». The confirmation shows the masked destination and receipt reference.
6. Sign out, sign in as the shopper. **Purchases** lists the receipt under its store with items, bags and «جاهزة للجمع». Untick any receipt to keep it for later → «اطلب جمع …».
7. Choose or add a delivery place (home address via map/device location/manual fields, or car spot with the mall's gates and levels) → review → carrier (home) → payment method (simulated) → «ادفع» → confirm. Tracking opens with the order number.
8. **Store** (`store@example.com`): home shows the order under «جهّزها للمندوب» → «سلّمت الأكياس للمندوب».
9. **Operations** (`ops@example.com`): open the task → «استلام المهمة» → «تأكيد الاستلام» per store with the counted bags (a lower count needs a note and is recorded as a shortfall) → «بدء التوصيل إلى السيارة» or «تسليم الطلب إلى …».
10. **Delivery** (`delivery@example.com`): «تأكيد التسليم», or «تعذّر التسليم» with a reason → «إعادة محاولة التسليم». The shopper's tracking shows each state, any store note, and what (if anything) they need to do.

Without a cashier, a shopper can use «إضافة فواتير تجريبية» on Purchases (marked «تجريبية»).

## Roles and responsibilities

| Role | Entry | Main work |
|---|---|---|
| Shopper | «ابدأ الآن» | Home (state-aware), Purchases (select receipts), Orders/tracking, Places; «رمزي» in the top bar; cancel an order before the first pickup |
| Store staff | business sign-in | Link paid receipts by QR/code or number; mark bags ready; hand bags to the collector; linked receipts list |
| Store applicant | «دخول حسابات الأعمال» → «انضمام متجر إلى مول» | Apply; see pending / rejected + reason; edit and resubmit |
| Mall manager | business sign-in | Applications awaiting decision, operational alerts, stores, carriers, car-delivery gates and levels, live orders |
| New mall | «تسجيل مول جديد» | Register; status until Free Hand approves; edit and resubmit after rejection |
| Free Hand admin | `admin@example.com` | Mall queue: inspect, download documents, approve or reject with a reason |
| Operations | `ops@example.com` | Own mall's tasks: assign, confirm pickups with bag counts, report issues, start car delivery or hand to carrier |
| Delivery partner | `delivery@example.com` | All malls: deliveries first; confirm delivery or record a failed attempt and retry |

## Shopper QR code

- The QR encodes only `FH1:<8-character code>` — no name, number or account id. The code is tied to one shopper and one mall, expires after 10 minutes, refreshes automatically on screen, and is **consumed** when a store links a receipt with it, so a captured code cannot be replayed. Blank, unknown, used, expired or other-mall codes are refused with a specific message.
- Scanning uses the browser's built-in `BarcodeDetector` where available, otherwise **jsQR** (loaded only when the scanner opens). Camera needs permission; «اختيار صورة الرمز» reads a saved image; typing the short code always works; the registered mobile number is the fallback.
- A receipt barcode never identifies the shopper; «تعبئة تجريبية من باركود الفاتورة» only fills demo receipt data.

## Bag custody and exceptions

Store marks bags ready → store hands over → collector confirms the received count → car delivery or carrier → delivered. Recorded exceptions: bags not ready, missing bags / count shortfall, damaged bag, other note (per store, resolvable), failed delivery with reason and retry, cancellation by the shopper before the first pickup (receipts return to Purchases; the fee refund is simulated). Mall managers see open exceptions under «تنبيهات تشغيلية».

## Privacy and permissions

- The shopper's phone number is not shown on the home, Purchases or other general screens. It appears masked in the account screen («إظهار» reveals it) and masked to the cashier only when the number fallback is used. The cashier sees the first name and last-name initial.
- Routes are allowed per role; every sensitive action and form handler also checks the signed-in role and approval state, and a session whose role does not match its stored account is signed out. Mall managers see only their mall; operations staff only their mall's orders; stores only their receipts; shoppers only their own receipts per mall.
- **All of this runs in the browser.** A production build needs server-side enforcement, server sessions, audit logs, data-retention rules and a review against the Saudi PDPL (and ZATCA requirements for invoices if Free Hand issues them). No compliance is claimed for this prototype.

## What changed in this refinement (and what was kept)

Kept unchanged: the brand palette and tokens (verified identical to the previous version), the Free Hand mark, the phone-frame preview, checkout and simulated payment, saved places and the map, tracking, onboarding, admin approvals, role guards, data formats (additions only).

Changed:
- **Landing:** content starts at the top and the shopper action follows it; business access is a quiet link instead of a second large button; no internal role list.
- **Sign-in:** one short flow (number → code → first/last name); extra instructional text removed; the OTP screen shows only the last four digits.
- **Home:** greeting by first name and a card that follows the shopper's state (start → receipts ready → collection in progress → recent delivery).
- **Shopper QR:** real QR + short code with expiry, auto-refresh, single use and no personal data; «رمزي» in the top bar.
- **Purchases:** receipts grouped by store with location, reference, items, bag count, readiness and source; tick/untick receipts; the order includes only the selected ready receipts; receipts that become ready later are selected by default.
- **Post-purchase guidance:** a compact three-step sequence (pay → show your code → appears in Purchases) where it is needed; full details stay in «كيف تعمل؟».
- **Store:** QR-first identification with number fallback, optional item description, bags-ready flag, «الأكياس جاهزة», «سلّمت الأكياس للمندوب».
- **Operations and delivery:** staff wording instead of shopper wording; task cards show source stores with locations, bags, assignee, status icon and next action; assignment; pickup with bag count; issue reports; failed delivery and retry; different emphasis for collection vs delivery staff.
- **Mall:** operational alerts.
- **Fixes found along the way:** the shopper app bar could push the account button off-screen at 320 px; a receipt selection could leave nothing selected after more bags became ready; a pending match error could be invisible; inline links inside callouts had button height; Arabic dual forms after prepositions («من متجرين»); amounts with fractions show two decimals.

Previous versions: git tag `v3-before-refinement` and folder `free-hand-demo-v3-baseline` (this refinement's baseline), tag `v2-before-final-update`, folder `free-hand-demo-v2-baseline`, original commit `fa1dd1f` and folder `free-hand-demo-original-baseline`. Work is on branch `refinement`.

## Source map

| File | Role |
|---|---|
| `app.js` … `journey.js` | Core router/render and original layers (mostly superseded, kept for shared helpers) |
| `access.js` | Accounts, sessions, password hashing, route allow-lists |
| `visit.js` | Data model, demo receipts, order creation (only selected, ready receipts) |
| `visit-work.js`, `mall-joining.js` | Business actions, approvals, attachments |
| `address-location.js`, `saved-places.js` | Map, device location, address lookup, saved places |
| `shell.js` | Formatting, Arabic counts, migration, shopper pass (QR), app bar, inline errors, demo tools, self-test loader |
| `shopper.js` | Shopper screens: landing, sign-in, home, QR, Purchases, checkout, payment, tracking, cancellation, account |
| `business.js` | Business sign-in, onboarding, admin, mall, cashier linking and scanning, store handover, operations and delivery, role guards |
| `design.css` | Design system (tokens unchanged) |
| `tests/selftest.js` | Browser self-test (`?selftest=run`) |

## Dependencies

Bundled locally, no install: Leaflet 1.9.4 (maps), Lucide 1.8.0 (icons), IBM Plex Sans Arabic (font), **qrcode-generator 1.4.4** (MIT, draws the shopper QR) and **jsQR 1.4.0** (Apache-2.0, decodes QR when the browser has no `BarcodeDetector`; loaded only by the cashier scanner). Licences and checksums: `assets/LEAFLET-LICENSE.txt`, `assets/THIRD-PARTY-QR.txt`. Runtime services (internet): OpenStreetMap tiles and Photon reverse geocoding.

## Verification

- **Self-test** (`?selftest=run`, Chromium via Playwright): **79 / 79 passed**, no console errors. Covers landing, sign-up with validation, privacy (no phone on home/Purchases), QR pass (real QR, payload without personal data, 10-minute expiry), cashier linking by code (blank/unknown/used/expired/other-mall codes refused, confirmation required, draft kept, single use), number fallback (unknown number guidance, edit clears match, duplicate receipt refused, not-ready bags), QR decoded from an image of the shopper's code, item details, selection and partial ordering, payment decline then retry with one order, store ready and handover, operations assignment and pickup with shortfall note, delivery failure blocking completion, shopper tracking of reschedule and shortfall, retry and delivery, cancellation returning receipts, role guards and shopper isolation, onboarding password mismatch, home delivery with carrier, mall registration and admin approval with document download, store application and mall approval, password recovery.
- **Layout:** 320 px (effective 291 px) shopper, store, operations, delivery, mall and admin screens — no horizontal overflow, accessible names on all buttons and links, labels on all inputs; 390×844; tablet 768×1024; desktop 1366×900. Brand tokens diffed against the baseline: identical.
- **Assets:** no broken images and no unrendered icons on any audited screen.

Not verified: real phones, real camera scanning on a device (the image path and the decoder were verified), screen readers, Safari/Firefox, cross-device use (not supported — data is per browser tab).

## Limits

- Codes, payment, shipping and the receipt-barcode fill are simulated; no SMS, payment gateway, POS or carrier integration.
- Data is per browser tab (saved places per browser); the cashier and shopper must use the same tab in this prototype, so scanning a QR shown on another device cannot find that shopper.
- No National Address lookup; no live courier location; tracking shows the steps staff record.
- Changing the phone number is not available (it needs re-verification).
- Permissions are enforced in the browser only.

## Screenshots

`docs/screenshots/` (390×844 unless noted): `00-desktop-preview`, `01-landing`, `02-sign-in`, `03-name`, `04-home-start`, `05-my-code`, `06-cashier-identify`, `07-cashier-confirm`, `08-cashier-linked`, `09-purchases`, `10-ops-tasks`, `11-ops-pickup-count`, `12-delivery-exception`, `13-tracking-exception`, `14-mall-alerts`, `selftest-result`. Before this refinement: `docs/screenshots/before-refinement/`; original prototype: `docs/screenshots/before/`.
