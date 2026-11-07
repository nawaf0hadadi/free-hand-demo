/* Free Hand shell: shared formatting, data migration, app bar, mobile viewport and demo tools.
   Loaded after design.js and before shopper.js / business.js. */
(() => {
  'use strict';
  const F = window.FH;
  const A = F.Access;
  const V = F.Visit;
  const { ic, esc, b } = F;
  const UI = F.UI = {};

  /* ---------- Formatting ---------- */
  const nf = new Intl.NumberFormat('ar-SA-u-nu-latn', { maximumFractionDigits: 2 });
  UI.num = n => nf.format(Number(n) || 0);
  const nf2 = new Intl.NumberFormat('ar-SA-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  UI.cash = n => `<bdi class="fh-money">${Number(n) % 1 ? nf2.format(n) : UI.num(n)} ر.س</bdi>`;
  UI.latin = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  UI.ltr = s => `<bdi dir="ltr">${esc(s)}</bdi>`;
  UI.iso = s => `<bdi>${esc(s)}</bdi>`; // isolates mixed Arabic/Latin values such as «الأول · B14»
  UI.phone = p => {
    const d = String(p || '');
    return /^05\d{8}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : d;
  };
  // Arabic count phrases: 1 → singular, 2 → dual, 3–10 → plural, 11+ → singular accusative.
  const nouns = {
    invoice: ['فاتورة واحدة', 'فاتورتان', 'فواتير', 'فاتورة'],
    bag: ['كيس واحد', 'كيسان', 'أكياس', 'كيسًا'],
    store: ['متجر واحد', 'متجران', 'متاجر', 'متجرًا'],
    order: ['طلب واحد', 'طلبان', 'طلبات', 'طلبًا'],
    request: ['طلب واحد', 'طلبان', 'طلبات', 'طلبًا'],
    mall: ['مول واحد', 'مولان', 'مولات', 'مولًا'],
    carrier: ['شركة واحدة', 'شركتان', 'شركات', 'شركة'],
    gate: ['بوابة واحدة', 'بوابتان', 'بوابات', 'بوابة'],
    place: ['مكان واحد', 'مكانان', 'أماكن', 'مكانًا']
  };
  // Dual after a preposition (من، على، إلى) takes the genitive form: «من متجرين».
  const genitiveDual = { invoice: 'فاتورتين', bag: 'كيسين', store: 'متجرين', order: 'طلبين', request: 'طلبين', mall: 'مولين', carrier: 'شركتين', gate: 'بوابتين', place: 'مكانين' };
  UI.count = (n, noun, afterPreposition = false) => {
    const [one, two, few, many] = nouns[noun];
    n = Number(n) || 0;
    if (n === 0) return `0 ${few}`;
    if (n === 1) return one;
    if (n === 2) return afterPreposition ? genitiveDual[noun] : two;
    const r = n % 100;
    return `${UI.num(n)} ${r >= 3 && r <= 10 ? few : many}`;
  };

  UI.mark = (size = 32) => `<img class="fh-mark" src="assets/brand/free-hand-icon.svg" width="${size}" height="${size}" alt="">`;
  UI.brand = (size = 34) => `<span class="fh-brand" dir="ltr">${UI.mark(size)}<strong>Free <span>Hand</span></strong></span>`;

  /* Fields with hint and error text wired to aria-describedby. */
  UI.field = ({ name, label, value = '', placeholder = '', type = 'text', attrs = '', hint = '', error = '' }) => {
    const id = 'f-' + name;
    const described = [hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ');
    return `<label class="a-field fh-field${error ? ' has-error' : ''}" for="${id}"><span class="fh-label">${label}</span>
      <input id="${id}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}${described ? ` aria-describedby="${described}"` : ''}${error ? ' aria-invalid="true"' : ''}>
      ${hint ? `<small class="fh-hint" id="${id}-hint">${hint}</small>` : ''}${error ? `<small class="fh-field-error" id="${id}-error">${ic('circle-alert')}${error}</small>` : ''}</label>`;
  };
  UI.selectField = ({ name, label, options, value = '', hint = '', attrs = '' }) => {
    const id = 'f-' + name;
    return `<label class="a-field fh-field" for="${id}"><span class="fh-label">${label}</span><select id="${id}" name="${name}" ${attrs}${hint ? ` aria-describedby="${id}-hint"` : ''}>${options.map(([v, l]) => `<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint ? `<small class="fh-hint" id="${id}-hint">${hint}</small>` : ''}</label>`;
  };
  UI.textarea = ({ name, label, value = '', placeholder = '', attrs = '', hint = '' }) => {
    const id = 'f-' + name;
    return `<label class="a-field fh-field" for="${id}"><span class="fh-label">${label}</span><textarea id="${id}" name="${name}" placeholder="${esc(placeholder)}" ${attrs}${hint ? ` aria-describedby="${id}-hint"` : ''}>${esc(value)}</textarea>${hint ? `<small class="fh-hint" id="${id}-hint">${hint}</small>` : ''}</label>`;
  };
  UI.optional = ' <span class="fh-optional">اختياري</span>';
  UI.requiredNote = '<p class="fh-form-note">كل الحقول مطلوبة ما لم يُذكر «اختياري».</p>';

  /* In-place field errors: shown beside each field without re-rendering, so typed values,
     chosen files and passwords stay in the form. Cleared as soon as the field changes. */
  UI.clearErrors = (scope = document) => {
    scope.querySelectorAll('.fh-field-error.is-dynamic').forEach(el => el.remove());
    scope.querySelectorAll('[data-fh-invalid]').forEach(el => {
      el.removeAttribute('aria-invalid');
      el.removeAttribute('data-fh-invalid');
      const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(x => x && !x.startsWith('err-'));
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
      el.closest('.has-error')?.classList.remove('has-error');
    });
  };
  UI.showErrors = (errors, { form: formSel = '#app-form', toast = true } = {}) => {
    const formEl = document.querySelector(formSel);
    if (!formEl) return 0;
    UI.clearErrors(formEl);
    let first = null;
    const unseen = [];
    for (const [name, message] of Object.entries(errors)) {
      const el = formEl.querySelector(`[name="${name}"]`);
      if (!el) { unseen.push(message); continue; }
      const wrap = el.closest('.a-check') || el.closest('.fh-field, .a-field') || el.parentElement;
      wrap.classList.add('has-error');
      const note = document.createElement('small');
      note.className = 'fh-field-error is-dynamic';
      note.id = 'err-' + name;
      note.innerHTML = ic('circle-alert') + esc(message);
      if (wrap.matches('.a-check')) wrap.after(note); else wrap.appendChild(note);
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('data-fh-invalid', '');
      const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter(x => x && !x.startsWith('err-'));
      el.setAttribute('aria-describedby', [...ids, note.id].join(' '));
      first ||= el;
    }
    F.icons();
    const count = Object.keys(errors).length;
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    // A message whose field is not on screen is never dropped silently.
    if (unseen.length) F.toast(unseen[0], true);
    else if (toast && count) F.toast(count === 1 ? 'راجع الحقل المظلّل.' : `راجع الحقول المظلّلة (${UI.num(count)}).`, true);
    return count;
  };
  const clearOne = e => {
    const el = e.target;
    if (!el.hasAttribute?.('data-fh-invalid')) return;
    const wrap = el.closest('.a-check') || el.closest('.fh-field, .a-field');
    document.getElementById('err-' + el.name)?.remove();
    el.removeAttribute('aria-invalid');
    el.removeAttribute('data-fh-invalid');
    wrap?.classList.remove('has-error');
  };
  // Capture on document: access.js stops password input events at #phone-app so they never reach drafts.
  document.addEventListener('input', clearOne, true);
  document.addEventListener('change', clearOne, true);

  /* Password rules shared by every flow that creates or changes a password. */
  UI.passwordErrors = (password, confirm, names = ['password', 'confirm']) => {
    const errors = {};
    if (!A.passwordValid(password)) errors[names[0]] = 'استخدم 8 أحرف على الأقل، تتضمن حرفًا ورقمًا.';
    if (!confirm) errors[names[1]] = 'أعد كتابة كلمة المرور للتأكيد.';
    else if (password !== confirm) errors[names[1]] = 'كلمتا المرور غير متطابقتين. أعد كتابة التأكيد.';
    return errors;
  };
  UI.status = (label, tone = '') => `<span class="fh-status ${tone}">${label}</span>`;
  UI.callout = (icon, title, body, tone = '') => `<div class="fh-callout ${tone}">${ic(icon)}<div><strong>${title}</strong>${body ? `<p>${body}</p>` : ''}</div></div>`;
  UI.empty = (icon, title, body, action = '') => `<div class="fh-empty"><span class="fh-empty-icon">${ic(icon)}</span><h2>${title}</h2><p>${body}</p>${action}</div>`;
  UI.section = (title, extra = '') => `<div class="fh-section-head"><h3>${title}</h3>${extra}</div>`;
  UI.line = (label, value, cls = '') => `<div class="fh-line ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
  UI.steps = (labels, index) => `<ol class="fh-steps" aria-label="خطوات الطلب">${labels.map((t, i) => `<li class="${i === index ? 'current' : i < index ? 'done' : ''}"${i === index ? ' aria-current="step"' : ''}><span>${i < index ? ic('check') : UI.num(i + 1)}</span>${t}</li>`).join('')}</ol>`;
  UI.spinner = () => '<span class="fh-spinner" aria-hidden="true"></span>';

  /* Disables the visible primary action while async work runs. Returns false if already busy. */
  let busy = false;
  UI.isBusy = () => busy;
  UI.busy = async (label, fn) => {
    if (busy) return false;
    busy = true;
    const buttons = [...document.querySelectorAll('#app-cta button')];
    const primary = buttons[0];
    const caption = primary?.innerHTML;
    buttons.forEach(x => { x.disabled = true; });
    if (primary) { primary.innerHTML = UI.spinner() + `<span>${label}</span>`; primary.setAttribute('aria-busy', 'true'); }
    try { await fn(); return true; }
    finally {
      busy = false;
      if (primary?.isConnected) { primary.innerHTML = caption; primary.removeAttribute('aria-busy'); buttons.forEach(x => { x.disabled = false; }); F.icons(); }
    }
  };
  UI.wait = ms => new Promise(r => setTimeout(r, ms));
  // Re-render the same screen without jumping back to the top (choices lower on the page).
  UI.rerender = () => {
    const screen = F.$('#app-screen');
    const top = screen.scrollTop;
    F.render();
    screen.scrollTop = top;
  };

  /* ---------- Data migration (schema 2) ----------
     Changes are additive: old orders, receipts, saved places and attachments stay readable.
     - Carrier ETAs and mall service points use Western digits.
     - Malls get parking information (gates and levels) used by the car-delivery editor. */
  const parkingDefaults = {
    front: { gates: ['البوابة أ', 'البوابة ب', 'البوابة ج'], levels: ['الدور الأرضي', 'القبو B1', 'القبو B2'] },
    garden: { gates: ['بوابة 1', 'بوابة 2', 'بوابة 3'], levels: ['المواقف الخارجية', 'القبو'] }
  };
  UI.parkingDefaults = { gates: ['البوابة الرئيسية', 'البوابة الشمالية', 'البوابة الجنوبية'], levels: ['الدور الأرضي', 'القبو'] };
  UI.migrate = data => {
    if (data.schema >= 2) return false;
    for (const c of data.carriers) { c.eta = UI.latin(c.eta); }
    for (const m of data.malls) {
      m.point = UI.latin(m.point);
      if (!m.parkingConfig) m.parkingConfig = JSON.parse(JSON.stringify(parkingDefaults[m.id] || UI.parkingDefaults));
    }
    for (const s of data.stores) { if (s.floor) s.floor = UI.latin(s.floor); }
    data.schema = 2;
    return true;
  };
  if (UI.migrate(V.data)) V.save();
  UI.parkingFor = mall => mall?.parkingConfig || UI.parkingDefaults;

  /* ---------- Simple helpers shared by both layers ---------- */
  UI.mallId = () => V.mall()?.id || '';
  UI.myOrders = () => V.data.orders.filter(o => o.phone === A.session?.phone);
  UI.isClosed = o => ['delivered', 'cancelled'].includes(o?.status);
  UI.openOrder = (mallId = UI.mallId()) => UI.myOrders().find(o => o.mall === mallId && !UI.isClosed(o));
  UI.myInvoices = (mallId = UI.mallId()) => V.data.invoices.filter(i => i.phone === A.session?.phone && i.mall === mallId && !i.order);
  UI.isReady = i => i.ready !== false; // receipts saved before bag readiness existed count as ready

  /* ---------- Shopper pass (QR and short code) ----------
     Identifies one shopper at one mall for a short time. The QR carries only "FH1:<code>" —
     no name, number or account id. A code expires after 10 minutes and is consumed when a
     store links a receipt with it, so a captured code cannot be replayed later. */
  const PASS_TTL = 10 * 60 * 1000;
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  V.data.passes ||= [];
  const randomCode = () => { const bytes = crypto.getRandomValues(new Uint8Array(8)); return [...bytes].map(x => alphabet[x % alphabet.length]).join(''); };
  UI.pass = {
    ttl: PASS_TTL,
    format: code => code ? code.slice(0, 4) + '-' + code.slice(4) : '',
    payload: code => 'FH1:' + code,
    // Accepts a scanned payload or a typed code (with or without the dash, any case).
    parse: text => { const raw = String(text || '').trim().toUpperCase().replace(/^FH1:/, '').replace(/[\s-]/g, ''); return /^[2-9A-HJ-NP-Z]{8}$/.test(raw) ? raw : null; },
    current(phone, mallId) {
      const now = Date.now();
      return V.data.passes.find(p => p.phone === phone && p.mall === mallId && !p.usedAt && p.expiresAt > now) || null;
    },
    issue(phone, mallId) {
      const now = Date.now();
      // Drop this shopper's old passes for the mall and anything long expired.
      V.data.passes = V.data.passes.filter(p => !(p.phone === phone && p.mall === mallId) && p.expiresAt > now - 24 * 3600 * 1000);
      const pass = { code: randomCode(), phone, mall: mallId, issuedAt: now, expiresAt: now + PASS_TTL, usedAt: null };
      V.data.passes.push(pass);
      V.save();
      return pass;
    },
    ensure(phone, mallId) { return UI.pass.current(phone, mallId) || UI.pass.issue(phone, mallId); },
    // Result for a store at mallId: { pass } or { error }.
    check(text, mallId) {
      const code = UI.pass.parse(text);
      if (!code) return { error: 'format' };
      const pass = V.data.passes.find(p => p.code === code);
      if (!pass) return { error: 'unknown' };
      if (pass.usedAt) return { error: 'used' };
      if (pass.expiresAt <= Date.now()) return { error: 'expired' };
      if (pass.mall !== mallId) return { error: 'mall' };
      return { pass };
    },
    consume(code) { const pass = V.data.passes.find(p => p.code === code); if (pass && !pass.usedAt) { pass.usedAt = Date.now(); V.save(); } }
  };
  UI.passErrors = {
    format: 'الرمز 8 خانات من حروف وأرقام، مثل 7K3M-Q9XA.',
    unknown: 'الرمز غير صحيح. تأكد منه أو ابحث برقم الجوال.',
    used: 'استُخدم هذا الرمز من قبل. اطلب من العميل فتح رمزه من جديد.',
    expired: 'انتهت صلاحية الرمز. اطلب من العميل تحديثه من التطبيق.',
    mall: 'هذا الرمز صادر لمول آخر.'
  };
  UI.qrSvg = (text, size = 220) => {
    if (!window.qrcode) return '';
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    const cell = Math.max(2, Math.floor(size / (q.getModuleCount() + 8)));
    return q.createSvgTag({ cellSize: cell, margin: cell * 4, scalable: true, alt: 'رمز QR للتعريف بالمتسوّق' });
  };
  UI.qrDataUrl = (text, cell = 8) => { const q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createDataURL(cell, cell * 4); };
  const loaded = {};
  UI.loadScript = src => loaded[src] ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => { delete loaded[src]; reject(new Error('load ' + src)); };
    document.head.appendChild(s);
  });

  /* Shopper names: first name (required) and last name (optional). */
  UI.fullName = r => [r?.name, r?.lastName].filter(Boolean).join(' ');
  UI.shortName = r => r?.name ? r.name + (r.lastName ? ' ' + r.lastName[0] + '.' : '') : '';

  /* Status wording for staff screens (the shopper screens speak to the shopper). */
  UI.staffStatus = o => (o?.exception ? ['يحتاج متابعة', 'error'] : ({
    collecting: ['قيد الجمع', 'info'], ready: ['في الطريق إلى السيارة', 'info'], shipped: ['مع شركة التوصيل', 'info'],
    delivered: ['مكتمل', 'muted'], cancelled: ['ملغى', 'muted']
  })[o?.status] || ['—', 'muted']);

  /* ---------- App bar ----------
     Tab screens: brand mark, screen title and context (active mall or organisation).
     Sub-screens: the back header only, so the content gets the space. */
  const roleNames = { customer: 'المتسوّق', mall: 'إدارة المول', merchant: 'المتجر', operations: 'فريق العمليات', delivery: 'شريك التوصيل', admin: 'إدارة Free Hand' };
  UI.roleNames = roleNames;
  function appBar() {
    const bar = F.$('#u-appbar');
    const app = F.$('#phone-app');
    const header = F.$('#app-header');
    const isRoot = !!A.session && !header.querySelector('[data-action="back"],[data-action="places-cancel"]') && !!F.$('#app-nav').children.length;
    app.classList.toggle('is-root', isRoot);
    app.classList.toggle('is-signed-in', !!A.session);
    if (!bar) return;
    if (!A.session || !isRoot) { bar.hidden = true; return; }
    const title = header.querySelector('h1')?.textContent || 'Free Hand';
    let context;
    if (A.session.role === 'customer') {
      const mall = V.mall();
      context = `<button type="button" class="fh-mall-chip" data-action="go:malls" aria-label="المول الحالي: ${esc(mall?.name || 'لم تختر مولًا')}. تغيير المول">${ic('map-pin')}<span>${esc(mall?.name || 'اختر المول')}</span>${ic('chevron-down')}</button>
        ${mall ? `<button type="button" class="fh-qr-chip" data-action="fh-my-code" aria-label="رمزي للكاشير">${ic('qr-code')}<span>رمزي</span></button>` : ''}
        <button type="button" class="fh-avatar" data-action="go:account" aria-label="حسابي">${ic('user-round')}</button>`;
    } else {
      context = `<button type="button" class="fh-org-chip" data-action="go:auth-account" aria-label="حساب ${esc(roleNames[A.session.role])}"><small>${esc(roleNames[A.session.role])}</small><span>${esc(A.session.organization || A.session.name || '')}</span></button>`;
    }
    bar.hidden = false;
    bar.className = 'fh-appbar';
    bar.innerHTML = `<div class="fh-appbar-title">${UI.mark(28)}<h1>${esc(title)}</h1></div><div class="fh-appbar-context">${context}</div>`;
  }

  /* ---------- Map fallback: tiles that never load show a clear manual-entry message. ---------- */
  let mapTimer = null;
  function watchMap() {
    clearTimeout(mapTimer);
    const el = F.$('#delivery-map');
    if (!el) return;
    if (!window.L) return;
    mapTimer = setTimeout(() => {
      const map = F.$('#delivery-map');
      if (!map || map.querySelector('.leaflet-tile-loaded') || map.querySelector('.fh-map-failed')) return;
      map.insertAdjacentHTML('beforeend', `<div class="fh-map-failed" role="status">${ic('map-pin-off')}<strong>تعذّر تحميل الخريطة</strong><span>أكمل العنوان يدويًا بالأسفل، ويمكنك الحفظ دون الخريطة.</span></div>`);
      F.icons();
    }, 6000);
  }

  /* ---------- Render wrapper ---------- */
  const render = F.render;
  F.render = function renderShell(animate) {
    render(animate);
    appBar();
    watchMap();
    // Toasts sit just above the action bar and tabs so they never cover the primary action.
    const app = F.$('#phone-app').getBoundingClientRect();
    const tops = ['#app-cta', '#app-nav'].map(s => F.$(s)).filter(el => el.offsetHeight).map(el => el.getBoundingClientRect().top);
    F.$('#phone-app').style.setProperty('--toast-bottom', Math.round(app.bottom - Math.min(app.bottom, ...tops) + 10) + 'px');
    F.$('#device').dataset.route = F.s.route;
    document.body.classList.toggle('fh-signed-out', !A.session);
    F.icons();
  };

  // Typed values are kept in state; save them shortly after typing so a reload keeps them too.
  let persistTimer = null;
  F.$('#phone-app').addEventListener('input', e => {
    if (e.target.type === 'password' || e.target.type === 'file') return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => A.persist?.(), 400);
  });

  /* ---------- Mobile viewport: keyboard and safe areas ---------- */
  const vv = window.visualViewport;
  function viewport() {
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', h + 'px');
    const keyboard = !!vv && window.matchMedia('(max-width: 640px)').matches && h < window.innerHeight * 0.78;
    document.body.classList.toggle('keyboard-open', keyboard);
  }
  if (vv) { vv.addEventListener('resize', viewport); vv.addEventListener('scroll', viewport); }
  window.addEventListener('resize', viewport);
  viewport();
  F.$('#phone-app').addEventListener('focusin', e => {
    if (!e.target.matches('input,select,textarea')) return;
    setTimeout(() => { if (document.body.classList.contains('keyboard-open')) e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 280);
  });

  /* ---------- Demo tools (outside the product UI) ---------- */
  const demoAccounts = [
    ['mall', 'إدارة مول الواجهة', 'mall@example.com'],
    ['merchant', 'متجر لين للأزياء', 'store@example.com'],
    ['merchant', 'متجر خطوة للأحذية', 'shoes@example.com'],
    ['operations', 'فريق العمليات · مول الواجهة', 'ops@example.com'],
    ['delivery', 'شريك التوصيل', 'delivery@example.com'],
    ['admin', 'إدارة Free Hand', 'admin@example.com']
  ];
  UI.demoAccounts = demoAccounts;
  function demoHTML() {
    return `<div class="fh-demo">
      <p class="fh-demo-note">${ic('flask-conical')} أدوات للمراجعة والتجربة فقط، خارج واجهة التطبيق.</p>
      <section><h3>المتسوّق</h3>
        <p>أي رقم صحيح يبدأ بـ <bdi dir="ltr">05</bdi> ينشئ متسوّقًا جديدًا. متسوّق عائد: <bdi dir="ltr">0500000000</bdi>. رمز التحقق: <bdi dir="ltr">1234</bdi>.</p>
        <button type="button" class="fh-demo-btn" data-demo="shopper">${ic('smartphone')} تعبئة رقم المتسوّق العائد</button>
      </section>
      <section><h3>جولة الكاشير ← المتسوّق</h3>
        <ol class="fh-demo-steps">
          <li>ادخل كمتسوّق جديد برقم مثل <bdi dir="ltr">0551234567</bdi>، اكتب اسمك واختر «مول الواجهة».</li>
          <li>افتح «رمزي» من الشريط العلوي. احفظ صورة الرمز أو انسخ الرمز المكتوب.</li>
          <li>سجّل الخروج، ثم ادخل من «حسابات الأعمال» بحساب <bdi dir="ltr">store@example.com</bdi>.</li>
          <li>«ربط فاتورة»: امسح الرمز (كاميرا أو صورة) أو اكتبه، أكّد الاسم، أدخل الفاتورة واربطها.</li>
          <li>سجّل الخروج وادخل بالرقم نفسه: الفاتورة في «المشتريات» جاهزة للجمع.</li>
        </ol>
        <p>البديل دون رمز: يبحث الكاشير برقم الجوال المسجّل.</p>
      </section>
      <section><h3>حسابات الأعمال</h3><p>كلمة المرور لجميع الحسابات: <bdi dir="ltr">Demo1234!</bdi></p>
        <ul>${demoAccounts.map(([, label, email]) => `<li><span><strong>${label}</strong><bdi dir="ltr">${email}</bdi></span><button type="button" class="fh-demo-btn small" data-demo="fill" data-email="${email}">تعبئة</button></li>`).join('')}</ul>
      </section>
      <section><h3>الدفع</h3><p>الدفع محاكاة. لتجربة رفض الدفعة اختر «تجربة رفض الدفع» داخل نافذة الدفع.</p></section>
      <section><h3>البيانات</h3><p>تُحفظ الحسابات والطلبات في جلسة هذا التبويب، والأماكن في هذا المتصفح.</p>
        <button type="button" class="fh-demo-btn danger" data-demo="reset">${ic('rotate-ccw')} مسح بيانات العرض والبدء من جديد</button>
      </section>
    </div>`;
  }
  function demoFill(email) {
    if (A.session) {
      F.toast('سجّل الخروج من الحساب الحالي أولًا لتجربة حساب آخر.', true);
      return;
    }
    V.loginEmail = email;
    F.closeSheet();
    if (F.s.route !== 'auth-role-login') F.go('auth-role-login'); else F.render();
    const pass = F.$('[data-form="visit-login"] [name="password"]');
    if (pass) { pass.value = 'Demo1234!'; pass.focus(); }
  }
  async function demoReset() {
    if (!window.confirm('مسح كل بيانات العرض في هذا المتصفح؟')) return;
    try { sessionStorage.clear(); } catch {}
    try { Object.keys(localStorage).filter(k => k.startsWith('fh-')).forEach(k => localStorage.removeItem(k)); } catch {}
    try { indexedDB.deleteDatabase('fh-join-documents'); } catch {}
    location.reload();
  }
  function onDemoClick(e) {
    const btn = e.target.closest('[data-demo]');
    if (!btn) return;
    const kind = btn.dataset.demo;
    if (kind === 'shopper') {
      if (A.session) return F.toast('سجّل الخروج أولًا لتجربة حساب آخر.', true);
      A.pendingPhone = '0500000000';
      F.closeSheet();
      F.go('login');
    } else if (kind === 'fill') demoFill(btn.dataset.email);
    else if (kind === 'reset') demoReset();
  }
  const panel = document.createElement('aside');
  panel.id = 'demo-tools';
  panel.setAttribute('aria-label', 'أدوات العرض');
  panel.innerHTML = `<h2>${ic('wrench')} أدوات العرض</h2>${demoHTML()}`;
  panel.hidden = true;
  // Collapsed by default so demo accounts never sit next to the shopper's sign-in.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'demo-tools-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'demo-tools');
  toggle.innerHTML = `${ic('flask-conical')}<span>أدوات العرض</span>`;
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    toggle.querySelector('span').textContent = panel.hidden ? 'أدوات العرض' : 'إخفاء أدوات العرض';
  });
  document.querySelector('.studio-layout')?.append(panel, toggle);
  panel.addEventListener('click', onDemoClick);
  F.$('#app-overlay').addEventListener('click', onDemoClick);
  F.actions['fh-demo-tools'] = () => F.sheet('أدوات العرض', demoHTML());

  /* Self-test: open the app with ?selftest=run (clears this browser's demo data first). */
  if (new URLSearchParams(location.search).get('selftest') === 'run') {
    window.addEventListener('load', () => setTimeout(() => UI.loadScript('tests/selftest.js?v=' + Date.now()), 400));
  }

  /* Favicon and theme colour follow the new brand. */
  document.querySelector('link[rel="icon"]')?.setAttribute('href', 'assets/favicon.svg');
})();
