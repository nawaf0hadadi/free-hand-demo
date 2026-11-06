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
  UI.cash = n => `<bdi class="fh-money">${UI.num(n)} ر.س</bdi>`;
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
  UI.count = (n, noun) => {
    const [one, two, few, many] = nouns[noun];
    n = Number(n) || 0;
    if (n === 0) return `0 ${few}`;
    if (n === 1) return one;
    if (n === 2) return two;
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
  UI.selectField = ({ name, label, options, value = '', hint = '' }) => {
    const id = 'f-' + name;
    return `<label class="a-field fh-field" for="${id}"><span class="fh-label">${label}</span><select id="${id}" name="${name}"${hint ? ` aria-describedby="${id}-hint"` : ''}>${options.map(([v, l]) => `<option value="${esc(v)}"${String(value) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${hint ? `<small class="fh-hint" id="${id}-hint">${hint}</small>` : ''}</label>`;
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
  UI.openOrder = (mallId = UI.mallId()) => UI.myOrders().find(o => o.mall === mallId && o.status !== 'delivered');
  UI.myInvoices = (mallId = UI.mallId()) => V.data.invoices.filter(i => i.phone === A.session?.phone && i.mall === mallId && !i.order);

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
  document.querySelector('.studio-layout')?.appendChild(panel);
  panel.addEventListener('click', onDemoClick);
  F.$('#app-overlay').addEventListener('click', onDemoClick);
  F.actions['fh-demo-tools'] = () => F.sheet('أدوات العرض', demoHTML());

  /* Favicon and theme colour follow the new brand. */
  document.querySelector('link[rel="icon"]')?.setAttribute('href', 'assets/favicon.svg');
})();
