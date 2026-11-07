/* Free Hand self-test — open the app with ?selftest=run
   Drives the real screens and handlers through every role and reports PASS/FAIL.
   It CLEARS this browser's demo data first (session storage, saved places, attachments).
   Results: on-screen panel and window.__selftest = { passed, failed, results }. */
(async () => {
  'use strict';
  const F = window.FH, A = F.Access, V = F.Visit, UI = F.UI;
  const results = [];
  const errors = [];
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError(...a); };
  window.addEventListener('error', e => errors.push(e.message));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const $ = s => document.querySelector(s);
  const text = () => $('#app-screen').innerText;
  const sheet = () => $('#app-overlay').hidden ? '' : $('#app-overlay').innerText;
  const toast = () => $('#app-toast').hidden ? '' : $('#app-toast').textContent;
  const act = async (action, id, ms = 150) => {
    const el = [...document.querySelectorAll(`#phone-app [data-action="${action}"]` + (id != null ? `[data-id="${id}"]` : ''))].find(e => !e.disabled);
    if (!el) throw new Error(`no button ${action}${id != null ? ':' + id : ''} on ${F.s.route}`);
    el.click(); await wait(ms);
  };
  const fill = (name, value) => {
    const el = $(`#phone-app [name="${name}"]`);
    if (!el) throw new Error(`no field ${name} on ${F.s.route}`);
    el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const submit = async (ms = 900, scope = '#app-cta') => { $(`${scope} button[type=submit]`).click(); await wait(ms); };
  const fieldError = name => $(`#err-${name}`)?.innerText || $(`#f-${name}-error`)?.innerText || '';
  const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) });
  const step = async (name, fn) => { try { await fn(); } catch (e) { results.push({ name, ok: false, detail: e.message }); } };
  const signOut = async () => { if (A.session) { A.logout(); await wait(150); } };
  const shopper = async (phone, first, last = '') => {
    await signOut(); F.go('login'); await wait(120);
    fill('customer-phone', phone); await submit(800);
    fill('customer-code', '1234'); await submit(900);
    if (F.s.route === 'auth-customer-name') { fill('customer-name', first); if (last) fill('customer-last-name', last); await submit(500); }
  };
  const business = async (email, password = 'Demo1234!') => {
    await signOut(); F.go('auth-role-login'); await wait(120);
    fill('email', email); fill('password', password); await submit(1200);
  };
  const linkByCode = async (code, number, amount, bags, opts = {}) => {
    await act('visit-merchant-start');
    fill('invoice-code', code); await act('fh-code-match');
    await act('fh-confirm-shopper');
    fill('invoice-number', number); fill('invoice-amount', amount); fill('invoice-bags', bags);
    if (opts.items) fill('invoice-items', opts.items);
    if (opts.notReady) $('[name="invoice-ready"]').click();
    await submit(900);
  };

  // Fresh, isolated demo data: clear, reload once, then run on the clean state.
  if (!sessionStorage.getItem('fh-selftest-reloaded')) {
    sessionStorage.clear();
    Object.keys(localStorage).filter(k => k.startsWith('fh-')).forEach(k => localStorage.removeItem(k));
    try { indexedDB.deleteDatabase('fh-join-documents'); } catch {}
    sessionStorage.setItem('fh-selftest-reloaded', '1');
    location.reload();
    return;
  }
  sessionStorage.removeItem('fh-selftest-reloaded');
  await wait(300);
  const PHONE = '0551234567', OTHER = '0567770000';

  await step('Landing', async () => {
    check('Landing: one primary shopper action', $('.fh-landing-actions .fh-primary'));
    check('Landing: business access is a quiet link, not a second big button', $('.fh-landing-business .a-link') && !$('.fh-landing .fh-secondary'));
    const h1 = $('.fh-landing-hero h1').getBoundingClientRect(), top = $('#phone-app').getBoundingClientRect().top;
    check('Landing: headline starts near the top', h1.top - top < 220, Math.round(h1.top - top) + 'px');
  });

  await step('Shopper sign-up', async () => {
    F.go('login'); await wait(120);
    fill('customer-phone', '12345'); await submit(250);
    check('Sign-in: invalid number shows an inline error', fieldError('customer-phone').includes('05'), fieldError('customer-phone'));
    fill('customer-phone', PHONE); await submit(800);
    check('Sign-in: OTP screen masks the number', F.s.route === 'otp' && !text().includes(PHONE) && text().includes('4567'));
    fill('customer-code', '9999'); await submit(250);
    check('Sign-in: wrong code is refused', F.s.route === 'otp' && fieldError('customer-code'));
    fill('customer-code', '1234'); await submit(900);
    check('Sign-up: new shopper is asked for a name', F.s.route === 'auth-customer-name');
    await submit(250);
    check('Sign-up: first name is required', fieldError('customer-name'));
    fill('customer-name', 'سارة'); fill('customer-last-name', 'العتيبي'); await submit(500);
    check('Sign-up: last name saved (optional field)', F.s.lastName === 'العتيبي' && A.model.records['customer:' + PHONE].lastName === 'العتيبي');
    await act('visit-select-mall', 'front');
    check('Home: greets by first name', text().includes('أهلًا سارة'));
    check('Home: start state shows the QR action', $('#app-screen [data-action="fh-my-code"]'));
    check('Privacy: phone number not shown on home', !/05\d[\s\d]{7,}/.test(text() + $('#u-appbar').innerText));
    F.go('bags'); await wait(150);
    check('Privacy: phone number not shown on Purchases', !/05\d[\s\d]{7,}/.test(text()));
  });

  let code = '';
  await step('Shopper QR pass', async () => {
    await act('fh-my-code', null, 300);
    const pass = UI.pass.current(PHONE, 'front');
    code = pass?.code;
    check('QR: a real QR is drawn', $('.fh-pass-qr svg'));
    check('QR: payload carries no personal data', UI.pass.payload(code) === 'FH1:' + code && !UI.pass.payload(code).includes('4567'));
    check('QR: expires after 10 minutes', Math.round((pass.expiresAt - pass.issuedAt) / 60000) === 10);
    check('QR: short code shown for manual entry', sheet().includes(UI.pass.format(code)));
    F.closeSheet();
  });

  await step('Cashier links by code', async () => {
    await business('store@example.com');
    await act('visit-merchant-start');
    await act('fh-code-match');
    check('Cashier: blank code never matches', fieldError('invoice-code') && !V.invoice.candidate);
    fill('invoice-code', 'ZZZZ-ZZZZ'); await act('fh-code-match');
    check('Cashier: unknown code refused', fieldError('invoice-code').includes('غير صحيح'), fieldError('invoice-code'));
    fill('invoice-number', 'LN-1001'); fill('invoice-amount', '210'); fill('invoice-bags', '2');
    fill('invoice-code', code.toLowerCase()); await act('fh-code-match');
    check('Cashier: valid code finds the shopper (first name + last initial)', $('.fh-match strong')?.innerText === 'سارة ا.', $('.fh-match strong')?.innerText);
    check('Cashier: receipt draft kept while identifying', $('[name="invoice-number"]').value === 'LN-1001');
    await submit(300);
    check('Cashier: cannot link before confirming the name', fieldError('invoice-code').includes('أكّد'));
    await act('fh-confirm-shopper');
    fill('invoice-items', 'فستان، حقيبة');
    await submit(900);
    check('Cashier: receipt linked with confirmation screen', F.s.route === 'merchant-linked' && text().includes('LN-1001'));
    check('QR: code consumed after linking (single use)', !!V.data.passes.find(p => p.code === code)?.usedAt);
    await act('visit-merchant-start'); fill('invoice-code', code); await act('fh-code-match');
    check('QR: replaying a used code is refused', fieldError('invoice-code').includes('استُخدم'), fieldError('invoice-code'));
  });

  await step('Cashier edge cases', async () => {
    const expired = UI.pass.issue(OTHER, 'front'); expired.expiresAt = Date.now() - 1000; V.save();
    fill('invoice-code', expired.code); await act('fh-code-match');
    check('QR: expired code refused', fieldError('invoice-code').includes('انتهت'), fieldError('invoice-code'));
    const garden = UI.pass.issue(OTHER, 'garden');
    fill('invoice-code', garden.code); await act('fh-code-match');
    check('QR: code from another mall refused', fieldError('invoice-code').includes('مول آخر'), fieldError('invoice-code'));
    await act('fh-mode', 'phone');
    fill('invoice-number', 'LN-1002'); fill('invoice-amount', '90'); fill('invoice-bags', '1');
    fill('invoice-phone', '0599999999'); await act('fh-lookup');
    check('Phone fallback: unknown number gives guidance', text().includes('لا يوجد حساب'));
    check('Phone fallback: receipt draft kept', $('[name="invoice-number"]').value === 'LN-1002');
    fill('invoice-phone', PHONE); await act('fh-lookup');
    check('Phone fallback: match shows masked number', $('.fh-match bdi')?.innerText.includes('4567') && !$('.fh-match').innerText.includes(PHONE));
    fill('invoice-phone', '055123456'); await wait(100);
    check('Phone fallback: editing the number clears the match', !V.invoice.candidate);
    fill('invoice-phone', PHONE); await act('fh-lookup'); await act('fh-confirm-shopper');
    $('[name="invoice-ready"]').click();
    await submit(900);
    check('Cashier: receipt saved as "bags not ready"', V.data.invoices.find(i => i.number === 'LN-1002')?.ready === false);
    await act('visit-merchant-start'); await act('fh-mode', 'phone'); fill('invoice-phone', PHONE); await act('fh-lookup'); await act('fh-confirm-shopper');
    fill('invoice-number', 'ln-1001'); fill('invoice-amount', '10'); fill('invoice-bags', '1'); await submit(300);
    check('Cashier: same receipt number refused for this store', fieldError('invoice-number').includes('مسبقًا'));
    fill('invoice-number', 'LN-1003'); await submit(900);
    check('Cashier: third receipt linked', V.data.invoices.some(i => i.number === 'LN-1003'));
  });

  await step('QR decoded from an image', async () => {
    // The shopper's saved QR image, decoded by the cashier's scanner (BarcodeDetector or jsQR).
    const pass = UI.pass.issue(PHONE, 'front');
    const blob = await (await fetch(UI.qrDataUrl(UI.pass.payload(pass.code)))).blob();
    await act('visit-merchant-start'); await act('fh-scan', null, 400);
    const input = document.getElementById('fh-scan-file');
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'code.gif', { type: 'image/gif' }));
    input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 40 && !V.invoice.candidate; i++) await wait(150);
    check('QR: image of the shopper code decodes to the right shopper', V.invoice.candidate?.phone === PHONE && V.invoice.candidate?.via === 'code', JSON.stringify(V.invoice.candidate));
    F.closeSheet();
  });

  await step('Shopper selects and orders', async () => {
    await shopper(PHONE, 'سارة');
    F.go('bags'); await wait(150);
    check('Purchases: item details shown', text().includes('فستان، حقيبة'));
    check('Purchases: not-ready receipt cannot be selected', !$('[data-collect="' + V.data.invoices.find(i => i.number === 'LN-1002').id + '"]'));
    const c3 = V.data.invoices.find(i => i.number === 'LN-1003').id;
    $(`[data-collect="${c3}"]`).click(); await wait(150);
    check('Purchases: deselecting updates the action', $('#app-cta').innerText.includes('فاتورة واحدة'), $('#app-cta').innerText);
    await act('visit-finish'); await act('fh-place-new', 'parking', 400);
    fill('gate', 'البوابة أ'); await wait(120); fill('number', 'B7'); await submit(600);
    check('Checkout: review lists only the selected receipt', text().includes('فاتورة واحدة'));
    await act('fh-method', 'apple'); await act('fh-pay-open'); await act('fh-pay-decline', null, 1300);
    check('Payment: decline creates no order', V.data.orders.length === 0 && sheet().includes('لم تتم'));
    await act('fh-pay-retry'); const btn = $('[data-action="fh-pay-confirm"]'); btn.click(); btn.click(); await wait(2000);
    const o = V.data.orders[0];
    check('Payment: one order after retry, despite double tap', V.data.orders.length === 1 && F.s.route === 'order-success');
    check('Order: contains only the selected receipt', o && V.data.invoices.filter(i => i.order === o.id).map(i => i.number).join() === 'LN-1001');
    check('Order: unselected receipts stay in Purchases', UI.myInvoices('front').length === 2);
  });

  await step('Store readiness and handover', async () => {
    await business('store@example.com');
    F.go('merchant-pickups'); await wait(150);
    await act('fh-receipt-ready', V.data.invoices.find(i => i.number === 'LN-1002').id);
    check('Store: marks bags ready', V.data.invoices.find(i => i.number === 'LN-1002').ready === true);
    F.go('merchant-home'); await wait(150);
    await act('fh-store-handover', 'FH-4100');
    check('Store: records the handover to the collector', !!V.data.orders[0].stops[0].handedAt);
  });

  await step('Operations collection', async () => {
    await business('ops@example.com');
    check('Ops: task card shows bags, store location and assignee', text().includes('كيسان') && text().includes('A12') && text().includes('غير مسندة'));
    check('Ops: staff wording, not shopper wording', text().includes('قيد الجمع') && !text().includes('نجمع مشترياتك'));
    await act('visit-delivery-order', 'FH-4100'); await act('fh-assign');
    check('Ops: task assigned to the signed-in member', V.data.orders[0].assignee?.email === 'ops@example.com');
    await act('fh-pickup-open', 'linen'); fill('count', '1'); await submit(300, '#app-overlay');
    check('Ops: count mismatch needs a note', fieldError('note'));
    fill('note', 'كيس واحد ناقص، يتابع المتجر'); await submit(400, '#app-overlay');
    const stop = V.data.orders[0].stops[0];
    check('Ops: pickup recorded with discrepancy issue', stop.done && stop.receivedBags === 1 && stop.issue?.type === 'missing');
    await act('visit-delivery-next');
    check('Ops: order moves to car delivery', V.data.orders[0].status === 'ready');
  });

  await step('Delivery exception and completion', async () => {
    await business('delivery@example.com');
    await act('visit-delivery-order', 'FH-4100'); await act('fh-delivery-fail');
    await submit(400, '#app-overlay');
    check('Delivery: failure recorded with reason', V.data.orders[0].exception?.reason === 'unreachable');
    F.actions['visit-delivery-next'](); await wait(100);
    check('Delivery: cannot complete while an exception is open', V.data.orders[0].status === 'ready');
    await shopper(PHONE, 'سارة'); F.s.visitOrderId = 'FH-4100'; F.go('tracking'); await wait(150);
    check('Tracking: shopper sees the reschedule and what to do', text().includes('نعيد جدولة التسليم') && text().includes('المطلوب منك'));
    check('Tracking: shopper sees the bag discrepancy note', text().includes('نقص في عدد الأكياس'));
    await business('delivery@example.com'); await act('visit-delivery-order', 'FH-4100'); await act('fh-exception-clear');
    await act('fh-confirm-delivery'); await act('fh-delivery-done');
    check('Delivery: retry then delivered', V.data.orders[0].status === 'delivered');
  });

  await step('Cancellation', async () => {
    await shopper(PHONE, 'سارة');
    F.go('bags'); await wait(150);
    const later = V.data.invoices.find(i => i.number === 'LN-1002').id;
    check('Purchases: a receipt that became ready later is selected by default', $(`[data-collect="${later}"]`)?.checked === true);
    check('Purchases: a receipt the shopper unticked stays unticked', $(`[data-collect="${V.data.invoices.find(i => i.number === 'LN-1003').id}"]`)?.checked === false);
    await act('visit-finish');
    await act('fh-place-pick', document.querySelector('[data-action="fh-place-pick"]').dataset.id);
    await act('fh-method', 'mada'); await act('fh-pay-open'); await act('fh-pay-confirm', null, 2000);
    const o = V.data.orders.at(-1);
    F.s.visitOrderId = o.id; F.go('tracking'); await wait(150);
    await act('fh-cancel-order', o.id); await act('fh-cancel-confirm', o.id);
    check('Cancel: order cancelled and receipts returned', o.status === 'cancelled' && UI.myInvoices('front').length === 2);
    check('Cancel: a cancelled order does not block a new one', !UI.openOrder('front'));
  });

  await step('Role guards', async () => {
    V.data.malls.push({ id: 'mall-selftest', name: 'مول الاختبار', company: 'جهة', city: 'الدمام', point: 'بوابة 1', email: 'selftest@example.com', status: 'pending', docs: [] }); V.save();
    await business('store@example.com');
    F.s.visitReviewMall = 'mall-selftest'; F.actions['visit-mall-approve'](); await wait(80);
    check('Guards: store cannot approve a mall', V.data.malls.find(m => m.id === 'mall-selftest').status === 'pending');
    F.go('admin-home'); await wait(80);
    check('Guards: store cannot open admin screens', F.s.route !== 'admin-home');
    await shopper(OTHER, 'منى');
    F.forms['fh-pickup']({ store: 'linen', count: '1' }); await wait(80);
    check('Guards: shopper cannot run collection actions', toast().includes('غير متاح'));
    check('Isolation: another shopper sees none of Sara\'s receipts', UI.myInvoices('front').length === 0);
  });

  await step('Onboarding password confirmation', async () => {
    await signOut(); F.go('auth-role-login'); await wait(120); await act('join-mall');
    $('[name="password"]').value = 'Palm12345'; $('[name="confirm"]').value = 'Palm12346';
    await submit(300);
    check('Onboarding: mismatch shown beside the confirmation field', fieldError('confirm').includes('غير متطابقتين'));
  });

  await step('Home delivery with carrier (regression)', async () => {
    await shopper('0581112222', 'خالد');
    await act('visit-select-mall', 'garden'); F.go('bags'); await wait(150);
    const btn = $('#app-cta [data-action="fh-demo-receipts"]'); btn.click(); btn.click(); await wait(900);
    check('Demo receipts: double tap adds one set', UI.myInvoices('garden').length === 1);
    await act('visit-finish'); await act('fh-place-new', 'home', 500);
    fill('district', 'الروضة'); fill('street', 'شارع التحلية'); fill('building', '1200'); await submit(600);
    await act('fh-pay-open');
    check('Checkout: carrier required before paying', toast().includes('شركة التوصيل'));
    await act('fh-carrier', V.data.carriers.find(c => c.mall === 'garden' && c.active).id);
    await act('fh-method', 'mada'); await act('fh-pay-open'); await act('fh-pay-confirm', null, 2000);
    const o = V.data.orders.at(-1);
    check('Checkout: home order with carrier fee', o?.destination === 'home' && o.fee > V.fee && F.s.route === 'order-success');
  });

  await step('Mall registration and admin decision (regression)', async () => {
    const pdf = name => { const dt = new DataTransfer(); dt.items.add(new File(['demo'], name, { type: 'application/pdf' })); return dt.files; };
    await signOut(); F.go('auth-role-login'); await wait(120); await act('join-mall');
    fill('name', 'مول الاختبار الثاني'); fill('company', 'جهة الاختبار'); fill('city', 'جدة'); fill('point', 'البوابة 1');
    const reg = $('input[type=file][name="registration"]'); reg.files = pdf('cr.pdf'); reg.dispatchEvent(new Event('change', { bubbles: true }));
    fill('email', 'mall-two@example.com'); $('[name="password"]').value = 'Mall12345'; $('[name="confirm"]').value = 'Mall12345';
    await submit(1500);
    check('Mall registration: pending status after submit', F.s.route === 'u-mall-status');
    await business('admin@example.com');
    const m = V.data.malls.find(x => x.email === 'mall-two@example.com');
    await act('visit-admin-mall', m.id, 500);
    check('Admin: document is downloadable', $('.fh-doc a[download]'));
    await act('visit-mall-approve');
    check('Admin: approval opens the mall', m.status === 'approved');
    await business('mall-two@example.com', 'Mall12345');
    check('Mall: approved mall reaches its dashboard', F.s.route === 'mall-home');
  });

  await step('Store application and mall review (regression)', async () => {
    const pdf = name => { const dt = new DataTransfer(); dt.items.add(new File(['demo'], name, { type: 'application/pdf' })); return dt.files; };
    await signOut(); F.go('auth-role-login'); await wait(120); await act('join-store');
    fill('mall', 'front'); fill('name', 'متجر الاختبار'); fill('category', 'هدايا'); fill('floor', 'الأول · C1'); fill('registration', '1010999999'); fill('lease', 'LS-1');
    for (const n of ['document', 'leaseDocument']) { const f = $(`input[type=file][name="${n}"]`); f.files = pdf(n + '.pdf'); f.dispatchEvent(new Event('change', { bubbles: true })); }
    fill('manager', 'نوف'); fill('phone', '0533330000'); fill('email', 'test-store@example.com');
    $('[name="password"]').value = 'Store1234'; $('[name="confirm"]').value = 'Store1234'; $('[name="authorized"]').checked = true;
    await submit(1500);
    const s = V.data.stores.find(x => x.email === 'test-store@example.com');
    check('Store application: submitted as pending', s?.status === 'pending');
    await business('test-store@example.com', 'Store1234');
    check('Store application: pending account sees its status only', F.s.route === 'join-status');
    await business('mall@example.com');
    await act('join-review', s.id, 500); $('[name="verified"]').checked = true; await act('join-approve');
    check('Mall: approves the store', s.status === 'approved');
    await business('test-store@example.com', 'Store1234');
    check('Store: approved account opens the store screen', F.s.route === 'merchant-home');
  });

  await step('Password recovery (regression)', async () => {
    await signOut(); F.go('auth-forgot'); await wait(120);
    fill('email', 'shoes@example.com'); await submit(300);
    fill('code', '1234'); $('[name="password"]').value = 'Shoes2026'; $('[name="confirm"]').value = 'Shoes2027'; await submit(300);
    check('Recovery: mismatch beside confirmation', fieldError('confirm').includes('غير متطابقتين'));
    $('[name="confirm"]').value = 'Shoes2026'; await submit(900);
    await business('shoes@example.com', 'Shoes2026');
    check('Recovery: new password signs in', F.s.route === 'merchant-home');
  });

  await step('Console', async () => check('No console errors during the run', !errors.length, errors.slice(0, 3).join(' | ')));

  await signOut();
  const passed = results.filter(r => r.ok).length, failed = results.length - passed;
  window.__selftest = { passed, failed, results };
  console.error = origError;
  const panel = document.createElement('section');
  panel.id = 'fh-selftest';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'نتيجة الاختبار الذاتي');
  panel.style.cssText = 'position:fixed;inset-block-start:12px;inset-inline-end:12px;z-index:9999;width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#fffefa;border:1px solid #b9c9b7;border-radius:16px;padding:14px;font:13px/1.6 "IBM Plex Sans Arabic",sans-serif;color:#182e25;box-shadow:0 10px 30px #0002';
  panel.innerHTML = `<strong style="font-size:15px">الاختبار الذاتي: ${passed} ناجح · ${failed} فاشل</strong>
    <ol style="margin:8px 0 0;padding-inline-start:18px">${results.map(r => `<li style="color:${r.ok ? '#1f4a2c' : '#8a2c1f'}">${r.ok ? '✔' : '✘'} ${r.name}${r.detail ? ` — <small>${String(r.detail).replace(/</g, '&lt;')}</small>` : ''}</li>`).join('')}</ol>
    <button type="button" style="margin-top:8px;min-height:40px;padding:4px 12px;border-radius:10px;border:1px solid #b9c9b7;background:#fff" onclick="this.parentElement.remove()">إغلاق</button>`;
  document.body.appendChild(panel);
})();
