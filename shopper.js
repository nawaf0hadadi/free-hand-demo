/* Free Hand shopper screens.
   Final definitions for the customer journey: landing, sign-in, mall and stores, purchases,
   saved places, checkout (place → review & pay), simulated payment, tracking and orders.
   Business rules stay in the earlier layers and are reused here:
   - receipts: visit.js (invoice data, demo receipts guard, order creation in visit-pay)
   - places: saved-places.js (storage format, selection per mall, apply to checkout)
   - map and device location: address-location.js (Leaflet map, pin, reverse lookup) */
(() => {
  'use strict';
  const F = window.FH;
  const A = F.Access;
  const V = F.Visit;
  const L = F.Location;
  const SP = F.SavedPlaces;
  const UI = F.UI;
  const { ic, esc, b, form, submit, link } = F;
  const clone = x => JSON.parse(JSON.stringify(x));
  const page = (title, html, footer = '', nav = null, back = true) => {
    const view = V.page(title, html, footer, nav, back);
    view.html = view.html.replace('visit-page', 'visit-page fh-page');
    return view;
  };

  /* ---------- Landing ---------- */
  // Order: promise → home or car → what it costs → shopper action. Business access stays
  // available as a quiet link so it never competes with the shopper's start.
  F.views['auth-entry'] = () => ({
    title: 'Free Hand', header: '', nav: null,
    html: `<div class="fh-landing">
      <header class="fh-landing-top">${UI.brand(34)}<button type="button" class="fh-text-btn" data-action="fh-guide">${ic('circle-help')}<span>كيف تعمل؟</span></button></header>
      <section class="fh-landing-hero" aria-labelledby="fh-promise">
        <p class="fh-eyebrow">لمتسوّقي المولات</p>
        <h1 id="fh-promise">نجمع مشترياتك<br><span>ونوصّلها لك</span></h1>
        <p>تسوّق بيدين حرّتين. ادفع في المتاجر كالمعتاد، ونجمع أكياسك من كل المتاجر في طلب واحد.</p>
      </section>
      <ul class="fh-landing-options" aria-label="خيارات التسليم">
        <li><span class="fh-icon-tile">${ic('house')}</span><strong>إلى منزلك</strong><small>مع شركة توصيل تختارها</small></li>
        <li><span class="fh-icon-tile">${ic('car-front')}</span><strong>إلى سيارتك</strong><small>في مواقف المول نفسه</small></li>
      </ul>
      <p class="fh-landing-fee">${ic('wallet')}<span>قيمة مشترياتك تدفعها للمتجر. رسوم Free Hand تبدأ من ${UI.cash(V.fee)} وتُدفع عند طلب الجمع.</span></p>
      <div class="fh-landing-actions">
        ${b(`<span>ابدأ الآن</span>${ic('arrow-left')}`, 'go:login', 'fh-primary')}
        <p class="fh-landing-business">لديك متجر أو تدير مولًا؟ ${link('دخول حسابات الأعمال', 'go:auth-role-login')}</p>
      </div>
      <button type="button" class="fh-prototype" data-action="fh-demo-tools">${ic('flask-conical')} نسخة تجريبية · أدوات العرض</button>
    </div>`
  });

  /* The post-purchase sequence, compact: pay → show your code → it appears in Purchases.
     The same three steps everywhere linking is explained. */
  UI.howSteps = () => `<ol class="fh-how" aria-label="بعد الشراء">
      <li><span>${ic('credit-card')}</span><small>ادفع في المتجر</small></li>
      <li><span>${ic('qr-code')}</span><small>اعرض رمزك للكاشير</small></li>
      <li><span>${ic('receipt-text')}</span><small>تظهر في مشترياتك</small></li>
    </ol>`;
  UI.linkSteps = () => `<ol class="fh-link-flow">
      <li><span class="fh-icon-tile">${ic('credit-card')}</span><div><strong>ادفع في المتجر كالمعتاد</strong><small>قيمة المشتريات تُدفع للمتجر مباشرة.</small></div></li>
      <li><span class="fh-icon-tile">${ic('qr-code')}</span><div><strong>اعرض رمزك على الكاشير</strong><small>من «رمزي» في أعلى الشاشة. إن تعذّر المسح، يبحث الكاشير برقم جوالك المسجّل.</small></div></li>
      <li><span class="fh-icon-tile">${ic('user-round-check')}</span><div><strong>الكاشير يتأكد منك ويربط الفاتورة</strong><small>يراجع اسمك، ثم يدخل الفاتورة المدفوعة وعدد الأكياس.</small></div></li>
      <li><span class="fh-icon-tile">${ic('receipt-text')}</span><div><strong>تظهر في «المشتريات»</strong><small>بلا إدخال منك. اختر ما تريد جمعه وادفع رسوم الخدمة فقط.</small></div></li>
    </ol>`;

  F.actions['fh-guide'] = () => F.sheet('كيف تعمل الخدمة؟', UI.linkSteps() +
    `<ol class="fh-link-flow is-tail"><li><span class="fh-icon-tile">${ic('route')}</span><div><strong>نجمعها ونسلّمها لك</strong><small>نستلم الأكياس من المتاجر ونسلّمها عند سيارتك في المول أو على عنوان منزلك.</small></div></li></ol>
    <div class="fh-fee-explain">${UI.line('قيمة المشتريات', 'تُدفع للمتجر')}${UI.line('رسوم الجمع', UI.cash(V.fee))}${UI.line('التوصيل للمنزل', 'حسب شركة التوصيل')}</div>`,
    A.session ? '' : b('ابدأ الآن ' + ic('arrow-left'), 'go:login'));
  F.actions['fh-link-help'] = () => F.sheet('كيف تصل فواتيرك إلى التطبيق؟', UI.linkSteps(), b(ic('qr-code') + ' عرض رمزي', 'fh-my-code'));

  /* ---------- Sign-in (one flow for new and returning shoppers) ---------- */
  let phoneError = '';
  let codeError = '';
  const intro = (icon, title, sub) => `<div class="fh-auth-intro"><span class="fh-auth-icon">${ic(icon)}</span><h2 class="a-title">${title}</h2><p class="a-sub">${sub}</p></div>`;
  const authHead = (title, sub) => `<div class="fh-auth-head">${UI.mark(44)}<h2 class="a-title">${title}</h2>${sub ? `<p class="a-sub">${sub}</p>` : ''}</div>`;

  F.views.login = () => page('تسجيل الدخول',
    authHead('أهلًا بك', 'أدخل رقم جوالك للمتابعة.') +
    form('auth-customer-phone', UI.field({
      name: 'customer-phone', label: 'رقم الجوال', value: A.pendingPhone, placeholder: '05XXXXXXXX', type: 'tel',
      attrs: 'dir="ltr" inputmode="numeric" maxlength="10" autocomplete="tel-national" required', error: phoneError
    })), submit('متابعة ' + ic('arrow-left')), null);

  F.views.otp = () => page('رمز التحقق',
    authHead('أدخل رمز التحقق', `أرسلنا رمزًا من 4 أرقام إلى رقمك المنتهي بـ <bdi dir="ltr">${esc(String(A.pendingPhone).slice(-4))}</bdi>.`) +
    form('auth-customer-otp', UI.field({
      name: 'customer-code', label: 'رمز التحقق', placeholder: '••••', type: 'text',
      attrs: 'dir="ltr" inputmode="numeric" maxlength="4" autocomplete="one-time-code" class="fh-code" required',
      hint: 'نسخة تجريبية: الرمز 1234.', error: codeError
    })) +
    `<div class="fh-inline-actions">${link(ic('pencil') + ' تعديل الرقم', 'fh-edit-phone')}${link(ic('rotate-ccw') + ' إعادة إرسال الرمز', 'fh-resend')}</div>`,
    submit('تأكيد ' + ic('arrow-left')), null);

  const phoneSubmit = F.forms['auth-customer-phone'];
  F.forms['auth-customer-phone'] = d => {
    const phone = F.digits(d['customer-phone']);
    A.pendingPhone = phone;
    if (!/^05\d{8}$/.test(phone)) {
      phoneError = 'أدخل رقمًا من 10 أرقام يبدأ بـ 05.';
      F.render();
      F.$('[name="customer-phone"]')?.focus();
      return;
    }
    phoneError = '';
    codeError = '';
    UI.busy('جارٍ إرسال الرمز…', async () => { await UI.wait(400); phoneSubmit(d); });
  };
  const otpSubmit = F.forms['auth-customer-otp'];
  F.forms['auth-customer-otp'] = d => {
    const code = F.digits(d['customer-code']);
    codeError = !/^\d{4}$/.test(code) ? 'أدخل الرمز المكوّن من 4 أرقام.' : code !== '1234' ? 'الرمز غير صحيح. تحقق منه وأعد المحاولة.' : '';
    if (codeError) { F.render(); F.$('[name="customer-code"]')?.focus(); return; }
    UI.busy('جارٍ التحقق…', async () => { await UI.wait(400); otpSubmit(d); });
  };
  F.actions['fh-edit-phone'] = () => { codeError = ''; F.go('login', { replace: true }); };
  F.actions['fh-resend'] = () => F.toast('أُعيد إرسال الرمز (محاكاة). الرمز التجريبي 1234.');

  // New shoppers complete their name once: first name (required) and last name (optional).
  // The cashier sees the first name and the initial of the last name when confirming a match.
  V.supported.customer.push('auth-customer-name');
  F.views['auth-customer-name'] = () => page('إكمال الحساب',
    authHead('ما اسمك؟', 'يراه الكاشير عند ربط مشترياتك بحسابك.') +
    form('auth-customer-name', UI.field({ name: 'customer-name', label: 'الاسم الأول', value: F.draft['customer-name'] || '', placeholder: 'مثال: سارة', attrs: 'maxlength="35" autocomplete="given-name" required' }) +
      UI.field({ name: 'customer-last-name', label: 'اسم العائلة' + UI.optional, value: F.draft['customer-last-name'] || '', placeholder: 'مثال: العتيبي', attrs: 'maxlength="35" autocomplete="family-name"' })),
    submit('متابعة ' + ic('arrow-left')), null, false);
  const nameSubmit = F.forms['auth-customer-name'];
  F.forms['auth-customer-name'] = d => {
    const name = String(d['customer-name'] || '').trim();
    const lastName = String(d['customer-last-name'] || '').trim().slice(0, 35);
    if (name.length < 2) return UI.showErrors({ 'customer-name': 'اكتب اسمك الأول (حرفان على الأقل).' });
    F.s.lastName = lastName;
    if (A.model.records[A.session?.id]) A.model.records[A.session.id].lastName = lastName;
    nameSubmit({ 'customer-name': name.slice(0, 35) });
  };

  /* ---------- Mall selection and stores ---------- */
  const activeStores = mallId => V.stores(mallId).filter(s => s.active);
  const hasHomeDelivery = mallId => V.data.carriers.some(c => c.mall === mallId && c.active);

  F.views.malls = () => {
    const current = V.mall();
    const malls = V.data.malls.filter(m => m.status === 'approved');
    return page('اختيار المول',
      intro('building-2', 'أين تتسوّق اليوم؟', 'نعرض متاجر المول وفواتيرك المرتبطة فيه.') +
      `<div class="fh-option-list">${malls.map(m => {
        const n = activeStores(m.id).length;
        const services = ['التسليم للسيارة', hasHomeDelivery(m.id) && 'التوصيل للمنزل'].filter(Boolean).join(' و');
        return V.select(esc(m.name), 'visit-select-mall', m.id, current?.id === m.id, 'building-2', `${esc(m.city)} · ${n ? 'المتاجر المشاركة: ' + UI.num(n) : 'لا متاجر مفعّلة بعد'}<br>${services}`);
      }).join('')}</div>` +
      (current ? '' : `<div class="fh-inline-actions center">${link('تسجيل الخروج', 'auth-logout')}</div>`),
      '', null, !!current);
  };

  function storeRows() {
    const m = V.mall();
    const q = V.search.toLowerCase().trim();
    const shown = activeStores(m?.id).filter(s => (V.category === 'الكل' || s.category === V.category) && (s.name + ' ' + s.category).toLowerCase().includes(q));
    return shown.length ? shown.map(s => `<button type="button" class="fh-store-row" data-action="visit-open-store" data-id="${esc(s.id)}">${V.storeLogo(s)}<span><strong>${esc(s.name)}</strong><small>${esc(s.category)} · ${UI.iso(s.floor)}</small></span>${ic('chevron-left')}</button>`).join('')
      : UI.empty('search', 'لا متاجر مطابقة', 'جرّب تصنيفًا آخر أو ابحث باسم المتجر.');
  }
  F.$('#phone-app').addEventListener('input', e => {
    if (e.target.name === 'visit-search' && F.$('#visit-stores')) { F.$('#visit-stores').innerHTML = storeRows(); F.icons(); }
  });

  /* ---------- Home: adapts to where the shopper is in the session ---------- */
  // Receipts to collect at this mall: every ready receipt except the ones the shopper unticked,
  // so receipts that become ready later are included by default.
  const readyItems = (mallId = UI.mallId()) => UI.myInvoices(mallId).filter(UI.isReady);
  function collectIds(mallId = UI.mallId()) {
    const skipped = F.s.skipCollect?.[mallId] || [];
    return readyItems(mallId).map(i => i.id).filter(id => !skipped.includes(id));
  }
  V.collectIds = () => collectIds();
  UI.collectItems = (mallId = UI.mallId()) => { const ids = collectIds(mallId); return UI.myInvoices(mallId).filter(i => ids.includes(i.id)); };

  function sessionCard(m) {
    const order = UI.openOrder(m.id);
    const items = UI.myInvoices(m.id);
    const ready = items.filter(UI.isReady);
    const storesOf = list => new Set(list.map(i => i.store)).size;
    if (order) {
      const done = order.stops.filter(s => s.done).length;
      return `<section class="fh-session is-active"><div class="fh-row"><small>طلبك الجاري · <bdi dir="ltr">${esc(order.id)}</bdi></small>${UI.status(esc(statusTitle(order)), order.exception ? 'error' : 'info')}</div>
        <h2>${order.exception ? 'نحتاج متابعة بسيطة' : esc(statusTitle(order))}</h2>
        <p>${order.status === 'collecting' ? `الاستلام من المتاجر: ${UI.num(done)} من ${UI.num(order.stops.length)}` : order.destination === 'home' ? 'في الطريق إلى عنوانك.' : 'في الطريق إلى سيارتك.'}</p>
        ${order.status === 'collecting' ? `<progress class="fh-collection-progress" value="${done}" max="${order.stops.length}" aria-label="تقدّم الجمع"></progress>` : ''}
        ${b(ic('route') + ' تتبّع الطلب', 'visit-open-order', 'small', `data-id="${esc(order.id)}"`)}</section>`;
    }
    if (ready.length) {
      return `<section class="fh-session is-ready"><small>مشترياتك في ${esc(m.name)}</small>
        <h2>${UI.count(ready.length, 'invoice')} جاهزة للجمع</h2><p>من ${UI.count(storesOf(ready), 'store')}. واصل التسوق، واطلب الجمع متى شئت في طلب واحد.</p>
        <div class="fh-session-actions">${b(ic('package-check') + ' اطلب الجمع', 'go:bags', 'small')}${b(ic('qr-code') + ' رمزي', 'fh-my-code', 'secondary small')}</div></section>`;
    }
    if (items.length) {
      return `<section class="fh-session"><small>مشترياتك في ${esc(m.name)}</small><h2>${UI.count(items.length, 'invoice')} قيد التجهيز</h2>
        <p>المتجر يجهّز الأكياس. تصبح جاهزة للجمع خلال دقائق.</p>${b(ic('receipt-text') + ' عرض المشتريات', 'go:bags', 'secondary small')}</section>`;
    }
    const last = UI.myOrders().filter(o => o.mall === m.id && o.status === 'delivered').at(-1);
    return `<section class="fh-session is-start"><small>${last ? `آخر طلب <bdi dir="ltr">${esc(last.id)}</bdi> · تم التسليم` : `تتسوّق في ${esc(m.name)}`}</small>
      <h2>بعد كل عملية دفع، اعرض رمزك</h2>${UI.howSteps()}
      <div class="fh-session-actions">${b(ic('qr-code') + ' عرض رمزي', 'fh-my-code', 'small')}${link('كيف تعمل؟', 'fh-link-help')}</div></section>`;
  }

  F.views.stores = () => {
    const m = V.mall();
    if (!m) return F.views.malls();
    const stores = activeStores(m.id);
    const categories = ['الكل', ...new Set(stores.map(s => s.category))];
    return page('الرئيسية',
      `<p class="fh-greet">أهلًا ${esc(F.s.name || '')}</p>` + sessionCard(m) +
      UI.section(`متاجر ${esc(m.name)}`, `<span class="fh-muted-small">${UI.count(stores.length, 'store')}</span>`) +
      `<label class="u-search fh-search">${ic('search')}<input type="search" name="visit-search" aria-label="ابحث عن متجر" placeholder="ابحث عن متجر" value="${esc(V.search)}"></label>
      ${stores.length > 1 ? `<div class="j-categories fh-chips" role="group" aria-label="تصنيف المتاجر">${categories.map(c => `<button type="button" data-action="fh-category" data-id="${esc(c)}" aria-pressed="${V.category === c}">${esc(c)}</button>`).join('')}</div>` : ''}
      <div id="visit-stores" class="fh-list">${stores.length ? storeRows() : UI.empty('store', 'لا متاجر مفعّلة', 'لا توجد متاجر مشاركة في هذا المول حاليًا. اختر مولًا آخر.', b('اختيار مول آخر', 'go:malls', 'secondary'))}</div>`,
      '', 'stores', false);
  };
  F.views.home = F.views['mall-detail'] = F.views.stores;
  F.actions['fh-category'] = btn => { V.category = btn.dataset.id; UI.rerender(); };

  F.views['u-store-detail'] = () => {
    const s = V.get('stores', F.s.visitStore);
    if (!s) return F.views.stores();
    return page(esc(s.name),
      (s.photo ? `<img class="visit-photo" src="${esc(s.photo)}" alt="صورة ${esc(s.name)}">` : '') +
      `<section class="a-card fh-store-card">${V.storeLogo(s)}<div><h2>${esc(s.name)}</h2><p>${esc(s.category)} · ${UI.iso(s.floor)}</p>${s.hours || s.contact ? `<p class="a-muted">${[s.hours, s.contact].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</div></section>` +
      (s.description ? `<p class="fh-body">${esc(s.description)}</p>` : '') +
      UI.callout('qr-code', 'بعد الدفع عند الكاشير', 'اعرض رمزك ليربط الكاشير الفاتورة بحسابك. تظهر بعدها في «المشتريات».'),
      b(ic('qr-code') + ' عرض رمزي', 'fh-my-code', 'secondary'), 'stores');
  };

  /* ---------- My code: the shopper's QR and short code for the cashier ---------- */
  let passTimer = null;
  const remaining = pass => { const s = Math.max(0, Math.round((pass.expiresAt - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function passHTML(pass, m) {
    return `<div class="fh-pass" aria-live="polite">
      <div class="fh-pass-qr">${UI.qrSvg(UI.pass.payload(pass.code), 240) || `<p class="fh-muted-small">تعذّر رسم رمز QR. استخدم الرمز المكتوب.</p>`}</div>
      <strong class="fh-pass-code" dir="ltr">${esc(UI.pass.format(pass.code))}</strong>
      <p>${esc(F.s.name || '')} · ${esc(m.name)} · <span id="fh-pass-timer">صالح ${remaining(pass)}</span></p>
      <small>اعرضه على الكاشير بعد الدفع. لا يحتوي على رقمك أو بياناتك، ويتجدد تلقائيًا ويُستخدم مرة واحدة.</small>
    </div>`;
  }
  F.actions['fh-my-code'] = () => {
    const m = V.mall();
    const phone = V.customer();
    if (!m || !phone) return;
    let pass = UI.pass.ensure(phone, m.id);
    F.sheet('رمزي للكاشير', passHTML(pass, m),
      b(ic('download') + ' حفظ صورة الرمز', 'fh-pass-save', 'secondary') + `<p class="fh-footnote">${ic('info')}<span>إن تعذّر المسح، يستطيع الكاشير إيجادك برقم جوالك المسجّل.</span></p>`);
    clearInterval(passTimer);
    passTimer = setInterval(() => {
      const timer = document.getElementById('fh-pass-timer');
      if (!timer) return clearInterval(passTimer);
      if (pass.expiresAt <= Date.now() || pass.usedAt) {
        pass = UI.pass.issue(phone, m.id);
        document.querySelector('.fh-pass')?.replaceWith(Object.assign(document.createElement('div'), { innerHTML: passHTML(pass, m) }).firstElementChild);
        F.icons();
      } else timer.textContent = 'صالح ' + remaining(pass);
    }, 1000);
  };
  F.actions['fh-pass-save'] = () => {
    const pass = UI.pass.current(V.customer(), UI.mallId());
    if (!pass || !window.qrcode) return;
    const a = document.createElement('a');
    a.href = UI.qrDataUrl(UI.pass.payload(pass.code));
    a.download = `free-hand-${pass.code}.gif`;
    document.body.appendChild(a); a.click(); a.remove();
    F.toast('حُفظت صورة الرمز. صالحة حتى انتهاء المؤقت.');
  };

  /* ---------- Purchases ---------- */
  const receiptSource = i => i.source === 'demo' ? UI.status('تجريبية', 'demo') : UI.status('ربطها الكاشير', 'muted');
  F.views.bags = () => {
    const m = V.mall();
    if (!m) return F.views.malls();
    const items = UI.myInvoices(m.id);
    const order = UI.openOrder(m.id);
    const stores = activeStores(m.id);
    const chosen = collectIds(m.id);
    const head = `<p class="fh-lead">فواتيرك المدفوعة في <strong>${esc(m.name)}</strong>. تبقى هنا حتى تطلب جمعها.</p>`;
    const codeLink = `<p class="fh-footnote">${ic('qr-code')}<span>اشتريت من متجر آخر؟ ${link('اعرض رمزك للكاشير', 'fh-my-code')}</span></p>`;
    let body = '';
    let footer = '';
    if (order) {
      body += `<section class="fh-active-order"><div class="fh-row">${UI.status(esc(statusTitle(order)), 'info')}<bdi dir="ltr" class="fh-order-id">${esc(order.id)}</bdi></div>
        <h3>لديك طلب جمع جارٍ في هذا المول</h3>
        <p>${order.stops.length ? 'يشمل ' + UI.count(order.stops.length, 'store') + '. ' : ''}الفواتير الجديدة تبقى هنا لطلب لاحق بعد اكتمال هذا الطلب.</p></section>`;
      if (!items.length) body += UI.callout('info', 'الفواتير التجريبية غير متاحة الآن', 'تتوفر عندما لا يكون لديك طلب جارٍ في هذا المول. تابع طلبك، أو جرّب مولًا آخر.') + `<div class="fh-inline-actions">${link(ic('building-2') + ' اختيار مول آخر', 'go:malls')}</div>`;
      footer = b(ic('route') + ' تتبّع الطلب', 'visit-open-order', '', `data-id="${esc(order.id)}"`);
    }
    if (items.length) {
      const groups = [...new Set(items.map(i => i.store))].map(id => items.filter(i => i.store === id));
      const selected = items.filter(i => chosen.includes(i.id));
      const canSelect = !order;
      body += `<section class="fh-summary-card">
          ${UI.line(canSelect ? 'المحدد للجمع' : 'قيمة المشتريات', UI.cash(V.sum(canSelect ? selected : items)))}
          <p>${ic('circle-check')}<span>مدفوعة للمتاجر. لن تدفعها مرة أخرى.</span></p>
          <hr>
          ${UI.line('رسوم Free Hand عند الطلب', 'من ' + UI.cash(V.fee))}
          <p>${ic('info')}<span>رسوم الجمع ${UI.cash(V.fee)} لطلب واحد يشمل كل المتاجر، والتوصيل للمنزل حسب الشركة.</span></p>
        </section>` +
        UI.section(UI.count(items.length, 'invoice') + ' من ' + UI.count(groups.length, 'store'), canSelect ? `<span class="fh-muted-small">المحدد: ${UI.num(selected.length)}</span>` : UI.status('لطلب لاحق', 'wait')) +
        groups.map(group => {
          const s = V.get('stores', group[0].store);
          return `<section class="a-card fh-receipt-group"><div class="fh-receipt-store">${V.storeLogo(s)}<div><strong>${esc(s?.name || 'متجر')}</strong><small>${ic('map-pin')} ${UI.iso(s?.floor || '')}</small></div></div>
            ${group.map(i => {
              const ready = UI.isReady(i);
              const on = chosen.includes(i.id);
              const control = canSelect && ready
                ? `<input type="checkbox" class="fh-collect" data-collect="${esc(i.id)}"${on ? ' checked' : ''} aria-label="جمع فاتورة ${esc(i.number)} من ${esc(s?.name || '')}">`
                : `<span class="fh-collect-off" aria-hidden="true">${ic(ready ? 'clock' : 'hourglass')}</span>`;
              return `<label class="fh-receipt${(F.s.freshDemo && i.source === 'demo') || F.s.freshReceipt === i.id ? ' is-new' : ''}${canSelect && ready && !on ? ' is-off' : ''}">${control}
                <div class="fh-receipt-main"><span class="fh-receipt-no">فاتورة <bdi dir="ltr">${esc(i.number)}</bdi></span>
                  ${i.items ? `<small class="fh-receipt-items">${esc(i.items)}</small>` : ''}
                  <small>${ic('shopping-bag')} ${UI.count(i.bags, 'bag')} · ${ready ? 'جاهزة للجمع' : 'قيد التجهيز في المتجر'}</small><span class="fh-tags">${receiptSource(i)}</span></div>
                <div class="fh-receipt-end"><strong>${UI.cash(i.amount)}</strong>${UI.status('مدفوعة للمتجر', 'ok')}</div>
              </label>`;
            }).join('')}</section>`;
        }).join('') + codeLink;
      if (!order) footer = selected.length ? b(`اطلب جمع ${UI.count(selected.length, 'invoice')} ${ic('arrow-left')}`, 'visit-finish') : b('حدّد فاتورة واحدة على الأقل', 'visit-finish', 'secondary', 'disabled');
    } else if (!order) {
      if (stores.length) {
        body += `<section class="a-card fh-first-purchase"><h2>لا فواتير مرتبطة بعد</h2>${UI.howSteps()}
            <div class="fh-session-actions">${b(ic('qr-code') + ' عرض رمزي', 'fh-my-code', 'small')}${link('التفاصيل', 'fh-link-help')}</div></section>` +
          `<section class="fh-demo-card"><div>${UI.status('للتجربة دون كاشير', 'demo')}<h3>جرّب بفواتير تجريبية</h3><p>نضيف ${UI.count(Math.min(3, stores.length), 'invoice')} مدفوعة من متاجر ${esc(m.name)}، معلّمة بأنها تجريبية.</p></div></section>`;
        footer = b(ic('plus') + ' إضافة فواتير تجريبية', 'fh-demo-receipts');
      } else {
        body += UI.empty('store', 'لا متاجر مفعّلة في هذا المول', 'لا يمكن ربط فواتير أو إضافة فواتير تجريبية هنا حاليًا. اختر مولًا آخر.');
        footer = b('اختيار مول آخر', 'go:malls', 'secondary');
      }
    }
    return page('المشتريات', head + body, footer, 'bags', false);
  };
  F.$('#phone-app').addEventListener('change', e => {
    const id = e.target.dataset?.collect;
    if (!id || A.session?.role !== 'customer') return;
    const m = UI.mallId();
    const skipped = new Set(F.s.skipCollect?.[m] || []);
    if (e.target.checked) skipped.delete(id); else skipped.add(id);
    F.s.skipCollect = { ...(F.s.skipCollect || {}), [m]: [...skipped] };
    UI.rerender();
    F.$(`[data-collect="${id}"]`)?.focus();
  });

  // Choosing a mall keeps the visit record the store uses for its "shopping now" hint.
  const selectMall = F.actions['visit-select-mall'];
  F.actions['visit-select-mall'] = btn => {
    selectMall(btn);
    const phone = V.customer(), m = V.mall();
    if (phone && m) { V.data.visits[phone] = { ...(V.data.visits[phone] || {}), mall: m.id, name: F.s.name }; V.save(); }
  };

  const demoItems = { 'أزياء': 'قميص قطني، بنطال', 'أحذية': 'حذاء رياضي', 'عطور': 'عطر 100 مل', 'منزل': 'طقم أكواب', 'هدايا': 'علبة هدايا' };
  F.actions['fh-demo-receipts'] = async btn => {
    if (UI.isBusy()) return;
    if (!V.mall() || UI.myInvoices().length || UI.openOrder()) return F.render();
    await UI.busy('جارٍ الإضافة…', async () => {
      await UI.wait(350);
      F.actions['visit-sample'](btn); // visit.js adds once per mall and renders.
      for (const i of UI.myInvoices()) if (i.source === 'demo' && !i.items) { i.items = demoItems[V.get('stores', i.store)?.category] || ''; i.ready = true; }
      V.save();
    });
    F.s.freshDemo = true;
    F.render();
    setTimeout(() => { F.s.freshDemo = false; }, 1200);
  };

  /* ---------- Saved places ---------- */
  const placesKey = () => 'fh-saved-places-v1:' + A.session?.id;
  function placesData() {
    try {
      const d = JSON.parse(localStorage.getItem(placesKey()) || 'null');
      if (d?.version === 1 && Array.isArray(d.places)) return { ...d, selected: d.selected || {} };
    } catch {}
    return { version: 1, places: [], selected: {} };
  }
  function writePlaces(d) {
    if (A.session?.role !== 'customer') return false;
    try { localStorage.setItem(placesKey(), JSON.stringify(d)); return true; }
    catch { F.toast('تعذّر حفظ المكان في المتصفح. أفرغ بعض المساحة ثم أعد المحاولة.', true); return false; }
  }
  const placeIcon = p => p?.type === 'parking' ? 'car-front' : 'house';
  const placeKind = p => p?.type === 'parking' ? 'عند سيارتك' : 'إلى المنزل';
  UI.placeSummary = p => p?.type === 'parking'
    ? [p.gate, p.level, p.area && 'منطقة ' + p.area, p.number && 'موقف ' + p.number].filter(Boolean).join('، ') || 'نقطة محددة على الخريطة'
    : [p?.address, p?.city].filter(Boolean).join('، ');
  const placeSummary = UI.placeSummary;



  function placeCard(p, { pick = false } = {}) {
    const mall = V.mall();
    const selected = SP.selected()?.id === p.id;
    const usable = SP.eligible(p);
    const parkingMall = p.type === 'parking' ? V.get('malls', p.mall) : null;
    const saved = F.s.savedPlace === p.id ? ' is-saved' : '';
    if (pick) {
      return `<button type="button" class="fh-place-option${saved}" data-action="fh-place-pick" data-id="${esc(p.id)}" aria-pressed="${selected}">
        <span class="fh-icon-tile">${ic(placeIcon(p))}</span>
        <span><small>${placeKind(p)}</small><strong>${esc(p.title)}</strong><small>${esc(placeSummary(p))}</small><small class="fh-fee-hint">${p.type === 'home' ? `الجمع ${UI.cash(V.fee)} + رسوم شركة التوصيل` : `${UI.cash(V.fee)} للجمع والتسليم عند السيارة`}</small></span>
        ${ic(selected ? 'circle-check' : 'chevron-left')}</button>`;
    }
    return `<div class="fh-place-card${selected ? ' is-selected' : ''}${saved}">
      <div class="fh-place-main"><span class="fh-icon-tile">${ic(placeIcon(p))}</span>
        <div><strong>${esc(p.title)}</strong><small>${esc(placeSummary(p))}</small>
        ${parkingMall ? `<small>${ic('building-2')} ${esc(parkingMall.name)}${usable ? '' : ' · يظهر عند الطلب من هذا المول'}</small>` : ''}
        ${selected ? UI.status(`الافتراضي في ${esc(mall?.name || 'هذا المول')}`, 'ok') : ''}</div></div>
      <div class="fh-place-actions">${b(ic('pencil') + ' تعديل', 'fh-place-edit', 'ghost small', `data-id="${esc(p.id)}"`)}${usable && !selected ? b(ic('circle-check') + ' اجعله الافتراضي', 'fh-place-default', 'ghost small', `data-id="${esc(p.id)}"`) : ''}</div>
    </div>`;
  }

  F.views['saved-places'] = () => {
    const m = V.mall();
    if (!m) return F.views.malls();
    const all = placesData().places;
    const homes = all.filter(p => p.type === 'home');
    const parks = all.filter(p => p.type === 'parking').sort((a, b2) => Number(b2.mall === m.id) - Number(a.mall === m.id));
    const html = `<p class="fh-lead">احفظ عنوان منزلك أو موقف سيارتك مرة واحدة، ثم اختره عند الطلب بضغطة.</p>` +
      (all.length
        ? (homes.length ? UI.section('العناوين') + `<div class="fh-list">${homes.map(p => placeCard(p)).join('')}</div>` : '') +
          (parks.length ? UI.section('مواقف السيارة') + `<div class="fh-list">${parks.map(p => placeCard(p)).join('')}</div>` : '')
        : `<div class="fh-option-list">${V.select('عنوان المنزل', 'fh-place-new', 'home', false, 'house', 'حدّد النقطة على الخريطة أو اكتب العنوان')}${V.select('موقف سيارتك', 'fh-place-new', 'parking', false, 'car-front', `البوابة والدور ورقم الموقف في ${esc(m.name)}`)}</div>`) +
      `<p class="fh-footnote">${ic('lock')}<span>الأماكن محفوظة في هذا المتصفح لحسابك فقط.</span></p>`;
    return page('الأماكن', html, all.length ? b(ic('plus') + ' إضافة مكان', 'fh-place-add', 'secondary') : '', 'saved-places', false);
  };

  F.actions['fh-place-add'] = () => F.sheet('إضافة مكان', `<div class="fh-option-list">${V.select('عنوان المنزل', 'fh-place-new', 'home', false, 'house', 'للتوصيل عبر شركة توصيل')}${V.select('موقف السيارة', 'fh-place-new', 'parking', false, 'car-front', `للتسليم عند سيارتك في ${esc(V.mall()?.name || 'المول')}`)}</div>`);
  F.actions['fh-place-new'] = btn => openEditor(btn.dataset.id === 'parking' ? 'parking' : 'home', null);
  F.actions['fh-place-edit'] = btn => { const p = placesData().places.find(x => x.id === btn.dataset.id); if (p) openEditor(p.type, p); };
  F.actions['fh-place-default'] = btn => {
    if (!SP.selectPlace(btn.dataset.id)) return;
    F.s.savedPlace = btn.dataset.id;
    UI.rerender();
    F.toast('أصبح «' + SP.selected().title + '» مكان التسليم الافتراضي');
  };
  // Older entry points still open the same screens.
  F.actions['places-open'] = () => F.go('saved-places');
  F.actions['places-add'] = F.actions['fh-place-add'];
  F.actions['places-change'] = () => F.go('destination');

  /* Place editor: map pin, device location, city list and manual fields, all editable at any time. */
  const editor = () => F.s.placeEditor;
  function openEditor(type, p) {
    if (A.session?.role !== 'customer' || !V.mall()) return;
    const mall = type === 'parking' ? (p?.mall ? V.get('malls', p.mall) : V.mall()) : null;
    const config = UI.parkingFor(mall);
    L.cancelEditor();
    F.closeSheet();
    const hasDetails = p?.details && ['district', 'street', 'building'].some(k => p.details[k]);
    const city = p?.city || V.mall().city;
    const gateKnown = !p?.gate || config.gates.includes(p.gate);
    F.s.placeEditor = {
      id: p?.id || null, type, mall: mall?.id || null, title: p?.title || '', notes: p?.notes || '',
      legacy: p && type === 'home' && !hasDetails ? (p.address || '') : '',
      prior: clone(V.checkout), returnTo: F.s.route === 'destination' ? 'destination' : 'saved-places'
    };
    V.checkout = {
      destination: type, city, address: '', carrier: '',
      details: { district: '', street: '', building: '', unit: '', short: '', notes: '', ...clone(p?.details || {}), city },
      coordinates: type === 'home' ? clone(p?.coordinates || null) : null,
      parkingCoordinates: type === 'parking' ? clone(p?.coordinates || null) : null,
      parkingDetails: { gate: gateKnown ? (p?.gate || '') : 'other', otherGate: gateKnown ? '' : p.gate, level: p?.level || '', area: p?.area || '', number: p?.number || '', notes: p?.notes || '' }
    };
    F.go('place-editor');
  }

  F.views['place-editor'] = () => {
    const e = editor();
    if (!e) return F.views['saved-places']();
    const home = e.type === 'home';
    const st = L.editorStatus();
    const d = V.checkout.details;
    const pk = V.checkout.parkingDetails;
    const mall = V.get('malls', e.mall) || V.mall();
    const config = UI.parkingFor(mall);
    const pinState = st.pending ? ['loader', 'جارٍ اعتماد النقطة…'] : st.coordinates ? ['map-pin-check', 'النقطة محددة. اسحب العلامة أو اضغط مكانًا آخر لتعديلها.'] : ['pointer', 'اضغط على الخريطة لوضع العلامة في مكان التسليم.'];
    const map = `<div class="fh-map-card${st.coordinates ? ' has-pin' : ''}"><div id="delivery-map" role="application" aria-label="خريطة لتحديد ${home ? 'موقع المنزل' : 'موقع السيارة'}. اضغط لوضع العلامة."></div>
      <div class="fh-map-bar">${ic(pinState[0])}<span>${pinState[1]}</span>${st.coordinates ? `<button type="button" class="fh-text-btn" data-action="fh-place-clear-pin">${ic('x')} إزالة</button>` : ''}</div></div>
      <div class="fh-locate">${b(st.busy ? UI.spinner() + ' جارٍ تحديد موقعك…' : ic('locate-fixed') + ' استخدم موقعي الحالي', 'location-current', 'secondary small', st.busy ? 'disabled' : '')}${st.busy ? b('إلغاء', 'location-cancel', 'ghost small') : ''}</div>
      ${st.message ? `<p class="fh-map-status" role="status">${esc(st.message)}</p>` : ''}`;
    const cityOptions = [['', 'اختر المدينة'], ...L.cities.map(c => [c, c])];
    if (d.city && !L.cities.includes(d.city)) cityOptions.push([d.city, d.city]);
    const fields = home
      ? UI.field({ name: 'title', label: 'اسم المكان', value: e.title, placeholder: 'مثال: المنزل أو بيت العائلة', attrs: 'maxlength="45"' }) +
        UI.selectField({ name: 'city', label: 'المدينة', options: cityOptions, value: d.city }) +
        (e.legacy ? UI.callout('history', 'العنوان المحفوظ سابقًا', esc(e.legacy) + '<br>أكمل الحقول لتحديثه، أو احفظ كما هو.') : '') +
        `<div class="a-grid2">${UI.field({ name: 'district', label: 'الحي', value: d.district, placeholder: 'اسم الحي', attrs: 'maxlength="60" autocomplete="address-level3"' })}${UI.field({ name: 'street', label: 'الشارع', value: d.street, placeholder: 'اسم الشارع', attrs: 'maxlength="80" autocomplete="address-line1"' })}</div>
        <div class="a-grid2">${UI.field({ name: 'building', label: 'رقم المبنى', value: d.building, placeholder: 'مثال: 4521', attrs: 'dir="ltr" inputmode="numeric" maxlength="10"' })}${UI.field({ name: 'unit', label: 'الشقة أو الوحدة · اختياري', value: d.unit, placeholder: 'مثال: 12', attrs: 'maxlength="15"' })}</div>
        <details class="fh-details"${d.short || e.notes ? ' open' : ''}><summary>تفاصيل إضافية · اختياري</summary>
          ${UI.field({ name: 'short', label: 'العنوان الوطني المختصر', value: d.short, placeholder: 'RRRD1234', attrs: 'dir="ltr" maxlength="8" autocapitalize="characters"', hint: '4 أحرف إنجليزية و4 أرقام. لا يتم التحقق منه آليًا في هذه النسخة.' })}
          ${UI.field({ name: 'notes', label: 'تعليمات للمندوب', value: e.notes, placeholder: 'مثال: المدخل الجانبي، الدور الثاني', attrs: 'maxlength="120"' })}
        </details>`
      : UI.callout('building-2', `موقف في ${esc(mall?.name || 'المول')}`, 'يظهر هذا المكان عند الطلب من هذا المول فقط.') +
        UI.field({ name: 'title', label: 'اسم المكان', value: e.title, placeholder: 'مثال: سيارتي البيضاء', attrs: 'maxlength="45"' }) +
        UI.selectField({ name: 'gate', label: 'أقرب بوابة', options: [['', 'اختر البوابة'], ...config.gates.map(g => [g, g]), ['other', 'بوابة أخرى']], value: pk.gate }) +
        (pk.gate === 'other' ? UI.field({ name: 'otherGate', label: 'اسم البوابة', value: pk.otherGate, placeholder: 'مثال: المدخل الشمالي', attrs: 'maxlength="60"' }) : '') +
        `<div class="a-grid2">${UI.selectField({ name: 'level', label: 'الدور · اختياري', options: [['', 'اختر الدور'], ...config.levels.map(l => [l, l])], value: pk.level })}${UI.field({ name: 'number', label: 'رقم الموقف', value: pk.number, placeholder: 'مثال: B15', attrs: 'dir="ltr" maxlength="16"' })}</div>` +
        (pk.area ? `<p class="fh-footnote">المنطقة المحفوظة سابقًا: ${esc(pk.area)}</p>` : '') +
        UI.field({ name: 'notes', label: 'علامة تساعد المندوب · اختياري', value: e.notes, placeholder: 'مثال: بجانب المصعد، سيارة بيضاء', attrs: 'maxlength="120"' });
    const html = `<h2 class="a-title fh-editor-title">${home ? 'عنوان المنزل' : 'موقف السيارة'}</h2>
      <p class="fh-lead">ضع العلامة على الخريطة، أو استخدم موقعك، أو اكتب ${home ? 'العنوان' : 'البوابة ورقم الموقف'}. يمكنك الحفظ بأي منها.</p>` +
      map + form('fh-place', fields) +
      (e.id ? `<div class="fh-inline-actions center">${link(ic('trash-2') + ' حذف هذا المكان', 'fh-place-delete')}</div>` : '') +
      `<p class="fh-footnote">الخرائط من OpenStreetMap، وتُقرأ تفاصيل العنوان عبر Photon عند توفرها. التحقق من العنوان الوطني غير مفعّل.</p>`;
    const view = page(e.id ? 'تعديل المكان' : 'مكان جديد', html, submit(ic('bookmark-check') + ' حفظ المكان'), null);
    view.header = `<div class="a-pagehead"><button type="button" class="a-iconbtn clear" data-action="places-cancel" aria-label="رجوع">${ic('arrow-right')}</button><h1>${e.id ? 'تعديل المكان' : 'مكان جديد'}</h1><span class="a-spacer"></span></div>`;
    return view;
  };

  // Keep typed values in state so device-location and map updates never erase them.
  function captureEditor(target) {
    const e = editor();
    if (!e || !target.closest('[data-form="fh-place"]')) return;
    const { name, value } = target;
    if (name === 'title') e.title = value.slice(0, 45);
    else if (name === 'notes') e.notes = value.slice(0, 120);
    else if (e.type === 'home' && ['city', 'district', 'street', 'building', 'unit', 'short'].includes(name)) {
      V.checkout.details[name] = name === 'short' ? value.toUpperCase() : value;
      if (name === 'city') { V.checkout.city = value; V.checkout.cityManuallyChosen = true; }
    } else if (e.type === 'parking' && ['gate', 'otherGate', 'level', 'number'].includes(name)) V.checkout.parkingDetails[name] = value;
  }
  F.$('#phone-app').addEventListener('input', e => captureEditor(e.target));
  F.$('#phone-app').addEventListener('change', e => {
    if (!e.target.closest('[data-form="fh-place"]')) return;
    captureEditor(e.target);
    if (e.target.name === 'gate' || (e.target.name === 'city' && !L.editorStatus().coordinates)) {
      const name = e.target.name;
      UI.rerender();
      F.$(`[name="${name}"]`)?.focus();
    }
  });
  // A tap on the map places the pin and starts the address lookup immediately; saving never waits for it.
  F.$('#phone-app').addEventListener('pointerup', e => {
    if (!e.target.closest('#delivery-map') || F.s.route !== 'place-editor') return;
    setTimeout(() => { if (F.s.route === 'place-editor' && L.editorStatus().pending) F.actions['location-pin'](); }, 80);
  });
  F.actions['fh-place-clear-pin'] = () => {
    if (V.checkout.destination === 'home') delete V.checkout.coordinates; else delete V.checkout.parkingCoordinates;
    L.cancelEditor();
    UI.rerender();
  };

  F.forms['fh-place'] = () => {
    const e = editor();
    if (!e || A.session?.role !== 'customer') return;
    const coords = L.acceptEditorPin();
    const home = e.type === 'home';
    const d = V.checkout.details;
    const pk = V.checkout.parkingDetails;
    const t = (v, n = 80) => String(v || '').trim().slice(0, n);
    let p;
    if (home) {
      const parts = { district: t(d.district), street: t(d.street), building: t(d.building, 10), unit: t(d.unit, 15), short: t(d.short, 8).toUpperCase() };
      if (!d.city) return F.toast('اختر المدينة من القائمة.', true);
      if (parts.short && !/^[A-Z]{4}\d{4}$/.test(parts.short)) return F.toast('العنوان المختصر 4 أحرف إنجليزية و4 أرقام، مثل RRRD1234.', true);
      const typed = parts.district && parts.street && parts.building;
      if (!coords && !typed && !e.legacy) return F.toast('ضع العلامة على الخريطة، أو أكمل الحي والشارع ورقم المبنى.', true);
      const address = L.composed(parts) || e.legacy || 'نقطة المنزل على الخريطة';
      p = { type: 'home', city: d.city, address, details: { ...parts, city: d.city, notes: t(e.notes, 120) }, mall: null, gate: '', area: '', level: '', number: '' };
    } else {
      const gate = pk.gate === 'other' ? t(pk.otherGate, 60) : pk.gate;
      if (!coords && (!gate || !t(pk.number))) return F.toast('ضع علامة السيارة على الخريطة، أو اختر البوابة وأدخل رقم الموقف.', true);
      const mall = V.get('malls', e.mall) || V.mall();
      p = { type: 'parking', city: mall.city, address: '', details: {}, mall: mall.id, gate, level: pk.level || '', area: pk.area || '', number: t(pk.number, 16) };
    }
    Object.assign(p, {
      id: e.id || 'place-' + crypto.randomUUID(),
      title: t(e.title, 45) || (home ? 'المنزل' : 'موقف سيارتي'),
      coordinates: coords ? clone(coords) : null, notes: t(e.notes, 120), updatedAt: new Date().toISOString()
    });
    const data = placesData();
    const index = data.places.findIndex(x => x.id === p.id);
    if (index >= 0) data.places[index] = p; else data.places.push(p);
    if (SP.eligible(p)) data.selected[UI.mallId()] = p.id;
    if (!writePlaces(data)) return;
    const method = e.prior?.paymentMethod;
    F.s.placeEditor = null;
    L.cancelEditor();
    if (SP.eligible(p)) { SP.apply(p); if (method) V.checkout.paymentMethod = method; }
    else V.checkout = e.prior;
    F.s.savedPlace = p.id;
    setTimeout(() => { F.s.savedPlace = null; }, 1500);
    if (e.returnTo === 'destination' && SP.eligible(p)) {
      F.stack = [{ route: 'bags', role: 'customer' }, { route: 'destination', role: 'customer' }];
      F.go('review', { replace: true });
      F.toast('تم حفظ المكان واختياره لهذا الطلب');
    } else {
      F.stack = [];
      F.go(e.returnTo === 'destination' ? 'destination' : 'saved-places', { replace: true });
      F.toast('تم حفظ المكان. لن تحتاج لإدخاله من جديد.');
    }
  };

  F.actions['places-cancel'] = () => {
    const e = editor();
    if (e) V.checkout = clone(e.prior);
    F.s.placeEditor = null;
    L.cancelEditor();
    F.go(e?.returnTo || 'saved-places', { replace: true });
  };
  F.actions['fh-place-delete'] = () => F.sheet('حذف المكان؟', '<p class="fh-sheet-text">يُحذف من أماكنك المحفوظة. الطلبات المؤكدة تحتفظ بعنوانها كما كان عند الطلب.</p>',
    b('حذف المكان', 'fh-place-delete-confirm', 'danger') + b('تراجع', 'close-sheet', 'secondary'));
  F.actions['fh-place-delete-confirm'] = () => {
    const e = editor();
    if (!e?.id) return;
    const data = placesData();
    data.places = data.places.filter(p => p.id !== e.id);
    for (const [mall, id] of Object.entries(data.selected)) if (id === e.id) delete data.selected[mall];
    if (!writePlaces(data)) return;
    V.checkout = clone(e.prior);
    if (V.checkout.savedPlaceId === e.id) V.checkout = { destination: 'parking', city: V.mall()?.city || '', address: '', carrier: '' };
    F.s.placeEditor = null;
    L.cancelEditor();
    F.closeSheet();
    F.go(e.returnTo, { replace: true });
    F.toast('تم حذف المكان');
  };

  /* ---------- Checkout: place → review & pay ---------- */
  const checkoutSteps = n => UI.steps(['مكان التسليم', 'المراجعة والدفع'], n);
  const carriers = () => V.data.carriers.filter(c => c.mall === UI.mallId() && c.active && c.coverage.split(/[,،]/).map(L.normalize).includes(V.checkout.city));
  const carrier = () => carriers().find(c => c.id === V.checkout.carrier);
  const serviceTotal = () => V.fee + (SP.selected()?.type === 'home' ? (carrier()?.fee || 0) : 0);

  F.actions['visit-finish'] = () => {
    if (!UI.collectItems().length || UI.openOrder()) return F.render();
    const p = SP.selected();
    if (p && V.checkout.savedPlaceId !== p.id) { const method = V.checkout.paymentMethod; SP.apply(p); if (method) V.checkout.paymentMethod = method; }
    F.s.placeFlow = { purpose: 'checkout', returnTo: 'bags' };
    F.go('destination');
  };

  F.views.destination = () => {
    const m = V.mall();
    if (!m) return F.views.malls();
    const items = UI.collectItems(m.id);
    if (!items.length || UI.openOrder(m.id)) return F.views.bags();
    const all = placesData().places;
    const list = all.filter(SP.eligible);
    const hidden = all.length - list.length;
    const storeCount = new Set(items.map(i => i.store)).size;
    const html = checkoutSteps(0) +
      `<h2 class="a-title">أين نسلّمك المشتريات؟</h2><p class="fh-lead">${UI.count(items.length, 'invoice')} من ${UI.count(storeCount, 'store')} في ${esc(m.name)}.</p>` +
      (list.length
        ? `<div class="fh-option-list">${list.map(p => placeCard(p, { pick: true })).join('')}</div>` + b(ic('plus') + ' إضافة مكان جديد', 'fh-place-add', 'secondary')
        : `<div class="fh-option-list">${V.select('إلى المنزل', 'fh-place-new', 'home', false, 'house', `أضف عنوانك · الجمع ${UI.cash(V.fee)} + رسوم شركة التوصيل`)}${V.select('عند سيارتك في المول', 'fh-place-new', 'parking', false, 'car-front', `أضف البوابة ورقم الموقف · ${UI.cash(V.fee)}`)}</div>`) +
      (hidden ? `<p class="fh-footnote">${ic('info')}<span>مواقف المولات الأخرى لا تظهر هنا (${UI.num(hidden)}).</span></p>` : '');
    return page('مكان التسليم', html, SP.selected() ? b(`المتابعة بـ«${esc(SP.selected().title)}» ${ic('arrow-left')}`, 'fh-place-continue') : '', 'bags');
  };

  function pickPlace(id) {
    const keep = V.checkout.savedPlaceId === id && SP.selected()?.id === id;
    if (!keep) {
      const method = V.checkout.paymentMethod;
      if (!SP.selectPlace(id)) return false;
      if (method) V.checkout.paymentMethod = method;
    }
    return true;
  }
  F.actions['fh-place-pick'] = btn => { if (pickPlace(btn.dataset.id)) F.go('review'); };
  F.actions['fh-place-continue'] = () => { const p = SP.selected(); if (p && pickPlace(p.id)) F.go('review'); };
  F.actions['places-select'] = F.actions['fh-place-pick'];

  const methods = [
    { id: 'apple', label: 'Apple Pay', sub: 'محاكاة · لا يُخصم مبلغ', icon: 'smartphone' },
    { id: 'mada', label: 'مدى أو بطاقة بنكية', sub: 'محاكاة · لا تُطلب بيانات بطاقة', icon: 'credit-card' }
  ];
  const method = () => methods.find(x => x.id === V.checkout.paymentMethod);

  F.views.review = F.views.payment = F.views['shipping-choice'] = () => {
    const m = V.mall();
    const p = SP.selected();
    const items = UI.collectItems();
    if (!m || !items.length || UI.openOrder()) return F.views.bags();
    if (!p || V.checkout.savedPlaceId !== p.id) return F.views.destination();
    const home = p.type === 'home';
    const list = home ? carriers() : [];
    const company = home ? carrier() : null;
    const groups = [...new Set(items.map(i => i.store))].map(id => [V.get('stores', id), items.filter(i => i.store === id)]);
    const html = checkoutSteps(1) +
      `<section class="a-card fh-review-block"><div class="fh-block-head"><h3>${ic(placeIcon(p))} ${home ? 'التوصيل إلى المنزل' : 'التسليم عند سيارتك'}</h3>${link('تغيير', 'go:destination')}</div>
        <strong>${esc(p.title)}</strong><p>${esc(placeSummary(p))}</p>${home ? '' : `<p class="fh-muted-small">${esc(m.name)}</p>`}</section>` +
      (home ? `<section class="fh-review-block plain" id="fh-carriers" tabindex="-1"><h3 class="fh-group-title">شركة التوصيل</h3>
        ${list.length ? `<div class="fh-option-list" role="radiogroup" aria-label="شركة التوصيل">${list.map(c => `<button type="button" class="fh-choice" role="radio" data-action="fh-carrier" data-id="${esc(c.id)}" aria-checked="${c.id === V.checkout.carrier}">
            <span class="fh-icon-tile">${ic('truck')}</span><span><strong>${esc(c.name)}</strong><small>${ic('clock-3')} ${esc(c.eta)}</small></span><b>${UI.cash(c.fee)}</b><i class="fh-radio" aria-hidden="true"></i></button>`).join('')}</div>
          ${list.some(c => c.example) ? '<p class="fh-footnote">أسماء الشركات والأسعار والمدد أمثلة للعرض، دون حجز شحنة فعلية.</p>' : ''}`
        : UI.callout('triangle-alert', 'لا توجد شركة تغطي هذه المدينة', `لا توجد شركة توصيل مفعّلة إلى ${esc(p.city)} لدى ${esc(m.name)}. اختر مكانًا آخر أو التسليم عند سيارتك.`, 'warn')}</section>` : '') +
      `<section class="a-card fh-review-block"><div class="fh-block-head"><h3>${ic('receipt-text')} المشتريات</h3><span class="fh-muted-small">${UI.count(items.length, 'invoice')}</span></div>
        ${groups.map(([s, list2]) => UI.line(esc(s?.name || 'متجر') + ` <small>${UI.count(list2.reduce((n, i) => n + i.bags, 0), 'bag')}</small>`, UI.cash(V.sum(list2)))).join('')}
        <p class="fh-paid-note">${ic('circle-check')}<span>مدفوعة للمتاجر (${UI.cash(V.sum(items))}) ولا تُحتسب في المبلغ المطلوب.</span></p></section>` +
      `<section class="a-card fh-review-block fh-total-block"><h3>${ic('wallet')} رسوم Free Hand</h3>
        ${UI.line(home ? 'جمع المشتريات' : 'الجمع والتسليم عند السيارة', UI.cash(V.fee))}
        ${home ? UI.line(company ? 'التوصيل · ' + esc(company.name) : 'التوصيل', company ? UI.cash(company.fee) : '<span class="fh-muted-small">اختر الشركة</span>') : ''}
        ${UI.line('المبلغ المطلوب الآن', home && !company ? '<span class="fh-muted-small">بعد اختيار الشركة</span>' : UI.cash(serviceTotal()), 'is-total')}</section>` +
      `<section class="fh-review-block plain" id="fh-methods" tabindex="-1"><h3 class="fh-group-title">طريقة الدفع <span class="fh-status demo">محاكاة</span></h3>
        <div class="fh-option-list" role="radiogroup" aria-label="طريقة الدفع">${methods.map(x => `<button type="button" class="fh-choice" role="radio" data-action="fh-method" data-id="${x.id}" aria-checked="${x.id === V.checkout.paymentMethod}">
          <span class="fh-icon-tile">${ic(x.icon)}</span><span><strong dir="auto">${x.label}</strong><small>${x.sub}</small></span><i class="fh-radio" aria-hidden="true"></i></button>`).join('')}</div>
        <p class="fh-footnote">${ic('shield-check')}<span>يتأكد الطلب بعد نجاح الدفع التجريبي فقط.</span></p></section>`;
    const cta = home && !company ? `${ic('truck')} اختر شركة التوصيل` : !method() ? `${ic('wallet')} اختر طريقة الدفع` : `${ic('lock')} ادفع ${UI.cash(serviceTotal())}`;
    return page('المراجعة والدفع', html, b(cta, 'fh-pay-open', 'fh-pay-cta'), 'bags');
  };
  F.actions['fh-carrier'] = btn => { V.checkout.carrier = btn.dataset.id; UI.rerender(); F.$(`[data-action="fh-carrier"][data-id="${btn.dataset.id}"]`)?.focus(); };
  F.actions['fh-method'] = btn => { if (!methods.some(x => x.id === btn.dataset.id)) return; V.checkout.paymentMethod = btn.dataset.id; UI.rerender(); F.$(`[data-action="fh-method"][data-id="${btn.dataset.id}"]`)?.focus(); };

  /* Simulated payment sheet: confirm → processing → success or failure. The order exists only after success. */
  const pay = { state: 'idle' };
  const closeSheet = F.closeSheet;
  F.closeSheet = () => { if (pay.state === 'processing') return; if (pay.state !== 'idle') pay.state = 'idle'; closeSheet(); };
  function paySheet() {
    const x = method();
    const amount = UI.cash(serviceTotal());
    const overlay = F.$('#app-overlay');
    const states = {
      confirm: `<div class="fh-pay-head"><span class="fh-icon-tile">${ic(x.icon)}</span><div><strong dir="auto">${x.label}</strong><small>دفع تجريبي · لن يُخصم أي مبلغ</small></div></div>
        <div class="fh-pay-amount"><small>Free Hand · رسوم الخدمة</small><strong>${amount}</strong></div>
        <div class="sheet-actions">${b(ic('fingerprint') + ' تأكيد الدفع', 'fh-pay-confirm')}${b('إلغاء', 'fh-pay-cancel', 'secondary')}</div>
        <button type="button" class="fh-text-btn fh-decline" data-action="fh-pay-decline">${ic('flask-conical')} للعرض: تجربة رفض الدفع</button>`,
      processing: `<div class="fh-pay-processing" role="status">${UI.spinner()}<strong>جارٍ تأكيد الدفع…</strong><small>لا تغلق الشاشة.</small></div>`,
      failed: `<div class="fh-pay-result is-failed" role="alert"><span>${ic('circle-x')}</span><strong>لم تتم عملية الدفع</strong><p>رُفضت الدفعة في المحاكاة. لم يُنشأ طلب ولم يُخصم مبلغ، وبيانات طلبك محفوظة.</p></div>
        <div class="sheet-actions">${b(ic('rotate-ccw') + ' إعادة المحاولة', 'fh-pay-retry')}${b('تغيير طريقة الدفع', 'fh-pay-change', 'secondary')}</div>`,
      error: `<div class="fh-pay-result is-failed" role="alert"><span>${ic('circle-alert')}</span><strong>تعذّر تأكيد الطلب</strong><p>لم يُنشأ طلب. راجع المشتريات ومكان التسليم ثم أعد المحاولة.</p></div>
        <div class="sheet-actions">${b('رجوع إلى المراجعة', 'fh-pay-cancel', 'secondary')}</div>`
    };
    overlay.innerHTML = `<section class="a-sheet fh-pay-sheet" role="dialog" aria-modal="true" aria-label="الدفع التجريبي"><div class="sheet-handle"></div>${states[pay.state]}</section>`;
    overlay.hidden = false;
    F.icons();
    overlay.querySelector('button')?.focus();
  }
  F.actions['fh-pay-open'] = () => {
    if (pay.state !== 'idle') return;
    const p = SP.selected();
    if (!p || V.checkout.savedPlaceId !== p.id) return F.go('destination');
    if (p.type === 'home' && !carrier()) { F.toast('اختر شركة التوصيل أولًا.', true); F.$('#fh-carriers')?.focus(); F.$('#fh-carriers')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (!method()) { F.toast('اختر طريقة الدفع أولًا.', true); F.$('#fh-methods')?.focus(); F.$('#fh-methods')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    pay.state = 'confirm';
    paySheet();
  };
  F.actions['fh-pay-cancel'] = () => { pay.state = 'idle'; closeSheet(); F.toast('أُلغي الدفع. لم يُنشأ طلب، واختياراتك محفوظة.'); };
  F.actions['fh-pay-change'] = () => { pay.state = 'idle'; closeSheet(); F.$('#fh-methods')?.focus(); F.$('#fh-methods')?.scrollIntoView({ block: 'center' }); };
  F.actions['fh-pay-retry'] = () => { pay.state = 'confirm'; paySheet(); };
  F.actions['fh-pay-decline'] = async () => {
    if (pay.state !== 'confirm') return;
    pay.state = 'processing'; paySheet();
    await UI.wait(1100);
    pay.state = 'failed'; paySheet();
  };
  F.actions['fh-pay-confirm'] = async () => {
    if (pay.state !== 'confirm') return;
    pay.state = 'processing'; paySheet();
    await UI.wait(1300);
    const before = V.data.orders.length;
    const p = SP.selected();
    const company = p?.type === 'home' ? carrier() : null;
    pay.state = 'idle';
    closeSheet();
    F.actions['visit-pay'](); // existing checks + single order creation
    if (V.data.orders.length === before + 1) {
      const o = V.data.orders.at(-1);
      Object.assign(o, {
        collectionFee: V.fee, carrierFee: company?.fee || 0, carrierEta: company?.eta || '',
        invoiceTotal: V.sum(V.data.invoices.filter(i => i.order === o.id)), paidAt: new Date().toISOString()
      });
      if (p?.type === 'parking') o.point = [placeSummary(p), p.notes].filter(Boolean).join('، ');
      V.save();
      F.s.visitOrderId = o.id;
      F.stack = [];
      F.go('order-success', { replace: true });
      F.toast('تم الدفع وتأكيد طلبك ' + o.id);
    } else {
      pay.state = 'error'; paySheet();
    }
  };

  /* ---------- Tracking ---------- */
  function statusTitle(o) {
    return { collecting: 'نجمع مشترياتك', ready: 'في الطريق إلى سيارتك', shipped: 'مع شركة التوصيل', delivered: 'تم التسليم', cancelled: 'أُلغي الطلب' }[o.status] || V.stage[o.status] || '';
  }
  UI.statusTitle = statusTitle;
  UI.issueTypes = { missing: 'نقص في عدد الأكياس', damaged: 'كيس متضرر', 'not-ready': 'الأكياس لم تُجهّز بعد', other: 'ملاحظة أخرى' };
  UI.failReasons = { unreachable: 'تعذّر التواصل مع العميل', address: 'العنوان غير واضح أو غير صحيح', absent: 'لا يوجد من يستلم', other: 'سبب آخر' };
  const orderPlace = o => o.deliveryPlace || { title: o.destination === 'home' ? 'المنزل' : 'موقف السيارة', type: o.destination, city: o.city, address: o.address, gate: o.point };
  const canCancel = o => o.status === 'collecting' && !o.stops.some(s => s.done) && !o.exception;

  function trackingView(success) {
    const orders = UI.myOrders();
    const o = orders.find(x => x.id === F.s.visitOrderId) || orders.at(-1);
    if (!o) return F.views.orders();
    const p = orderPlace(o);
    const home = o.destination === 'home';
    const done = o.stops.filter(s => s.done).length;
    const total = o.stops.length;
    const where = esc(placeSummary(p));
    const paid = methods.find(x => x.id === o.paymentMethod);
    const issues = o.stops.filter(s => s.issue);
    if (o.status === 'cancelled') {
      return page('تتبّع الطلب', `<section class="fh-track-hero is-closed"><div class="fh-row"><small>طلب <bdi dir="ltr">${esc(o.id)}</bdi> · ${esc(V.get('malls', o.mall)?.name || '')}</small><span class="fh-icon-tile">${ic('circle-x')}</span></div>
        <h2>أُلغي الطلب</h2><p>لم يُجمع شيء. عادت الفواتير إلى «المشتريات» ويمكنك طلب جمعها لاحقًا.</p></section>` +
        UI.callout('wallet', 'رسوم الخدمة', `${UI.cash(o.fee)} تُعاد إلى طريقة الدفع (محاكاة، دون خصم فعلي).`),
        b(ic('receipt-text') + ' العودة إلى المشتريات', 'go:bags', 'secondary'), 'orders');
    }
    const index = { collecting: 1, ready: 2, shipped: 2, delivered: 3 }[o.status] ?? 1;
    const info = {
      collecting: { now: done ? `استلمنا الأكياس من ${UI.num(done)} من أصل ${UI.count(total, 'store')}.` : `يبدأ فريق الجمع بالمرور على ${UI.count(total, 'store')}.`, next: home ? `نسلّم الأكياس إلى ${esc(o.carrier)} لتوصيلها إلى عنوانك.` : 'نوصل الأكياس إلى سيارتك في الموقف المحدد.', you: 'لا يلزمك شيء الآن. نخبرك هنا عند كل خطوة.' },
      ready: { now: 'اكتمل الجمع، والمندوب متوجّه إلى سيارتك.', next: 'تسليم الأكياس عند سيارتك.', you: `كن قرب سيارتك في ${where}، وتحقق من عدد الأكياس عند الاستلام.` },
      shipped: { now: `${esc(o.carrier)} استلمت الطلب${o.carrierEta ? ' · التوصيل ' + esc(o.carrierEta) : ''}.`, next: 'التوصيل إلى عنوانك.', you: 'تأكد من وجود من يستلم الطلب على العنوان.' },
      delivered: { now: 'سُلّمت مشترياتك بعد تأكيد المندوب.', next: '', you: '' }
    }[o.status] || { now: '', next: '', you: '' };
    if (o.exception) Object.assign(info, { now: 'تعذّر التسليم في المحاولة الأخيرة.', next: 'يعيد فريقنا جدولة التسليم ويحاول مرة أخرى.', you: o.exception.reason === 'address' ? 'راجع عنوان التسليم المسجّل في الطلب، وكن متاحًا للاتصال.' : 'كن متاحًا للاتصال، وأبقِ من يستلم الطلب قريبًا.' });
    const stages = [
      ['receipt-text', 'تم الدفع وتأكيد الطلب', paid ? `${UI.cash(o.fee)} عبر ${paid.label} (محاكاة)` : `رسوم الخدمة ${UI.cash(o.fee)}`],
      ['shopping-bag', 'جمع المشتريات من المتاجر', `${UI.num(done)} من ${UI.num(total)}`],
      home ? ['truck', 'الشحن مع ' + esc(o.carrier || 'شركة التوصيل'), o.carrierEta ? esc(o.carrierEta) : 'بعد اكتمال الجمع'] : ['car-front', 'التوصيل إلى سيارتك', 'بعد اكتمال الجمع'],
      ['package-check', 'تم التسليم', o.status === 'delivered' ? 'اكتمل الطلب' : 'بعد تأكيد المندوب']
    ];
    const mapLink = p.coordinates ? `<a class="fh-map-link" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(p.coordinates.lat)}&amp;mlon=${encodeURIComponent(p.coordinates.lng)}#map=18/${encodeURIComponent(p.coordinates.lat)}/${encodeURIComponent(p.coordinates.lng)}">${ic('map-pinned')} عرض النقطة على الخريطة</a>` : '';
    const html = (success ? `<section class="fh-success" role="status"><span class="fh-success-check">${ic('check')}</span><div><strong>تم الدفع وتأكيد طلبك</strong><small>رقم الطلب <bdi dir="ltr">${esc(o.id)}</bdi></small></div></section>` : '') +
      `<section class="fh-track-hero${o.exception ? ' is-alert' : ''}" aria-live="polite"><div class="fh-row"><small>طلب <bdi dir="ltr">${esc(o.id)}</bdi> · ${esc(V.get('malls', o.mall)?.name || '')}</small><span class="fh-icon-tile">${ic(o.exception ? 'triangle-alert' : stages[index][0])}</span></div>
        <h2>${o.exception ? 'نعيد جدولة التسليم' : esc(statusTitle(o))}</h2><p>${info.now}</p>
        ${o.status === 'collecting' && total ? `<progress class="fh-collection-progress" value="${done}" max="${total}" aria-label="تقدّم الجمع: ${UI.num(done)} من ${UI.num(total)}"></progress>` : ''}</section>` +
      (info.next || info.you ? `<div class="fh-next-grid">${info.next ? `<div class="fh-next">${ic('arrow-left-circle')}<div><small>الخطوة التالية</small><p>${info.next}</p></div></div>` : ''}${info.you ? `<div class="fh-next is-you">${ic('user-round-check')}<div><small>المطلوب منك</small><p>${info.you}</p></div></div>` : ''}</div>` : '') +
      (issues.length ? UI.callout('triangle-alert', 'ملاحظة من فريق الجمع', issues.map(s => `${esc(V.get('stores', s.store)?.name || 'متجر')}: ${esc(UI.issueTypes[s.issue.type] || '')}${s.receivedBags != null ? ` (استلمنا ${UI.count(s.receivedBags, 'bag')} من ${UI.num(s.expectedBags)})` : ''}`).join('<br>') + '<br>نتابع مع المتجر، ونبلغك بالتحديث هنا.', 'warn') : '') +
      `<section class="a-card"><ol class="fh-timeline">${stages.map(([i, t, sub], n) => `<li class="${n < index || o.status === 'delivered' ? 'done' : n === index ? 'current' : ''}"${n === index ? ' aria-current="step"' : ''}><span>${ic(n < index || o.status === 'delivered' ? 'check' : i)}</span><div><strong>${t}</strong><small>${sub}</small></div></li>`).join('')}</ol></section>` +
      `<section class="a-card fh-review-block"><div class="fh-block-head"><h3>${ic(placeIcon(p))} ${home ? 'عنوان التوصيل' : 'مكان السيارة'}</h3><span class="fh-muted-small">كما عند الطلب</span></div>
        <strong>${esc(p.title)}</strong><p>${where}</p>${p.notes ? `<p class="fh-muted-small">${esc(p.notes)}</p>` : ''}
        ${home && o.carrier ? UI.line('شركة التوصيل', esc(o.carrier) + (o.carrierEta ? ` · ${esc(o.carrierEta)}` : '')) : ''}${mapLink}</section>` +
      `<details class="fh-details"><summary>المتاجر والرسوم</summary>
        ${o.stops.map(s => `<div class="fh-stop">${ic(s.done ? 'circle-check' : 'store')}<span>${esc(V.get('stores', s.store)?.name || 'المتجر')}</span>${UI.status(s.issue ? 'نتابع ملاحظة' : s.done ? 'تم الاستلام' : 'بانتظار الجمع', s.issue ? 'wait' : s.done ? 'ok' : 'wait')}</div>`).join('')}
        <hr>${o.collectionFee != null ? UI.line('الجمع', UI.cash(o.collectionFee)) + (home ? UI.line('التوصيل', UI.cash(o.carrierFee)) : '') : ''}${UI.line('المدفوع لـ Free Hand', UI.cash(o.fee), 'is-total')}</details>` +
      `<p class="fh-footnote">${ic('info')}<span>تتحدّث الحالة عندما يسجّل فريق الجمع أو المندوب خطوة جديدة. لا يوجد تتبّع مباشر لموقع المندوب في هذه النسخة.</span></p>`;
    const footer = success ? b('عرض طلباتي', 'go:orders', 'secondary') : canCancel(o) ? b(ic('circle-x') + ' إلغاء الطلب', 'fh-cancel-order', 'secondary', `data-id="${esc(o.id)}"`) : '';
    return page(success ? 'تم تأكيد الطلب' : 'تتبّع الطلب', html, footer, 'orders', !success);
  }
  F.views.tracking = () => trackingView(false);
  F.views['order-success'] = () => trackingView(true);
  F.actions['visit-open-order'] = btn => { F.s.visitOrderId = btn.dataset.id; F.go('tracking'); };

  // Cancelling is possible until the first store pickup; the receipts return to Purchases.
  F.actions['fh-cancel-order'] = btn => {
    const o = UI.myOrders().find(x => x.id === btn.dataset.id);
    if (!o || !canCancel(o)) return F.toast('لا يمكن إلغاء الطلب بعد بدء الاستلام من المتاجر.', true);
    F.sheet('إلغاء الطلب؟', `<p class="fh-sheet-text">لم يبدأ الاستلام بعد. تعود الفواتير إلى «المشتريات»، وتُعاد رسوم الخدمة ${UI.cash(o.fee)} (محاكاة).</p>`,
      b('نعم، ألغِ الطلب', 'fh-cancel-confirm', 'danger', `data-id="${esc(o.id)}"`) + b('تراجع', 'close-sheet', 'secondary'));
  };
  F.actions['fh-cancel-confirm'] = btn => {
    const o = UI.myOrders().find(x => x.id === btn.dataset.id);
    if (!o || !canCancel(o)) return;
    o.status = 'cancelled';
    o.cancelledAt = new Date().toISOString();
    V.data.invoices.filter(i => i.order === o.id).forEach(i => { i.order = null; });
    V.save();
    F.closeSheet();
    F.render();
    F.toast('أُلغي الطلب وعادت الفواتير إلى مشترياتك');
  };

  /* ---------- Orders ---------- */
  F.views.orders = () => {
    const orders = UI.myOrders().slice().reverse();
    const icon = o => o.status === 'cancelled' ? 'circle-x' : o.status === 'delivered' ? 'package-check' : o.destination === 'home' ? 'truck' : 'car-front';
    const row = o => `<button type="button" class="fh-order-row" data-action="visit-open-order" data-id="${esc(o.id)}">
      <span class="fh-icon-tile">${ic(icon(o))}</span>
      <span class="fh-order-details"><strong><bdi dir="ltr">${esc(o.id)}</bdi></strong><small>${esc(V.get('malls', o.mall)?.name || 'المول')} · ${o.destination === 'home' ? 'إلى المنزل' : 'عند السيارة'} · ${UI.cash(o.fee)}</small>${UI.status(esc(o.exception ? 'نعيد جدولة التسليم' : statusTitle(o)), o.exception ? 'error' : UI.isClosed(o) ? 'muted' : 'info')}</span>${ic('chevron-left')}</button>`;
    const active = orders.filter(o => !UI.isClosed(o));
    const previous = orders.filter(o => UI.isClosed(o));
    return page('الطلبات', orders.length
      ? (active.length ? UI.section('جارية الآن') + `<div class="fh-list">${active.map(row).join('')}</div>` : '') +
        (previous.length ? UI.section('السابقة') + `<div class="fh-list">${previous.map(row).join('')}</div>` : '')
      : UI.empty('route', 'لا طلبات بعد', 'بعد تأكيد طلب الجمع والدفع، يظهر هنا مع حالة التسليم.'),
      orders.length ? '' : b('عرض مشترياتي', 'go:bags', 'secondary'), 'orders', false);
  };

  /* ---------- Account: the phone number lives here, hidden until asked for ---------- */
  let showPhone = false;
  F.views.account = () => page('حسابي',
    `<section class="a-card fh-identity"><span class="fh-avatar big">${ic('user-round')}</span><div><strong>${esc(UI.fullName(F.s) || 'متسوّق Free Hand')}</strong><small>يراه الكاشير: ${esc(UI.shortName(F.s) || '—')}</small></div></section>` +
    `<section class="a-card fh-menu">${F.listButton('الاسم', 'user-round-pen', 'fh-edit-name', esc(UI.fullName(F.s) || 'أضف اسمك'))}
      <div class="fh-phone-row">${ic('smartphone')}<div><strong>رقم الجوال</strong><small><bdi dir="ltr">${esc(showPhone ? UI.phone(V.customer()) : '•••• ' + String(V.customer()).slice(-4))}</bdi> · لتسجيل الدخول وبحث الكاشير البديل</small></div><button type="button" class="fh-text-btn" data-action="fh-toggle-phone" aria-pressed="${showPhone}">${showPhone ? 'إخفاء' : 'إظهار'}</button></div>
      ${F.listButton('المول الحالي', 'building-2', 'go:malls', esc(V.mall()?.name || 'لم تختر مولًا'))}${F.listButton('أماكن التسليم', 'map-pin', 'go:saved-places')}${F.listButton('الطلبات', 'route', 'go:orders')}${F.listButton('كيف تعمل الخدمة؟', 'circle-help', 'fh-guide')}${F.listButton('أدوات العرض', 'flask-conical', 'fh-demo-tools')}</section>` +
    `<p class="fh-footnote">${ic('lock')}<span>تغيير رقم الجوال يتطلب تحققًا جديدًا ولا يتوفر في هذه النسخة التجريبية.</span></p>`,
    b(ic('log-out') + ' تسجيل الخروج', 'auth-logout', 'secondary'), null);
  F.actions['fh-toggle-phone'] = () => { showPhone = !showPhone; UI.rerender(); };

  F.actions['fh-edit-name'] = () => F.sheet('الاسم',
    form('fh-name', UI.field({ name: 'name', label: 'الاسم الأول', value: F.s.name || '', attrs: 'maxlength="35" autocomplete="given-name"' }) +
      UI.field({ name: 'lastName', label: 'اسم العائلة' + UI.optional, value: F.s.lastName || '', attrs: 'maxlength="35" autocomplete="family-name"' })),
    submit('حفظ الاسم') + b('إلغاء', 'close-sheet', 'secondary'));
  F.forms['fh-name'] = d => {
    if (A.session?.role !== 'customer') return;
    const name = String(d.name || '').trim().slice(0, 35);
    const lastName = String(d.lastName || '').trim().slice(0, 35);
    if (name.length < 2) return UI.showErrors({ name: 'اكتب اسمك الأول (حرفان على الأقل).' });
    Object.assign(F.s, { name, lastName });
    A.session.name = name;
    if (A.model.records[A.session.id]) Object.assign(A.model.records[A.session.id], { name, lastName });
    if (V.data.visits[V.customer()]) { V.data.visits[V.customer()].name = name; V.save(); }
    F.closeSheet(); F.render(); F.toast('تم حفظ الاسم');
  };

  F.tabs.customer = [['stores', 'الرئيسية', 'house'], ['bags', 'المشتريات', 'receipt-text'], ['orders', 'الطلبات', 'route'], ['saved-places', 'الأماكن', 'map-pin']];

  // Clear transient sign-in errors and stop the code timer when leaving those screens.
  const render = F.render;
  F.render = animate => {
    if (!['login', 'otp'].includes(F.s.route)) { phoneError = ''; codeError = ''; }
    if (A.session?.role !== 'customer') showPhone = false;
    render(animate);
  };
  F.render();
})();
