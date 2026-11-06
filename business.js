/* Free Hand business screens.
   Final definitions for business sign-in, mall and store applications, the mall dashboard,
   store receipt linking, Free Hand admin review, and the operations / delivery task screens.
   Approval rules, account storage and order state changes stay in visit-work.js, mall-joining.js
   and access.js; this layer reuses their actions and adds clearer status and next-step guidance. */
(() => {
  'use strict';
  const F = window.FH;
  const A = F.Access;
  const V = F.Visit;
  const UI = F.UI;
  const { ic, esc, b, form, submit, link } = F;
  const data = V.data;
  const page = (title, html, footer = '', nav = null, back = true) => {
    const view = V.page(title, html, footer, nav, back);
    view.html = view.html.replace('visit-page', 'visit-page fh-page');
    return view;
  };
  const intro = (icon, title, sub) => `<div class="fh-auth-intro"><span class="fh-auth-icon">${ic(icon)}</span><h2 class="a-title">${title}</h2><p class="a-sub">${sub}</p></div>`;
  const draft = name => F.draft[name] || '';
  const date = iso => iso ? `<bdi>${new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))}</bdi>` : '';
  const mallOf = id => data.malls.find(m => m.id === id);
  const ownMall = () => data.malls.find(m => m.email === A.session?.email);
  const approvedMall = () => data.malls.find(m => m.email === A.session?.email && m.status === 'approved');
  const ownStore = () => data.stores.find(s => s.email === A.session?.email);
  const inReview = s => s.status === 'pending' || s.status === 'rejected';
  const storeStatus = s => ({ pending: ['بانتظار مراجعة المول', 'wait'], rejected: ['مرفوض · يحتاج تعديلًا', 'error'], approved: ['معتمد', 'ok'] })[s.status] || ['معتمد', 'ok'];
  const mallStatus = m => ({ pending: ['بانتظار مراجعة Free Hand', 'wait'], rejected: ['مرفوض', 'error'], approved: ['معتمد', 'ok'] })[m?.status] || ['قيد المراجعة', 'wait'];

  V.supported.merchant.push('merchant-linked');
  V.supported.mall.push('mall-parking');
  A.publicRoutes.add('join-status');

  /* ---------- Business sign-in ---------- */
  let loginError = '';
  const passwordField = (name, label, mode, hint = '') => `<div class="fh-password">${UI.field({ name, label, type: 'password', placeholder: mode === 'current-password' ? '••••••••' : '', attrs: `autocomplete="${mode}" maxlength="128"`, hint })}
    <button type="button" class="a-iconbtn clear" data-action="fh-password" aria-label="إظهار كلمة المرور" aria-pressed="false">${ic('eye')}</button></div>`;
  const policy = '8 أحرف على الأقل، تتضمن حرفًا ورقمًا.';
  // Lets password managers attach a new password to the right account.
  const usernameFor = email => `<input type="email" name="username" value="${esc(email)}" autocomplete="username" hidden tabindex="-1" aria-hidden="true">`;
  const businessRoles = ['mall', 'merchant', 'operations', 'delivery', 'admin'];
  const emailTaken = email => data.malls.some(m => m.email === email) || data.stores.some(s => s.email === email) || businessRoles.some(r => A.recordFor(r, email));
  function businessRecord(email) {
    for (const role of businessRoles) { const record = A.recordFor(role, email); if (record) return record; }
    const s = data.stores.find(x => x.email === email && !inReview(x));
    return s ? { id: 'merchant:' + email, role: 'merchant', email, name: s.name, organization: s.name, org: s.mall } : null;
  }
  const fileTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const fileProblem = (f, required) => !f?.size ? (required ? 'أرفق الملف (PDF أو PNG أو JPG).' : '')
    : !fileTypes.includes(f.type) ? 'الصيغ المقبولة: PDF أو PNG أو JPG.' : f.size > 5 * 1024 * 1024 ? 'الحد الأقصى 5 ميغابايت للملف.' : '';

  F.views['auth-role-login'] = () => page('حسابات الأعمال',
    intro('building-2', 'دخول حساب العمل', 'للمتاجر وإدارات المولات وفرق التشغيل والتوصيل وإدارة Free Hand.') +
    form('visit-login',
      UI.field({ name: 'email', label: 'البريد الإلكتروني', value: V.loginEmail, placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120" required', error: loginError }) +
      passwordField('password', 'كلمة المرور', 'current-password')) +
    `<div class="fh-inline-actions">${link(ic('key-round') + ' نسيت كلمة المرور؟', 'go:auth-forgot')}</div>
    <div class="fh-divider"><span>جديد على Free Hand؟</span></div>
    <div class="fh-option-list">
      ${V.select('تسجيل مول جديد', 'join-mall', '', false, 'building-2', 'لإدارات المولات · يراجعه فريق Free Hand')}
      ${V.select('انضمام متجر إلى مول', 'join-store', '', false, 'store', 'لمتجر داخل مول مسجّل · تراجعه إدارة المول')}
    </div>
    <p class="fh-footnote">${ic('info')}<span>قدّمت طلبًا؟ سجّل الدخول ببريد الطلب وكلمة مروره لمعرفة حالته.</span></p>`,
    submit('تسجيل الدخول ' + ic('arrow-left')), null);

  const visitLogin = F.forms['visit-login'];
  F.forms['visit-login'] = async d => {
    if (UI.isBusy()) return;
    const email = String(d.email || '').trim().toLowerCase();
    V.loginEmail = email;
    const errors = {};
    if (!A.validEmail(email)) errors.email = 'أدخل بريدًا إلكترونيًا صحيحًا.';
    if (!d.password) errors.password = 'أدخل كلمة المرور.';
    if (UI.showErrors(errors, { toast: false })) return;
    loginError = '';
    // A store application under review opens its status, never the store workspace.
    const application = data.stores.find(s => s.email === email && inReview(s));
    if (application) {
      await UI.busy('جارٍ التحقق…', async () => {
        await UI.wait(300);
        if (!await A.verifyPassword(A.recordFor('merchant', email), d.password)) return F.toast('البريد أو كلمة المرور غير صحيحة.', true);
        V.joinStatusId = application.id;
        F.go('join-status');
      });
      return;
    }
    await UI.busy('جارٍ تسجيل الدخول…', async () => { await UI.wait(250); await visitLogin(d); });
  };

  /* Password recovery (simulated code) and change: both ask for confirmation. */
  V.recovery ||= null;
  F.views['auth-forgot'] = () => page('استعادة كلمة المرور',
    intro('key-round', 'نعيد لك الدخول', 'أدخل بريد حساب العمل. نرسل رمز استعادة (محاكاة: لا تُرسل رسالة، والرمز 1234).') +
    form('fh-forgot', UI.field({ name: 'email', label: 'البريد الإلكتروني', value: V.recovery?.email || V.loginEmail, placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120"' })),
    submit('متابعة ' + ic('arrow-left')), null);
  F.forms['fh-forgot'] = d => {
    const email = String(d.email || '').trim().toLowerCase();
    if (!A.validEmail(email)) return UI.showErrors({ email: 'أدخل بريدًا إلكترونيًا صحيحًا.' }, { toast: false });
    V.recovery = { email };
    F.go('auth-reset');
  };
  F.views['auth-reset'] = () => {
    if (!V.recovery?.email) return F.views['auth-forgot']();
    return page('كلمة مرور جديدة',
      intro('lock-keyhole', 'اختر كلمة مرور جديدة', `للحساب <bdi dir="ltr">${esc(V.recovery.email)}</bdi>`) +
      form('fh-reset', usernameFor(V.recovery.email) +
        UI.field({ name: 'code', label: 'رمز الاستعادة', placeholder: '••••', attrs: 'dir="ltr" inputmode="numeric" maxlength="4" autocomplete="one-time-code" class="fh-code"', hint: 'محاكاة: الرمز 1234.' }) +
        passwordField('password', 'كلمة المرور الجديدة', 'new-password', policy) + passwordField('confirm', 'تأكيد كلمة المرور', 'new-password')),
      submit('حفظ كلمة المرور'), null);
  };
  F.forms['fh-reset'] = async d => {
    const email = V.recovery?.email;
    if (!email || UI.isBusy()) return;
    const errors = F.digits(d.code) !== '1234' ? { code: 'الرمز غير صحيح. رمز العرض 1234.' } : {};
    Object.assign(errors, UI.passwordErrors(d.password, d.confirm));
    if (UI.showErrors(errors)) return;
    const record = businessRecord(email);
    if (!record) return UI.showErrors({ code: 'تعذّر تحديث كلمة المرور لهذا البريد. تأكد من البريد أو تواصل مع جهتك.' });
    await UI.busy('جارٍ الحفظ…', async () => {
      await A.storePassword(record, d.password);
      V.loginEmail = email;
      V.recovery = null;
      F.go('auth-reset-done', { replace: true });
    });
  };
  F.views['auth-reset-done'] = () => page('تم تحديث كلمة المرور',
    `<section class="fh-success" role="status"><span class="fh-success-check">${ic('check')}</span><div><strong>كلمة المرور الجديدة جاهزة</strong><small>سجّل الدخول بها الآن.</small></div></section>`,
    b('تسجيل الدخول ' + ic('arrow-left'), 'go:auth-role-login'), null, false);

  for (const role of businessRoles) V.supported[role]?.push('auth-password');
  F.views['auth-password'] = () => page('تغيير كلمة المرور',
    form('fh-change-password', usernameFor(A.session?.email || '') +
      passwordField('current', 'كلمة المرور الحالية', 'current-password') +
      passwordField('password', 'كلمة المرور الجديدة', 'new-password', policy) + passwordField('confirm', 'تأكيد كلمة المرور الجديدة', 'new-password')),
    submit('حفظ كلمة المرور'), 'auth-account');
  F.forms['fh-change-password'] = async d => {
    if (!A.session || A.session.role === 'customer' || UI.isBusy()) return;
    const record = A.recordFor(A.session.role, A.session.email) || A.model.records[A.session.id];
    const errors = d.current ? {} : { current: 'أدخل كلمة المرور الحالية.' };
    Object.assign(errors, UI.passwordErrors(d.password, d.confirm));
    if (!errors.password && d.password && d.password === d.current) errors.password = 'اختر كلمة مرور مختلفة عن الحالية.';
    if (UI.showErrors(errors)) return;
    if (!await A.verifyPassword(record, d.current)) return UI.showErrors({ current: 'كلمة المرور الحالية غير صحيحة.' });
    await UI.busy('جارٍ الحفظ…', async () => {
      await A.storePassword(record, d.password);
      F.go('auth-account', { replace: true });
    });
    F.toast('تم تغيير كلمة المرور');
  };

  /* ---------- Applications: choose, register a mall, apply as a store ---------- */
  // Files chosen before going back stay attached in memory for this tab.
  const files = {};
  F.$('#phone-app').addEventListener('change', e => {
    const input = e.target;
    if (input.type !== 'file' || !input.closest('[data-form="visit-mall-register"],[data-form="join-request"],[data-form="fh-join-resubmit"],[data-form="fh-mall-resubmit"]')) return;
    const bucket = files[input.form?.dataset.form] ||= {};
    if (input.files[0]) bucket[input.name] = input.files[0]; else delete bucket[input.name];
    const label = input.closest('.fh-file')?.querySelector('.fh-file-name');
    if (label) label.textContent = input.files[0] ? input.files[0].name : 'لم يُختر ملف';
  });
  const withFiles = (formName, d) => { for (const [k, f] of Object.entries(files[formName] || {})) if (!d[k]?.size) d[k] = f; return d; };
  const fileField = (formName, name, label, hint) => { const f = files[formName]?.[name]; return `<label class="a-field fh-field fh-file"><span class="fh-label">${label}</span><input type="file" name="${name}" accept=".pdf,image/png,image/jpeg"><small class="fh-hint">${hint} · <span class="fh-file-name">${f ? esc(f.name) : 'لم يُختر ملف'}</span></small></label>`; };
  const section = (title, body, note = '') => `<fieldset class="fh-form-section"><legend>${title}</legend>${note ? `<p class="fh-footnote">${note}</p>` : ''}${body}</fieldset>`;
  const text = (name, label, placeholder, attrs = '', hint = '', value = draft(name)) => UI.field({ name, label, value, placeholder, attrs, hint });
  const needs = (who, items) => `<section class="fh-needs"><h3>${ic('clipboard-list')} قبل أن تبدأ</h3><ul>${items.map(x => `<li>${ic('check')}<span>${x}</span></li>`).join('')}</ul><p>${ic('user-round-check')}<span>${who}</span></p></section>`;
  const clean = (v, n = 100) => String(v || '').trim().slice(0, n);

  // Mall documents are kept in the browser (IndexedDB) so the Free Hand admin can download them.
  async function keepMallDocs(m, list) {
    const kept = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (!f?.size) continue;
      const id = `mall-${m.id}-${i}-${Date.now()}`;
      await F.JoinDocuments.put(id, f);
      kept.push({ id, name: clean(f.name, 120), size: f.size });
    }
    return kept;
  }

  const mallRegister = F.forms['visit-mall-register'];
  F.forms['visit-mall-register'] = async d => {
    if (UI.isBusy()) return;
    d = withFiles('visit-mall-register', d);
    const email = clean(d.email, 120).toLowerCase();
    const errors = {};
    if (clean(d.name, 65).length < 2) errors.name = 'أدخل اسم المول.';
    if (clean(d.company, 65).length < 2) errors.company = 'أدخل اسم الجهة المشغّلة كما في السجل.';
    if (clean(d.city, 40).length < 2) errors.city = 'أدخل المدينة.';
    if (clean(d.point, 100).length < 3) errors.point = 'صف مكان التسليم، مثل: البوابة أ · الدور الأرضي.';
    const required = fileProblem(d.registration, true); if (required) errors.registration = required;
    const optional = fileProblem(d.other, false); if (optional) errors.other = optional;
    if (!A.validEmail(email)) errors.email = 'أدخل بريدًا إلكترونيًا صحيحًا.';
    else if (emailTaken(email)) errors.email = 'هذا البريد مسجّل مسبقًا. استخدم بريدًا آخر أو سجّل الدخول.';
    Object.assign(errors, UI.passwordErrors(d.password, d.confirm));
    if (UI.showErrors(errors)) return;
    await mallRegister(d); // creates the pending mall and its account, then opens the status screen
    const m = data.malls.find(x => x.email === email);
    if (m && !m.docFiles) {
      try { m.docFiles = await keepMallDocs(m, [d.registration, d.other]); } catch { m.docFiles = []; }
      V.save();
      delete files['visit-mall-register'];
      F.render();
    }
  };
  const joinRequest = F.forms['join-request'];
  F.forms['join-request'] = async d => {
    if (UI.isBusy() || V.joinSending()) return;
    d = withFiles('join-request', d);
    const email = clean(d.email, 120).toLowerCase();
    const m = data.malls.find(x => x.id === d.mall && x.status === 'approved');
    const errors = {};
    if (!m) errors.mall = 'اختر المول الذي يقع فيه المتجر.';
    if (clean(d.name, 65).length < 2) errors.name = 'أدخل اسم المتجر والفرع.';
    if (clean(d.category, 40).length < 2) errors.category = 'أدخل نشاط المتجر.';
    if (clean(d.floor, 50).length < 2) errors.floor = 'أدخل الدور ورقم المحل.';
    if (m && !errors.name && data.stores.some(s => s.mall === m.id && s.status !== 'rejected' && s.name.trim() === clean(d.name, 65))) errors.name = 'يوجد متجر أو طلب بهذا الاسم في المول.';
    if (m && !errors.floor && data.stores.some(s => s.mall === m.id && s.status !== 'rejected' && s.floor.trim() === clean(d.floor, 50))) errors.floor = 'هذا المحل مسجّل لمتجر آخر في المول.';
    if (!/^\d{10}$/.test(F.digits(d.registration))) errors.registration = 'رقم السجل التجاري 10 أرقام.';
    if (clean(d.lease, 60).length < 2) errors.lease = 'أدخل رقم عقد الإيجار أو مرجع الفرع.';
    const doc = fileProblem(d.document, true); if (doc) errors.document = doc;
    const lease = fileProblem(d.leaseDocument, true); if (lease) errors.leaseDocument = lease;
    if (clean(d.manager, 60).length < 2) errors.manager = 'أدخل اسم مسؤول المتجر.';
    if (!/^05\d{8}$/.test(F.digits(d.phone))) errors.phone = 'جوال من 10 أرقام يبدأ بـ 05.';
    if (!A.validEmail(email)) errors.email = 'أدخل بريدًا إلكترونيًا صحيحًا.';
    else if (emailTaken(email)) errors.email = 'هذا البريد مسجّل مسبقًا. استخدم بريدًا آخر أو سجّل الدخول.';
    Object.assign(errors, UI.passwordErrors(d.password, d.confirm));
    if (!d.authorized) errors.authorized = 'أكّد صحة البيانات وصلاحيتك لتقديم الطلب.';
    if (UI.showErrors(errors)) return;
    await UI.busy('جارٍ إرسال الطلب…', () => joinRequest(d));
    if (V.joinSent) delete files['join-request'];
  };

  function chooseView() {
    return page('انضمام إلى Free Hand', intro('handshake', 'من تمثّل؟', 'اختر نوع الطلب. لكل طلب جهة تراجعه قبل تفعيل الحساب.') +
      `<div class="fh-option-list">
        ${V.select('تسجيل مول جديد', 'join-mall', '', false, 'building-2', 'يراجعه فريق Free Hand، ثم تُفتح لوحة المول.')}
        ${V.select('انضمام متجر إلى مول', 'join-store', '', false, 'store', 'تراجعه إدارة المول الذي يقع فيه المتجر.')}
      </div>`, b('لدي حساب · تسجيل الدخول', 'back', 'secondary'), null);
  }
  function mallForm() {
    return page('تسجيل مول جديد', intro('building-2', 'تسجيل مول جديد', 'بعد الإرسال تدخل بالحساب نفسه لمتابعة الطلب. تُفتح لوحة المول بعد الاعتماد.') +
      needs('يراجع الطلب: فريق Free Hand.', ['اسم المول والجهة المشغّلة والمدينة', 'نسخة السجل التجاري: PDF أو صورة حتى 5 ميغابايت', 'بريد لحساب مسؤول المول وكلمة مرور']) +
      UI.requiredNote +
      form('visit-mall-register',
        section('المول', text('name', 'اسم المول', 'مثال: مول الواجهة', 'maxlength="65" autocomplete="organization"') + text('company', 'الجهة المشغّلة', 'الاسم المسجّل للجهة', 'maxlength="65"') +
          text('city', 'المدينة', 'مثال: الرياض', 'maxlength="40" autocomplete="address-level2"') + text('point', 'نقطة تسليم السيارات', 'مثال: البوابة أ · الدور الأرضي', 'maxlength="100"', 'يراها المتسوّق عند التسليم في المواقف.')) +
        section('المستندات', fileField('visit-mall-register', 'registration', 'نسخة السجل التجاري', 'PDF أو PNG أو JPG حتى 5 ميغابايت') + fileField('visit-mall-register', 'other', 'مستند داعم' + UI.optional, 'مثل خطاب تفويض'), 'استخدم ملفات تجريبية في هذه النسخة.') +
        section('حساب مسؤول المول', UI.field({ name: 'email', label: 'البريد الإلكتروني', value: draft('email'), placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120"' }) +
          passwordField('password', 'كلمة المرور', 'new-password', policy) + passwordField('confirm', 'تأكيد كلمة المرور', 'new-password'))),
      submit('إرسال الطلب إلى Free Hand'), null);
  }
  function storeForm(resubmit) {
    const malls = data.malls.filter(m => m.status === 'approved');
    if (!malls.length) return page('انضمام متجر', UI.empty('building-2', 'لا توجد مولات معتمدة بعد', 'يجب أن يسجّل المول ويعتمده فريق Free Hand قبل انضمام المتاجر.'), b('رجوع', 'back', 'secondary'), null);
    const s = resubmit;
    const val = (name, fallback = '') => F.draft[name] ?? fallback;
    const formName = s ? 'fh-join-resubmit' : 'join-request';
    const fields = section('المتجر', UI.selectField({ name: 'mall', label: 'المول', options: [['', 'اختر المول الذي يقع فيه المتجر'], ...malls.map(m => [m.id, m.name + ' · ' + m.city])], value: val('mall', s?.mall), hint: 'المولات المعتمدة فقط.' }) +
        text('name', 'اسم المتجر والفرع', 'مثال: متجر العطور · فرع المول', 'maxlength="65" autocomplete="organization"', '', val('name', s?.name)) +
        `<div class="a-grid2">${text('category', 'النشاط', 'أزياء، عطور…', 'maxlength="40"', '', val('category', s?.category))}${text('floor', 'الدور ورقم المحل', 'الأول · B14', 'maxlength="50"', '', val('floor', s?.floor))}</div>`) +
      section('بيانات الاعتماد', text('registration', 'رقم السجل التجاري', '10 أرقام', 'inputmode="numeric" maxlength="10" dir="ltr"', '', val('registration', s?.registration)) +
        text('lease', 'رقم عقد الإيجار أو مرجع الفرع لدى المول', 'رقم المرجع', 'maxlength="60" dir="auto"', '', val('lease', s?.lease)) +
        fileField(formName, 'document', 'نسخة السجل التجاري' + (s ? UI.optional : ''), s ? 'اختر ملفًا لتحديث المرفق السابق' : 'PDF أو PNG أو JPG حتى 5 ميغابايت') +
        fileField(formName, 'leaseDocument', 'إثبات وجود الفرع في المول' + (s ? UI.optional : ''), s ? 'اختر ملفًا لتحديث المرفق السابق' : 'PDF أو PNG أو JPG حتى 5 ميغابايت'), s ? 'المرفقات السابقة تبقى ما لم تختر ملفًا جديدًا.' : 'استخدم ملفات تجريبية في هذه النسخة.') +
      section('مسؤول المتجر', text('manager', 'الاسم', 'اسم المسؤول', 'maxlength="60" autocomplete="name"', '', val('manager', s?.manager)) +
        text('phone', 'جوال التواصل', '05XXXXXXXX', 'dir="ltr" inputmode="numeric" maxlength="10" autocomplete="tel-national"', '', val('phone', s?.phone)) +
        (s ? UI.line('بريد الحساب', UI.ltr(s.email)) : UI.field({ name: 'email', label: 'البريد الإلكتروني للحساب', value: draft('email'), placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120"' }) +
          passwordField('password', 'كلمة المرور', 'new-password', policy) + passwordField('confirm', 'تأكيد كلمة المرور', 'new-password'))) +
      '<label class="a-check"><input type="checkbox" name="authorized"><span>أقر بصحة البيانات وأني مخوّل بتقديم الطلب عن المتجر.</span></label>';
    return page(s ? 'تعديل طلب الانضمام' : 'انضمام متجر',
      intro('store', s ? 'عدّل الطلب وأعد إرساله' : 'انضمام متجر إلى مول', s ? 'تراجع إدارة المول الطلب مرة أخرى بعد الإرسال.' : 'بعد الإرسال تتابع الحالة بالدخول ببريد الطلب. يُفعّل الحساب بعد اعتماد المول.') +
      (s?.reason ? UI.callout('message-square-warning', 'سبب الرفض السابق', esc(s.reason), 'warn') : needs('يراجع الطلب: إدارة المول الذي تختاره.', ['المول ورقم المحل ونشاط المتجر', 'رقم السجل التجاري (10 أرقام) ونسخة منه', 'مرجع عقد الإيجار وإثبات وجود الفرع في المول', 'بيانات مسؤول المتجر وبريد وكلمة مرور للحساب'])) +
      UI.requiredNote +
      form(formName, fields) +
      `<p class="fh-footnote">${ic('info')}<span>نسخة محلية: المرفقات محفوظة في هذا المتصفح للمراجعة التجريبية، ولا يوجد تحقق رسمي من السجل التجاري.</span></p>`,
      submit(s ? 'إعادة إرسال الطلب' : 'إرسال الطلب إلى إدارة المول'), null);
  }
  function sentView(s) {
    const m = mallOf(s.mall);
    return page('تم إرسال الطلب', `<section class="fh-success" role="status"><span class="fh-success-check">${ic('check')}</span><div><strong>وصل طلبك إلى إدارة ${esc(m?.name || 'المول')}</strong><small>${esc(s.name)}</small></div></section>` +
      statusCard(s) + UI.callout('log-in', 'كيف تتابع الطلب؟', 'سجّل الدخول من «حسابات الأعمال» بالبريد وكلمة المرور اللذين سجّلتهما لمعرفة الحالة. بعد الاعتماد يفتح الدخول نفسه لوحة المتجر.'),
      b('العودة إلى تسجيل الدخول', 'fh-join-done'), null, false);
  }
  F.actions['fh-join-done'] = () => { V.joinSent = null; V.resubmit = null; F.stack = []; F.go('auth-role-login', { replace: true }); };

  F.views['auth-register'] = () => {
    const kind = V.joinKind();
    if (kind === 'choose') return chooseView();
    if (kind === 'mall') return mallForm();
    if (V.joinSent) return sentView(V.joinSent);
    return storeForm(V.resubmit ? data.stores.find(s => s.id === V.resubmit && s.status === 'rejected') : null);
  };

  /* Application status for stores under review (opened after verifying the account password). */
  function statusCard(s) {
    const m = mallOf(s.mall);
    const [label, tone] = storeStatus(s);
    const steps = [['تقديم الطلب', true], ['مراجعة إدارة المول', s.status !== 'pending'], [s.status === 'rejected' ? 'مرفوض · بانتظار تعديلك' : 'تفعيل حساب المتجر', s.status === 'approved']];
    return `<section class="a-card fh-review-block"><div class="fh-block-head"><h3>${ic('file-check-2')} ${esc(s.name)}</h3>${UI.status(label, tone)}</div>
      ${UI.line('المول', esc(m?.name || ''))}${UI.line('يراجع الطلب', 'إدارة ' + esc(m?.name || 'المول'))}${s.submittedAt ? UI.line('تاريخ التقديم', date(s.submittedAt)) : ''}
      <ol class="fh-mini-steps">${steps.map(([t, done], i) => `<li class="${done ? 'done' : i === steps.findIndex(x => !x[1]) ? 'current' : ''}"><span>${ic(done ? 'check' : 'circle')}</span>${t}</li>`).join('')}</ol></section>`;
  }
  F.views['join-status'] = () => {
    const s = data.stores.find(x => x.id === V.joinStatusId);
    if (!s) return F.views['auth-role-login']();
    const m = mallOf(s.mall);
    const next = s.status === 'pending'
      ? UI.callout('hourglass', 'التالي: قرار إدارة المول', `تراجع إدارة ${esc(m?.name || 'المول')} بيانات المتجر والمستندات. بعد الاعتماد سجّل الدخول بالبريد نفسه لفتح لوحة المتجر.`)
      : s.status === 'rejected'
        ? UI.callout('message-square-warning', 'سبب الرفض', esc(s.reason || 'لم تُذكر ملاحظات.'), 'warn') + UI.callout('pencil', 'التالي: تعديل الطلب', 'عدّل البيانات أو المرفقات المطلوبة وأعد الإرسال لتراجعه الإدارة مجددًا.')
        : UI.callout('circle-check', 'تم اعتماد المتجر', 'سجّل الدخول الآن لفتح لوحة المتجر.');
    return page('حالة طلب الانضمام', statusCard(s) + next,
      s.status === 'rejected' ? b(ic('pencil') + ' تعديل الطلب وإعادة إرساله', 'fh-join-edit') + b('العودة إلى تسجيل الدخول', 'go:auth-role-login', 'secondary') : b('العودة إلى تسجيل الدخول', 'go:auth-role-login', 'secondary'), null);
  };
  F.actions['fh-join-edit'] = () => {
    const s = data.stores.find(x => x.id === V.joinStatusId && x.status === 'rejected');
    if (!s) return;
    V.resubmit = s.id;
    for (const k of ['mall', 'name', 'category', 'floor', 'registration', 'lease', 'manager', 'phone']) F.draft[k] = s[k] || '';
    F.actions['join-store']();
  };
  F.forms['fh-join-resubmit'] = async d => {
    if (UI.isBusy()) return;
    d = withFiles('fh-join-resubmit', d);
    const s = data.stores.find(x => x.id === V.resubmit && x.status === 'rejected');
    if (!s) return;
    const m = data.malls.find(x => x.id === d.mall && x.status === 'approved');
    const registration = F.digits(d.registration), phone = F.digits(d.phone);
    const errors = {};
    if (!m) errors.mall = 'اختر المول الذي يقع فيه المتجر.';
    if (clean(d.name, 65).length < 2) errors.name = 'أدخل اسم المتجر والفرع.';
    if (clean(d.category, 40).length < 2) errors.category = 'أدخل نشاط المتجر.';
    if (clean(d.floor, 50).length < 2) errors.floor = 'أدخل الدور ورقم المحل.';
    if (!/^\d{10}$/.test(registration)) errors.registration = 'رقم السجل التجاري 10 أرقام.';
    if (clean(d.lease, 60).length < 2) errors.lease = 'أدخل رقم عقد الإيجار أو مرجع الفرع.';
    const doc = fileProblem(d.document, false); if (doc) errors.document = doc;
    const lease = fileProblem(d.leaseDocument, false); if (lease) errors.leaseDocument = lease;
    if (clean(d.manager, 60).length < 2) errors.manager = 'أدخل اسم مسؤول المتجر.';
    if (!/^05\d{8}$/.test(phone)) errors.phone = 'جوال من 10 أرقام يبدأ بـ 05.';
    if (!d.authorized) errors.authorized = 'أكّد صحة البيانات وصلاحيتك لتقديم الطلب.';
    if (UI.showErrors(errors)) return;
    await UI.busy('جارٍ إرسال الطلب…', async () => {
      const fresh = [d.document, d.leaseDocument];
      try {
        for (let i = 0; i < fresh.length; i++) {
          if (!fresh[i]?.size) continue;
          const id = s.id + '-' + i + '-' + Date.now();
          await F.JoinDocuments.put(id, fresh[i]);
          s.docs[i] = { name: clean(fresh[i].name, 120), size: fresh[i].size, id };
        }
      } catch { return F.toast('تعذّر حفظ المرفقات في المتصفح. أعد المحاولة.', true); }
      Object.assign(s, { mall: m.id, name: clean(d.name, 65), category: clean(d.category, 40), floor: clean(d.floor, 50), registration, lease: clean(d.lease, 60), manager: clean(d.manager, 60), phone,
        status: 'pending', previousReason: s.reason, reason: '', submittedAt: new Date().toISOString() });
      V.save();
      delete files['fh-join-resubmit'];
      V.joinSent = s;
      V.resubmit = null;
      F.render();
    });
  };
  // Resubmission mode ends when the user leaves the join flow.
  const back = F.actions.back;
  F.actions.back = () => { if (F.s.route === 'auth-register' && V.resubmit) { V.resubmit = null; F.draft = {}; F.go('join-status', { replace: true }); return; } back(); };

  /* Mall registration status (signed in as the mall account until Free Hand approves). */
  const mallDocs = m => (m?.docFiles?.length ? m.docFiles.map(d => d.name) : m?.docs || []);
  F.views['u-mall-status'] = () => {
    const m = ownMall();
    const [label, tone] = mallStatus(m);
    const steps = [['تقديم الطلب', true], ['مراجعة فريق Free Hand', m?.status !== 'pending'], [m?.status === 'rejected' ? 'مرفوض · بانتظار تعديلك' : 'فتح لوحة المول', m?.status === 'approved']];
    return page('طلب تسجيل المول', `<section class="a-card fh-review-block"><div class="fh-block-head"><h3>${ic('building-2')} ${esc(m?.name || 'طلب المول')}</h3>${UI.status(label, tone)}</div>
        ${UI.line('الجهة المشغّلة', esc(m?.company || ''))}${UI.line('المدينة', esc(m?.city || ''))}${UI.line('يراجع الطلب', 'فريق Free Hand')}
        ${mallDocs(m).length ? UI.line('المستندات', mallDocs(m).map(esc).join('، ')) : ''}
        <ol class="fh-mini-steps">${steps.map(([t, done], i) => `<li class="${done ? 'done' : i === steps.findIndex(x => !x[1]) ? 'current' : ''}"><span>${ic(done ? 'check' : 'circle')}</span>${t}</li>`).join('')}</ol></section>` +
      (m?.status === 'rejected'
        ? UI.callout('message-square-warning', 'سبب الرفض', esc(m.reason || 'لم تُذكر ملاحظات.'), 'warn') +
          UI.requiredNote +
          form('fh-mall-resubmit', section('عدّل البيانات وأعد الإرسال', UI.field({ name: 'name', label: 'اسم المول', value: m.name, attrs: 'maxlength="65"' }) + UI.field({ name: 'company', label: 'الجهة المشغّلة', value: m.company, attrs: 'maxlength="65"' }) +
            UI.field({ name: 'city', label: 'المدينة', value: m.city, attrs: 'maxlength="40"' }) + UI.field({ name: 'point', label: 'نقطة تسليم السيارات', value: m.point, attrs: 'maxlength="100"' }) + fileField('fh-mall-resubmit', 'registration', 'سجل تجاري محدّث' + UI.optional, 'PDF أو PNG أو JPG حتى 5 ميغابايت')))
        : UI.callout('hourglass', 'التالي: قرار فريق Free Hand', 'تُفتح لوحة المول وإدارة المتاجر بعد الاعتماد. ادخل بالحساب نفسه لمتابعة الحالة.')),
      m?.status === 'rejected' ? submit('إعادة إرسال الطلب') + b('تسجيل الخروج', 'auth-logout', 'secondary') : b('تسجيل الخروج', 'auth-logout', 'secondary'), null, false);
  };
  F.forms['fh-mall-resubmit'] = async d => {
    const m = ownMall();
    if (A.session?.role !== 'mall' || m?.status !== 'rejected' || UI.isBusy()) return;
    d = withFiles('fh-mall-resubmit', d);
    const values = { name: clean(d.name, 65), company: clean(d.company, 65), city: clean(d.city, 40), point: clean(d.point, 100) };
    const errors = {};
    for (const [k, msg] of [['name', 'أدخل اسم المول.'], ['company', 'أدخل الجهة المشغّلة.'], ['city', 'أدخل المدينة.'], ['point', 'صف مكان التسليم.']]) if (values[k].length < 2) errors[k] = msg;
    const fileError = fileProblem(d.registration, false); if (fileError) errors.registration = fileError;
    if (UI.showErrors(errors)) return;
    await UI.busy('جارٍ الإرسال…', async () => {
      if (d.registration?.size) {
        try { const kept = await keepMallDocs(m, [d.registration]); m.docFiles = [...kept, ...(m.docFiles || []).slice(1)]; } catch {}
        m.docs = [clean(d.registration.name, 100), ...(m.docs || []).slice(1)];
      }
      Object.assign(m, values, { status: 'pending', previousReason: m.reason, reason: '' });
      V.save();
      delete files['fh-mall-resubmit'];
      F.render();
    });
    F.toast('أُعيد إرسال الطلب إلى فريق Free Hand');
  };

  /* ---------- Mall dashboard ---------- */
  F.views['mall-home'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const stores = V.stores(m.id);
    const pending = stores.filter(s => s.status === 'pending');
    const active = stores.filter(s => !inReview(s) && s.active);
    const carriers = data.carriers.filter(c => c.mall === m.id);
    const orders = data.orders.filter(o => o.mall === m.id && o.status !== 'delivered');
    const config = UI.parkingFor(m);
    return page('لوحة المول', `<section class="fh-org-head"><small>${esc(m.city)}</small><h2>${esc(m.name)}</h2><p>${esc(m.company || '')}</p></section>` +
      (pending.length
        ? UI.section('بانتظار قرارك', UI.status(UI.count(pending.length, 'request'), 'wait')) + `<div class="fh-list">${pending.map(s => `<button type="button" class="fh-task-row" data-action="join-review" data-id="${esc(s.id)}"><span class="fh-icon-tile">${ic('file-clock')}</span><span><strong>${esc(s.name)}</strong><small>${esc(s.category)} · ${UI.iso(s.floor)}${s.submittedAt ? ' · ' + date(s.submittedAt) : ''}</small></span><b>مراجعة</b></button>`).join('')}</div>`
        : UI.callout('circle-check', 'لا طلبات انضمام بانتظارك', 'تظهر هنا طلبات المتاجر التي تختار هذا المول.')) +
      (() => {
        const alerts = data.orders.filter(o => o.mall === m.id && !UI.isClosed(o) && (o.exception || o.stops.some(t => t.issue && !t.issue.resolved)));
        return alerts.length ? UI.section('تنبيهات تشغيلية', UI.status(UI.count(alerts.length, 'order'), 'error')) + `<div class="fh-list">${alerts.map(o => orderCard(o)).join('')}</div>` : '';
      })() +
      `<div class="fh-metrics">
        <button type="button" data-action="go:mall-stores"><strong>${UI.num(active.length)}</strong><small>متاجر مفعّلة</small></button>
        <button type="button" data-action="go:mall-live"><strong>${UI.num(orders.length)}</strong><small>طلبات جارية</small></button>
        <button type="button" data-action="go:mall-carriers"><strong>${UI.num(carriers.filter(c => c.active).length)}</strong><small>شركات توصيل</small></button>
      </div>` +
      UI.section('خيارات التسليم للزوار') +
      `<section class="a-card fh-menu">
        ${F.listButton('التسليم عند السيارة', 'car-front', 'go:mall-parking', `${UI.count(config.gates.length, 'gate')} · ${config.levels.map(esc).join('، ')}`)}
        ${F.listButton('التوصيل إلى المنزل', 'truck', 'go:mall-carriers', carriers.length ? carriers.map(c => esc(c.name) + (c.active ? '' : ' (معطّلة)')).join('، ') : 'لم تُضف شركات بعد')}
      </section>` +
      `<section class="a-card fh-menu">${F.listButton('المتاجر وطلبات الانضمام', 'store', 'go:mall-stores', UI.count(stores.length, 'store'))}${F.listButton('طلبات الجمع في المول', 'route', 'go:mall-live', orders.length ? 'الجارية الآن: ' + UI.num(orders.length) : 'لا طلبات جارية')}</section>`,
      '', 'mall-home', false);
  };

  F.views['mall-stores'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const review = data.stores.find(s => s.id === F.s.joinReview && s.mall === m.id && inReview(s));
    if (review) return reviewView(review, m);
    const stores = V.stores(m.id);
    const requests = stores.filter(inReview).sort((a, b2) => Number(b2.status === 'pending') - Number(a.status === 'pending'));
    const approved = stores.filter(s => !inReview(s));
    return page('المتاجر', UI.section('طلبات الانضمام', requests.length ? UI.status(UI.count(requests.filter(s => s.status === 'pending').length, 'request') + ' جديدة', 'wait') : '') +
      (requests.length ? `<div class="fh-list">${requests.map(s => { const [l, t] = storeStatus(s); return `<button type="button" class="fh-task-row" data-action="join-review" data-id="${esc(s.id)}"><span class="fh-icon-tile">${ic('file-clock')}</span><span><strong>${esc(s.name)}</strong><small>${UI.iso(s.floor)} · ${UI.ltr(s.email)}</small>${UI.status(l, t)}</span><b>${s.status === 'pending' ? 'مراجعة' : 'عرض'}</b></button>`; }).join('')}</div>`
        : `<p class="fh-footnote">${ic('info')}<span>لا طلبات معلّقة. تظهر هنا طلبات المتاجر التي تختار ${esc(m.name)}.</span></p>`) +
      UI.section('المتاجر المعتمدة', `<span class="fh-muted-small">${UI.count(approved.length, 'store')}</span>`) +
      `<div class="fh-list">${approved.map(s => `<section class="a-card fh-store-admin">
          <div class="fh-row">${V.storeLogo(s)}<div class="a-grow"><strong>${esc(s.name)}</strong><small>${esc(s.category)} · ${UI.iso(s.floor)}</small></div>${UI.status(s.active ? 'ظاهر للزوار' : 'موقوف', s.active ? 'ok' : 'muted')}</div>
          <p class="fh-muted-small">${s.email ? ic('user-round') + ' ' + UI.ltr(s.email) : 'لا يوجد حساب متجر بعد'}</p>
          <div class="fh-place-actions">${b(s.active ? 'إيقاف الظهور' : 'تفعيل الظهور', 'visit-store-active', 'ghost small', `data-id="${esc(s.id)}"`)}${s.email ? '' : b('إنشاء حساب', 'visit-existing-store', 'ghost small', `data-id="${esc(s.id)}"`)}</div>
        </section>`).join('') || UI.empty('store', 'لا متاجر معتمدة', 'اعتمد طلبات الانضمام أو أضف متجرًا.')}</div>`,
      b(ic('plus') + ' إضافة متجر مباشرة', 'visit-new-store', 'secondary'), 'mall-stores', false);
  };
  function reviewView(s, m) {
    const field = (label, value) => UI.line(label, value);
    const decided = s.status === 'rejected';
    return page('مراجعة طلب انضمام', `<section class="fh-org-head"><small>${esc(m.name)}</small><h2>${esc(s.name)}</h2>${UI.status(...storeStatus(s))}</section>` +
      UI.callout('gavel', 'القرار لك', 'الاعتماد يفعّل حساب المتجر وظهوره في هذا المول فقط. الرفض يُظهر السبب للمتجر ليعدّل الطلب.') +
      `<section class="a-card fh-review-block"><h3>${ic('store')} بيانات المتجر</h3>${field('النشاط', esc(s.category))}${field('الموقع', UI.iso(s.floor))}${field('السجل التجاري', UI.ltr(s.registration))}${field('مرجع الفرع', UI.ltr(s.lease))}</section>` +
      `<section class="a-card fh-review-block"><h3>${ic('user-round')} المسؤول</h3>${field('الاسم', esc(s.manager))}${field('الجوال', UI.ltr(UI.phone(s.phone)))}${field('البريد', UI.ltr(s.email))}${s.submittedAt ? field('تاريخ التقديم', date(s.submittedAt)) : ''}</section>` +
      `<section class="a-card fh-review-block"><h3>${ic('paperclip')} المستندات</h3>${(s.docs || []).map(d => { const url = V.joinDocURL(d.id); return `<div class="fh-doc">${ic('file-text')}<span>${esc(d.name)}</span>${url ? `<a href="${esc(url)}" download="${esc(d.name)}">تنزيل</a>` : '<small>غير متاح في هذا المتصفح</small>'}</div>`; }).join('') || '<p class="fh-muted-small">لا مرفقات.</p>'}</section>` +
      (s.reason ? UI.callout('history', 'سبب القرار السابق', esc(s.reason), 'warn') : s.previousReason ? UI.callout('history', 'أُعيد التقديم بعد رفض سابق', esc(s.previousReason)) : '') +
      form('join-decision', `<label class="a-check"><input type="checkbox" name="verified"><span>طابقت السجل التجاري ومرجع الفرع مع سجلات المول.</span></label>` +
        UI.field({ name: 'reason', label: 'ملاحظات أو سبب الرفض', placeholder: 'مطلوب عند الرفض · 5 أحرف على الأقل', attrs: 'maxlength="200"', hint: 'يظهر السبب للمتجر عند متابعة طلبه.' })) +
      `<div class="fh-inline-actions">${link(ic('arrow-right') + ' العودة إلى المتاجر', 'join-back')}</div>`,
      b(ic('circle-check') + ' اعتماد المتجر وتفعيل حسابه', 'join-approve') + b(decided ? 'تحديث سبب الرفض' : 'رفض مع ذكر السبب', 'join-reject', 'secondary'), 'mall-stores');
  }

  F.views['mall-parking'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const c = UI.parkingFor(m);
    return page('التسليم عند السيارة', `<p class="fh-lead">هذه البيانات تظهر للمتسوّق عند حفظ موقف سيارته في ${esc(m.name)}.</p>` +
      form('fh-mall-parking', UI.field({ name: 'point', label: 'نقطة خدمة Free Hand', value: m.point, attrs: 'maxlength="100"', hint: 'حيث يستلم المندوب الأكياس أو يلتقي المتسوّق.' }) +
        UI.field({ name: 'gates', label: 'البوابات', value: c.gates.join('، '), attrs: 'maxlength="300"', hint: 'افصل بينها بفاصلة. مثال: البوابة أ، البوابة ب' }) +
        UI.field({ name: 'levels', label: 'أدوار المواقف', value: c.levels.join('، '), attrs: 'maxlength="300"', hint: 'افصل بينها بفاصلة. مثال: الدور الأرضي، القبو B1' })) +
      `<p class="fh-footnote">${ic('info')}<span>الأماكن التي حفظها المتسوّقون تبقى كما هي حتى لو حُذفت بوابة من القائمة.</span></p>`,
      submit('حفظ بيانات المواقف'), 'mall-home');
  };
  F.forms['fh-mall-parking'] = d => {
    const m = approvedMall();
    if (A.session?.role !== 'mall' || !m) return;
    const list = v => [...new Set(String(v || '').split(/[,،]/).map(x => x.trim().slice(0, 40)).filter(Boolean))].slice(0, 12);
    const gates = list(d.gates), levels = list(d.levels), point = String(d.point || '').trim().slice(0, 100);
    if (!gates.length || !levels.length || !point) return F.toast('أدخل نقطة الخدمة وبوابة ودورًا واحدًا على الأقل.', true);
    m.parkingConfig = { gates, levels };
    m.point = point;
    V.save();
    F.go('mall-home', { replace: true });
    F.toast('تم حفظ بيانات المواقف');
  };

  F.views['mall-carriers'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const list = data.carriers.filter(c => c.mall === m.id);
    return page('التوصيل إلى المنزل', `<p class="fh-lead">تظهر الشركات المفعّلة فقط لمتسوّقي ${esc(m.name)}، حسب المدينة. الرسوم تُضاف إلى رسوم الجمع ${UI.cash(V.fee)}.</p>` +
      (list.length ? `<div class="fh-list">${list.map(c => `<section class="a-card fh-store-admin"><div class="fh-row"><span class="fh-icon-tile">${ic('truck')}</span><div class="a-grow"><strong>${esc(c.name)}</strong><small>${esc(c.eta)} · ${UI.cash(c.fee)}</small></div>${UI.status(c.active ? 'مفعّلة' : 'معطّلة', c.active ? 'ok' : 'muted')}</div>
          <p class="fh-muted-small">التغطية: ${esc(c.coverage.split(/[,،]/).length > 4 ? c.coverage.split(/[,،]/).slice(0, 4).join('، ') + ' و' + UI.num(c.coverage.split(/[,،]/).length - 4) + ' مدن أخرى' : c.coverage)}</p>
          <div class="fh-place-actions">${b(ic('pencil') + ' تعديل', 'visit-carrier-edit', 'ghost small', `data-id="${esc(c.id)}"`)}${b(c.active ? 'تعطيل' : 'تفعيل', 'visit-carrier-active', 'ghost small', `data-id="${esc(c.id)}"`)}</div></section>`).join('')}</div>`
        : UI.empty('truck', 'لا شركات توصيل', 'أضف شركة ليظهر خيار التوصيل إلى المنزل لزوار المول.')) +
      (list.some(c => c.example) ? '<p class="fh-footnote">الشركات المعلّمة كأمثلة للعرض، دون ربط فعلي بأنظمة الشحن.</p>' : ''),
      b(ic('plus') + ' إضافة شركة', 'visit-carrier-new', 'secondary'), 'mall-carriers', false);
  };

  const nextActor = o => o.exception ? 'إعادة جدولة التسليم بعد تعذّره' : ({
    collecting: o.stops.every(s => s.done) ? (o.destination === 'home' ? 'تسليم الطلب لشركة التوصيل' : 'بدء التوصيل إلى السيارة') : 'الاستلام من المتاجر',
    ready: 'التسليم للعميل عند سيارته', shipped: 'شركة التوصيل تسلّم للعميل', delivered: 'اكتمل', cancelled: 'ألغاه العميل'
  })[o.status] || '';
  UI.nextActor = nextActor;
  const bagsIn = stop => stop.invoices.map(id => V.get('invoices', id)).filter(Boolean).reduce((n, i) => n + (i.bags || 0), 0);
  UI.bagsIn = bagsIn;
  const taskIcon = o => o.exception || o.stops.some(s => s.issue && !s.issue.resolved) ? 'triangle-alert' : ({ collecting: 'store', ready: 'car-front', shipped: 'truck', delivered: 'circle-check', cancelled: 'circle-x' })[o.status] || 'route';
  // One card for every staff list: where to collect, how many bags, who has it, what is next.
  const orderCard = (o, action = '') => {
    const done = o.stops.filter(s => s.done).length;
    const [label, tone] = UI.staffStatus(o);
    const bags = o.stops.reduce((n, s) => n + bagsIn(s), 0);
    const stores = o.stops.map(s => { const st = V.get('stores', s.store); return `${esc(st?.name || 'متجر')} <bdi>(${esc(st?.floor || '')})</bdi>`; }).join('، ');
    const openIssues = o.stops.filter(s => s.issue && !s.issue.resolved).length;
    const inner = `<span class="fh-icon-tile${tone === 'error' || openIssues ? ' is-alert' : ''}">${ic(taskIcon(o))}</span><span><strong><bdi dir="ltr">${esc(o.id)}</bdi> ${UI.status(label, tone)}${openIssues ? ' ' + UI.status('ملاحظات: ' + UI.num(openIssues), 'wait') : ''}</strong>
      <small>${ic('store')} ${stores}</small>
      <small>${ic('shopping-bag')} ${UI.count(bags, 'bag')} · الاستلام ${UI.num(done)} من ${UI.num(o.stops.length)} · ${o.destination === 'home' ? 'إلى المنزل · ' + esc(o.carrier) : 'عند السيارة'}</small>
      <small>${ic('user-round')} ${o.assignee ? 'المكلّف: ' + esc(o.assignee.name) : 'غير مسندة بعد'}</small>
      ${UI.isClosed(o) ? '' : `<small class="fh-next-actor">${ic('arrow-left')} التالي: ${nextActor(o)}</small>`}</span>`;
    return action ? `<button type="button" class="fh-task-row" data-action="${action}" data-id="${esc(o.id)}">${inner}${ic('chevron-left')}</button>` : `<div class="fh-task-row">${inner}</div>`;
  };
  F.views['mall-live'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const orders = data.orders.filter(o => o.mall === m.id).slice().reverse();
    const active = orders.filter(o => !UI.isClosed(o));
    const closed = orders.filter(o => UI.isClosed(o));
    return page('طلبات الجمع', `<p class="fh-lead">متابعة فقط: يسجّل فريق الجمع والمندوب الخطوات من حساباتهم.</p>` +
      (orders.length ? (active.length ? UI.section('جارية') + `<div class="fh-list">${active.map(o => orderCard(o)).join('')}</div>` : '') +
        (closed.length ? UI.section('مكتملة أو ملغاة') + `<div class="fh-list">${closed.map(o => orderCard(o)).join('')}</div>` : '')
        : UI.empty('route', 'لا طلبات بعد', 'تظهر طلبات المتسوّقين هنا بعد الدفع وتأكيد الطلب.')), '', 'mall-home');
  };

  /* ---------- Free Hand admin: mall applications ---------- */
  F.views['admin-home'] = F.views['admin-malls'] = () => {
    const malls = data.malls.slice();
    const pending = malls.filter(m => m.status === 'pending');
    const rejected = malls.filter(m => m.status === 'rejected');
    const approved = malls.filter(m => m.status === 'approved');
    const row = m => { const [l, t] = mallStatus(m); return `<button type="button" class="fh-task-row" data-action="visit-admin-mall" data-id="${esc(m.id)}"><span class="fh-icon-tile">${ic(m.status === 'pending' ? 'file-clock' : 'building-2')}</span><span><strong>${esc(m.name)}</strong><small>${esc(m.city)} · ${esc(m.company)}${m.status === 'approved' ? ' · ' + UI.count(V.stores(m.id).filter(s => !inReview(s)).length, 'store') : ''}</small>${UI.status(l, t)}</span>${m.status === 'pending' ? '<b>مراجعة</b>' : ic('chevron-left')}</button>`; };
    return page('المولات', `<div class="fh-metrics"><div><strong>${UI.num(pending.length)}</strong><small>بانتظار قرارك</small></div><div><strong>${UI.num(rejected.length)}</strong><small>بانتظار تعديل المول</small></div><div><strong>${UI.num(approved.length)}</strong><small>مولات معتمدة</small></div></div>` +
      UI.section('بانتظار قرارك', pending.length ? UI.status(UI.count(pending.length, 'request'), 'wait') : '') +
      (pending.length ? `<div class="fh-list">${pending.map(row).join('')}</div>` : UI.callout('circle-check', 'لا طلبات تسجيل جديدة', 'تظهر هنا طلبات المولات الجديدة لمراجعتها واعتمادها أو رفضها.')) +
      (rejected.length ? UI.section('مرفوضة · بانتظار تعديل المول') + `<div class="fh-list">${rejected.map(row).join('')}</div>` : '') +
      UI.section('مولات معتمدة') + `<div class="fh-list">${approved.map(row).join('')}</div>` +
      `<p class="fh-footnote">${ic('info')}<span>يراجع فريق Free Hand تسجيل المولات. إدارة كل مول تراجع طلبات متاجرها.</span></p>`, '', 'admin-home', false);
  };
  let adminDocs = [];
  F.actions['visit-admin-mall'] = async btn => {
    const m = V.get('malls', btn.dataset.id);
    if (!m) return;
    adminDocs.forEach(d => URL.revokeObjectURL(d.url));
    adminDocs = [];
    for (const d of m.docFiles || []) {
      try { const f = await F.JoinDocuments.get(d.id); if (f) adminDocs.push({ id: d.id, url: URL.createObjectURL(f) }); } catch {}
    }
    F.s.visitReviewMall = m.id;
    F.go('admin-mall-review');
  };
  F.views['admin-mall-review'] = () => {
    const m = V.get('malls', F.s.visitReviewMall);
    if (!m) return F.views['admin-home']();
    const docs = m.docFiles?.length
      ? m.docFiles.map(d => { const url = adminDocs.find(x => x.id === d.id)?.url; return `<div class="fh-doc">${ic('file-text')}<span>${esc(d.name)}</span>${url ? `<a href="${esc(url)}" download="${esc(d.name)}">تنزيل</a>` : '<small>غير متاح في هذا المتصفح</small>'}</div>`; }).join('')
      : (m.docs || []).map(n => `<div class="fh-doc">${ic('file-text')}<span>${esc(n)}</span><small>الاسم فقط</small></div>`).join('') || `<p class="fh-muted-small">${m.status === 'approved' && !m.email ? 'مول ضمن بيانات العرض، دون مرفقات.' : 'لا مرفقات في هذا الطلب.'}</p>`;
    const next = { pending: UI.callout('gavel', 'القرار لك', 'الاعتماد يفتح لوحة المول ويُظهره للمتسوّقين. الرفض يُظهر السبب لإدارة المول لتعدّل الطلب وتعيد إرساله.'),
      rejected: UI.callout('hourglass', 'بانتظار إدارة المول', 'رُفض الطلب. يظهر لك مرة أخرى في «بانتظار قرارك» بعد أن تعدّله إدارة المول.'),
      approved: UI.callout('circle-check', 'مول معتمد', 'لوحة المول مفتوحة لإدارته، ويظهر للمتسوّقين.') }[m.status] || '';
    return page('طلب تسجيل مول', `<section class="fh-org-head"><small>${esc(m.city)}</small><h2>${esc(m.name)}</h2>${UI.status(...mallStatus(m))}</section>` + next +
      `<section class="a-card fh-review-block"><h3>${ic('building-2')} بيانات المول</h3>${UI.line('الجهة المشغّلة', esc(m.company))}${UI.line('المدينة', esc(m.city))}${UI.line('نقطة التسليم', esc(m.point))}${UI.line('بريد الحساب', m.email ? UI.ltr(m.email) : 'حساب عرض')}${m.status === 'approved' ? UI.line('المتاجر', UI.count(V.stores(m.id).length, 'store')) : ''}</section>` +
      `<section class="a-card fh-review-block"><h3>${ic('paperclip')} المستندات</h3>${docs}</section>` +
      (m.reason ? UI.callout('message-square-warning', 'سبب الرفض', esc(m.reason), 'warn') : m.previousReason ? UI.callout('history', 'أُعيد التقديم بعد رفض سابق', esc(m.previousReason)) : ''),
      m.status === 'pending' ? b(ic('circle-check') + ' اعتماد المول', 'visit-mall-approve') + b('رفض مع ذكر السبب', 'visit-mall-reject', 'secondary') : b('العودة إلى المولات', 'go:admin-home', 'secondary'), 'admin-home');
  };
  F.actions['visit-mall-reject'] = () => F.sheet('رفض طلب تسجيل المول',
    `<p class="fh-sheet-text">يظهر السبب لإدارة المول عند دخولها، لتعدّل الطلب وتعيد إرساله.</p>` +
    form('visit-reject', UI.field({ name: 'reason', label: 'سبب الرفض', placeholder: 'مثال: صورة السجل التجاري غير واضحة', attrs: 'maxlength="140"', hint: '5 أحرف على الأقل.' })),
    submit('تأكيد الرفض', 'danger') + b('تراجع', 'close-sheet', 'secondary'));
  const rejectMall = F.forms['visit-reject'];
  F.forms['visit-reject'] = d => {
    const reason = clean(d.reason, 140);
    if (reason.length < 5) return UI.showErrors({ reason: 'اكتب سببًا واضحًا (5 أحرف على الأقل).' }, { toast: false });
    rejectMall({ reason });
  };

  /* ---------- Store: link paid receipts ----------
     One focused screen: (1) identify the shopper by their QR / code, or by registered number as a
     fallback → (2) the cashier confirms the name → (3) the paid receipt and its bags. Editing the
     code or number clears an earlier match; the receipt draft is kept while the cashier recovers.
     A receipt barcode only fills receipt data; it never identifies the shopper. */
  const awaiting = s => data.orders.filter(o => o.status === 'collecting' && o.stops.some(t => t.store === s.id && !t.done));
  const storeReady = s => !!s && !inReview(s) && s.active;
  const cashierSteps = r => UI.steps(['تعريف العميل', 'تأكيد الاسم', 'الفاتورة'], r?.person ? 2 : r?.candidate ? 1 : 0);
  const blankInvoice = () => ({ mode: 'code', phone: '', code: '', candidate: null, person: null, miss: false, number: '', amount: '', bags: '1', items: '', source: 'manual' });
  // A shopper must have a Free Hand account. 0500000000 («نورة») is the seeded demo shopper account.
  function findShopper(phone) {
    const record = A.model.records['customer:' + phone];
    if (!record && phone !== '0500000000') return null;
    const usable = record?.name && record.name !== 'متسوق Free Hand';
    const name = usable ? UI.shortName(record) : phone === '0500000000' ? 'نورة' : '';
    return { phone, name, visitMall: data.visits[phone]?.mall || null };
  }
  const shopperName = p => p.name || 'بدون اسم مسجّل';

  F.views['merchant-home'] = () => {
    const s = ownStore();
    if (!s) return page('حساب المتجر', UI.empty('store', 'المتجر غير مرتبط بهذا الحساب', 'اطلب من إدارة المول إنشاء حساب لمتجرك أو قدّم طلب انضمام.'), b('تسجيل الخروج', 'auth-logout', 'secondary'), null, false);
    const m = mallOf(s.mall);
    const linked = data.invoices.filter(i => i.store === s.id);
    const preparing = linked.filter(i => !i.order && !UI.isReady(i));
    const waiting = awaiting(s);
    return page('المتجر', `<section class="fh-org-head"><small>${esc(m?.name || '')}</small><h2>${esc(s.name)}</h2><p>${UI.iso(s.floor)}${s.active ? '' : ' · موقوف حاليًا'}</p></section>` +
      (s.active ? '' : UI.callout('circle-pause', 'المتجر موقوف من إدارة المول', 'لا يمكن ربط فواتير جديدة حتى تعيد الإدارة تفعيله.', 'warn')) +
      `<section class="a-card fh-review-block"><h3>${ic('receipt-text')} ربط فاتورة مدفوعة</h3>
        <ol class="fh-mini-steps plain"><li><span>1</span>امسح رمز العميل أو اكتبه. إن لم يكن معه، ابحث برقم جواله المسجّل.</li><li><span>2</span>تأكد معه من اسمه.</li><li><span>3</span>أدخل رقم الفاتورة والمبلغ المدفوع وعدد الأكياس.</li></ol>
        <p class="fh-muted-small">تظهر الفاتورة فورًا في «المشتريات» لدى العميل في ${esc(m?.name || 'المول')}.</p></section>` +
      (preparing.length ? UI.callout('hourglass', `${UI.count(preparing.length, 'invoice')} بانتظار تجهيز الأكياس`, `حدّدها جاهزة من ${link('الفواتير المرتبطة', 'go:merchant-pickups')} ليتمكن العميل من طلب جمعها.`, 'warn') : '') +
      UI.section('جهّزها للمندوب', waiting.length ? UI.status(UI.count(waiting.length, 'order'), 'wait') : '') +
      (waiting.length ? `<div class="fh-list">${waiting.map(o => {
        const stop = o.stops.find(t => t.store === s.id);
        const inv = stop.invoices.map(id => V.get('invoices', id)).filter(Boolean);
        return `<section class="a-card fh-stop-card"><div class="fh-row"><strong><bdi dir="ltr">${esc(o.id)}</bdi></strong>${UI.status(stop.handedAt ? 'سلّمتها للمندوب' : 'بانتظار المندوب', stop.handedAt ? 'ok' : 'wait')}</div>
          <small>${ic('shopping-bag')} ${UI.count(UI.bagsIn(stop), 'bag')} · ${inv.map(i => `<bdi dir="ltr">${esc(i.number)}</bdi>`).join('، ')}</small>
          ${stop.issue && !stop.issue.resolved ? UI.callout('triangle-alert', 'ملاحظة فريق الجمع: ' + esc(UI.issueTypes[stop.issue.type] || ''), esc(stop.issue.note || 'تواصل مع فريق الجمع.'), 'warn') : ''}
          ${stop.handedAt ? `<small class="fh-next-actor">${ic('arrow-left')} التالي: فريق الجمع يؤكد الاستلام وعدد الأكياس</small>` : b(ic('hand') + ' سلّمت الأكياس للمندوب', 'fh-store-handover', 'secondary small', `data-id="${esc(o.id)}"`)}</section>`;
      }).join('')}</div>`
        : `<p class="fh-footnote">${ic('circle-check')}<span>لا طلبات بانتظار الاستلام من متجرك.</span></p>`) +
      `<section class="a-card fh-menu">${F.listButton('الفواتير المرتبطة', 'receipt-text', 'go:merchant-pickups', UI.count(linked.length, 'invoice'))}${F.listButton('ملف المتجر للزوار', 'store', 'go:merchant-profile')}</section>`,
      s.active ? b(ic('qr-code') + ' ربط فاتورة مدفوعة', 'visit-merchant-start') : '', 'merchant-home', false);
  };
  F.actions['fh-store-handover'] = btn => {
    const s = ownStore();
    const o = data.orders.find(x => x.id === btn.dataset.id && x.status === 'collecting');
    const stop = o?.stops.find(t => t.store === s?.id && !t.done);
    if (!stop) return;
    Object.assign(stop, { handedAt: new Date().toISOString(), handedBy: A.session.email });
    V.save();
    UI.rerender();
    F.toast('سُجّل تسليم الأكياس. ينتظر تأكيد فريق الجمع.');
  };

  F.views['merchant-register'] = () => {
    const s = ownStore();
    if (!s) return F.views['merchant-home']();
    const r = V.invoice ||= blankInvoice();
    const m = mallOf(s.mall);
    const c = r.candidate;
    const p = r.person;
    // The identifier field stays visible so the cashier can correct it; editing it clears the match below.
    const idField = r.mode === 'phone'
      ? UI.field({ name: 'invoice-phone', label: 'رقم جوال العميل المسجّل', value: r.phone, placeholder: '05XXXXXXXX', type: 'tel', attrs: 'dir="ltr" inputmode="numeric" maxlength="10" autocomplete="off"' })
      : (p || c ? '' : b(ic('scan-qr-code') + ' مسح رمز العميل', 'fh-scan', 'small')) +
        UI.field({ name: 'invoice-code', label: p || c ? 'رمز العميل' : 'أو اكتب الرمز الظاهر تحت QR', value: r.code, placeholder: 'XXXX-XXXX', attrs: 'dir="ltr" maxlength="12" autocomplete="off" autocapitalize="characters"' });
    let status = '';
    if (p) {
      status = `<div class="fh-person" role="status">${ic('circle-check')}<div><strong>${esc(shopperName(p))}</strong><small>${p.via === 'code' ? 'برمز العميل' : `برقم الجوال <bdi dir="ltr">${esc(V.mask(p.phone))}</bdi>`} · مؤكَّد</small></div><button type="button" class="fh-text-btn" data-action="fh-receipt-reset-person">تغيير</button></div>`;
    } else if (c) {
      status = `<div class="fh-match" role="status"><small>${c.via === 'code' ? 'رمز صالح لهذا المول' : 'وجدنا حسابًا بهذا الرقم'}</small>
          <div class="fh-match-id"><span class="fh-avatar">${ic('user-round')}</span><div><strong>${esc(shopperName(c))}</strong>${c.via === 'phone' ? `<bdi dir="ltr">${esc(V.mask(c.phone))}</bdi>` : ''}</div></div>
          <p>اسأل العميل عن اسمه قبل التأكيد.${c.visitMall && c.visitMall !== s.mall ? ` سيرى الفاتورة عند اختيار ${esc(m?.name || 'المول')} في التطبيق.` : ''}</p>
          <div class="fh-match-actions">${b(ic('check') + ' نعم، هذا العميل', 'fh-confirm-shopper', 'small')}${b('ليس هو', 'fh-receipt-reset-person', 'secondary small')}</div></div>`;
    } else if (r.mode === 'phone') {
      status = b(ic('search') + ' البحث عن العميل', 'fh-lookup', 'secondary small') +
        (r.miss ? UI.callout('user-x', 'لا يوجد حساب Free Hand بهذا الرقم', `تأكد من الرقم مع العميل. إذا لم يسجّل بعد، يدخل تطبيق Free Hand بالرقم نفسه ويختار ${esc(m?.name || 'المول')}، ثم ابحث مرة أخرى. بيانات الفاتورة محفوظة.`, 'warn') : '');
    } else {
      status = b(ic('shield-check') + ' تحقق من الرمز', 'fh-code-match', 'secondary small');
    }
    const switcher = p || c ? '' : r.mode === 'phone'
      ? `<button type="button" class="fh-text-btn" data-action="fh-mode" data-id="code">${ic('qr-code')} العودة إلى رمز العميل</button>`
      : `<button type="button" class="fh-text-btn" data-action="fh-mode" data-id="phone">${ic('smartphone')} العميل لا يحمل رمزه؟ البحث برقم الجوال</button>`;
    const shopper = idField + status + switcher;
    return page('ربط فاتورة', cashierSteps(r) +
      `<p class="fh-lead">فاتورة مدفوعة في <strong>${esc(s.name)}</strong>. تظهر للعميل في «المشتريات» في ${esc(m?.name || 'المول')}.</p>` +
      form('visit-invoice',
        `<fieldset class="fh-form-section"><legend><span class="fh-num">1</span> العميل</legend>${shopper}</fieldset>` +
        `<fieldset class="fh-form-section"><legend><span class="fh-num">2</span> الفاتورة المدفوعة</legend>` +
        (p ? '' : `<p class="fh-footnote">${ic('info')}<span>يمكنك إدخالها الآن؛ تُربط بعد تأكيد العميل.</span></p>`) +
        `<button type="button" class="fh-text-btn" data-action="visit-invoice-scan">${ic('scan-line')} تعبئة تجريبية من باركود الفاتورة</button>` +
        (r.source === 'scan' ? `<p class="fh-footnote">${ic('info')}<span>بيانات فاتورة عرض. الباركود يحدد الفاتورة فقط، لا العميل. راجعها قبل الربط.</span></p>` : '') +
        UI.field({ name: 'invoice-number', label: 'رقم الفاتورة', value: r.number, placeholder: 'INV-12345', attrs: 'dir="ltr" maxlength="45" autocomplete="off"', hint: 'كما في الفاتورة: أحرف إنجليزية وأرقام وشرطة.' }) +
        `<div class="a-grid2">${UI.field({ name: 'invoice-amount', label: 'المبلغ المدفوع (ر.س)', value: r.amount, placeholder: '0.00', attrs: 'dir="ltr" inputmode="decimal" maxlength="10"' })}${UI.field({ name: 'invoice-bags', label: 'عدد الأكياس', value: r.bags, placeholder: '1', attrs: 'dir="ltr" inputmode="numeric" maxlength="2"' })}</div>` +
        UI.field({ name: 'invoice-items', label: 'وصف المشتريات' + UI.optional, value: r.items, placeholder: 'مثال: قميص، بنطال', attrs: 'maxlength="80"', hint: 'يظهر للعميل ليميّز الفاتورة.' }) +
        `<label class="a-check"><input type="checkbox" name="invoice-ready"${r.ready === false ? '' : ' checked'}><span>الأكياس جاهزة للجمع الآن</span></label>` +
        '</fieldset>'),
      submit(ic('link') + (p ? ' ربط الفاتورة بحساب ' + esc(shopperName(p)) : ' ربط الفاتورة بحساب العميل')), 'merchant-register', false);
  };
  // Editing the number or code clears any earlier match; the receipt draft stays.
  F.$('#phone-app').addEventListener('input', e => {
    const r = V.invoice;
    if (!r || F.s.route !== 'merchant-register') return;
    const field = { 'invoice-code': 'code', 'invoice-phone': 'phone', 'invoice-items': 'items' }[e.target.name];
    if (!field) return;
    r[field] = e.target.value;
    if (field !== 'items' && (r.candidate || r.person || r.miss)) {
      Object.assign(r, { candidate: null, person: null, miss: false });
      const caret = e.target.selectionStart;
      const name = e.target.name;
      UI.rerender();
      const input = F.$(`[name="${name}"]`);
      input?.focus();
      input?.setSelectionRange(caret, caret);
    }
  });
  F.$('#phone-app').addEventListener('change', e => { if (e.target.name === 'invoice-ready' && V.invoice) V.invoice.ready = e.target.checked; });
  F.actions['visit-merchant-start'] = () => { V.invoice = blankInvoice(); F.go('merchant-register'); };
  F.actions['fh-mode'] = btn => {
    const r = V.invoice;
    if (!r) return;
    Object.assign(r, { mode: btn.dataset.id === 'phone' ? 'phone' : 'code', candidate: null, person: null, miss: false });
    UI.rerender();
    F.$(r.mode === 'phone' ? '[name="invoice-phone"]' : '[name="invoice-code"]')?.focus();
  };
  F.actions['fh-lookup'] = () => {
    const r = V.invoice;
    if (!r) return;
    const phone = F.digits(F.$('[name="invoice-phone"]')?.value ?? r.phone);
    r.phone = phone;
    if (!/^05\d{8}$/.test(phone)) return UI.showErrors({ 'invoice-phone': 'أدخل رقمًا من 10 أرقام يبدأ بـ 05.' }, { toast: false });
    const found = findShopper(phone);
    Object.assign(r, { candidate: found ? { ...found, via: 'phone' } : null, person: null, miss: !found });
    UI.rerender();
    F.$(found ? '[data-action="fh-confirm-shopper"]' : '[name="invoice-phone"]')?.focus();
  };
  // The code must be a live pass issued at this store's mall; blank, unknown, used or expired codes never match.
  function matchCode(text) {
    const r = V.invoice;
    const s = ownStore();
    if (!r || !s) return;
    r.code = String(text || '').trim();
    const result = UI.pass.check(text, s.mall);
    const found = result.pass && findShopper(result.pass.phone);
    if (!found) {
      Object.assign(r, { candidate: null, person: null, mode: 'code' });
      UI.rerender();
      return UI.showErrors({ 'invoice-code': r.code ? UI.passErrors[result.error || 'unknown'] : 'امسح الرمز أو اكتبه كما يظهر في تطبيق العميل.' }, { toast: false });
    }
    Object.assign(r, { mode: 'code', candidate: { ...found, via: 'code', code: result.pass.code }, person: null, miss: false, code: UI.pass.format(result.pass.code) });
    UI.rerender();
    F.$('[data-action="fh-confirm-shopper"]')?.focus();
  }
  F.actions['fh-code-match'] = () => matchCode(F.$('[name="invoice-code"]')?.value ?? V.invoice?.code);

  /* Scanner: camera (when the browser allows it) or a saved image of the code. Uses the built-in
     BarcodeDetector where available, otherwise jsQR, loaded only now. */
  const scan = { stream: null, timer: 0, detector: null };
  const stopScan = () => { clearTimeout(scan.timer); scan.stream?.getTracks().forEach(t => t.stop()); scan.stream = null; };
  async function decode(source, w, h) {
    if ('BarcodeDetector' in window) {
      try { scan.detector ||= new window.BarcodeDetector({ formats: ['qr_code'] }); const hit = (await scan.detector.detect(source))[0]; if (hit) return hit.rawValue; } catch {}
    }
    await UI.loadScript('assets/jsQR.min.js');
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, w, h);
    return window.jsQR?.(ctx.getImageData(0, 0, w, h).data, w, h)?.data || null;
  }
  F.actions['fh-scan'] = async () => {
    F.sheet('مسح رمز العميل', `<div class="fh-scan"><video id="fh-scan-video" playsinline muted aria-label="معاينة الكاميرا"></video>
      <p id="fh-scan-status" class="fh-scan-status" role="status">جارٍ تشغيل الكاميرا…</p>
      <label class="fh-scan-file a-button secondary small">${ic('image')}<span>اختيار صورة الرمز</span><input type="file" accept="image/*" id="fh-scan-file"></label></div>`,
      b('إغلاق', 'fh-scan-close', 'secondary'));
    const status = msg => { const el = document.getElementById('fh-scan-status'); if (el) el.textContent = msg; };
    const found = text => { stopScan(); F.closeSheet(); matchCode(text); };
    document.getElementById('fh-scan-file')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      status('جارٍ قراءة الصورة…');
      const img = new Image();
      img.src = URL.createObjectURL(file);
      try { await img.decode(); const text = await decode(img, img.naturalWidth, img.naturalHeight); if (text) return found(text); } catch {}
      finally { URL.revokeObjectURL(img.src); }
      status('لم نجد رمز QR في الصورة. جرّب صورة أوضح أو اكتب الرمز يدويًا.');
    });
    if (!navigator.mediaDevices?.getUserMedia) return status('الكاميرا غير متاحة في هذا المتصفح. اختر صورة الرمز أو اكتبه يدويًا.');
    try { scan.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
    catch { return status('لم يُسمح باستخدام الكاميرا. اختر صورة الرمز أو اكتبه يدويًا.'); }
    const video = document.getElementById('fh-scan-video');
    if (!video) return stopScan();
    video.srcObject = scan.stream;
    await video.play().catch(() => {});
    status('وجّه الكاميرا نحو رمز العميل.');
    const tick = async () => {
      if (!document.getElementById('fh-scan-video') || !scan.stream) return stopScan();
      if (video.readyState >= 2 && video.videoWidth) { const text = await decode(video, video.videoWidth, video.videoHeight).catch(() => null); if (text) return found(text); }
      scan.timer = setTimeout(tick, 300);
    };
    tick();
  };
  F.actions['fh-scan-close'] = () => { stopScan(); F.closeSheet(); };

  F.actions['fh-confirm-shopper'] = () => {
    const r = V.invoice;
    if (!r?.candidate) return;
    r.person = r.candidate;
    r.candidate = null;
    UI.rerender();
    F.$(r.number ? '#app-cta [type=submit]' : '[name="invoice-number"]')?.focus();
  };
  F.actions['fh-receipt-reset-person'] = () => {
    Object.assign(V.invoice, { candidate: null, person: null, miss: false, code: '' });
    UI.rerender();
    const input = F.$(V.invoice.mode === 'phone' ? '[name="invoice-phone"]' : '[name="invoice-code"]');
    input?.focus();
    input?.select();
  };
  F.actions['visit-invoice-scan'] = () => {
    const s = ownStore();
    const r = V.invoice;
    if (!s || !r) return;
    Object.assign(r, { number: V.uid('INV').toUpperCase(), amount: String(s.amount), bags: '1', source: 'scan' });
    UI.rerender();
  };
  let linking = false;
  F.forms['visit-invoice'] = async d => {
    const s = ownStore();
    const r = V.invoice;
    if (!s || !r || linking) return;
    if (!storeReady(s)) return F.toast('المتجر غير مفعّل حاليًا. تواصل مع إدارة المول.', true);
    const number = String(d['invoice-number'] || '').trim();
    const amountText = UI.latin(String(d['invoice-amount'] || '').trim()).replace(/[٫,]/g, '.');
    const bagsText = UI.latin(String(d['invoice-bags'] || '').trim());
    const errors = {};
    const who = r.mode === 'phone' ? 'invoice-phone' : 'invoice-code';
    if (!r.person) errors[who] = r.candidate ? 'أكّد اسم العميل أولًا: «نعم، هذا العميل».' : 'عرّف العميل وأكّد اسمه قبل الربط.';
    // A confirmed match is cleared as soon as the number or code is edited, so the state is current here.
    else if (r.person.via === 'code') { const again = UI.pass.check(r.person.code, s.mall); if (again.error) { r.person = null; errors[who] = UI.passErrors[again.error]; } }
    if (!/^[A-Za-z0-9][A-Za-z0-9\-\/]{2,44}$/.test(number)) errors['invoice-number'] = 'من 3 إلى 45 خانة: أحرف إنجليزية وأرقام وشرطة.';
    else if (data.invoices.some(i => i.store === s.id && i.number.toUpperCase() === number.toUpperCase())) errors['invoice-number'] = 'هذه الفاتورة مربوطة مسبقًا في متجرك.';
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0 || Number(amountText) > 100000) errors['invoice-amount'] = 'مبلغ بين 0.01 و100,000، بخانتين عشريتين كحد أقصى.';
    if (!/^\d{1,2}$/.test(bagsText) || Number(bagsText) < 1 || Number(bagsText) > 25) errors['invoice-bags'] = 'من 1 إلى 25.';
    if (Object.keys(errors).length) {
      if (!r.person && !r.candidate) UI.rerender();
      UI.showErrors(errors);
      if (r.candidate && !r.person) F.$('[data-action="fh-confirm-shopper"]')?.focus();
      return;
    }
    linking = true;
    try {
      await UI.busy('جارٍ الربط…', async () => {
        await UI.wait(350);
        const ready = !!d['invoice-ready'];
        const invoice = { id: V.uid('invoice'), mall: s.mall, store: s.id, phone: r.person.phone, number, amount: Math.round(Number(amountText) * 100) / 100, bags: Number(bagsText),
          items: String(d['invoice-items'] || '').trim().slice(0, 80), ready, readyAt: ready ? new Date().toISOString() : null,
          source: r.source, via: r.person.via, linkedBy: A.session.email, linkedAt: new Date().toISOString(), order: null };
        data.invoices.push(invoice);
        if (r.person.via === 'code') UI.pass.consume(r.person.code); // single use: no replay of a captured code
        V.save();
        V.invoice = blankInvoice();
        F.s.linkedInvoice = invoice.id;
        F.go('merchant-linked', { replace: true });
      });
      F.toast('تم ربط الفاتورة بحساب العميل');
    } finally { linking = false; }
  };
  F.views['merchant-linked'] = () => {
    const i = V.get('invoices', F.s.linkedInvoice);
    const s = ownStore();
    if (!i || i.store !== s?.id) return F.views['merchant-home']();
    const who = findShopper(i.phone);
    return page('تم ربط الفاتورة', `<section class="fh-success" role="status"><span class="fh-success-check">${ic('check')}</span><div><strong>رُبطت الفاتورة بحساب العميل</strong><small>تظهر الآن في «المشتريات» لديه في ${esc(mallOf(i.mall)?.name || 'المول')}.</small></div></section>` +
      `<section class="a-card fh-review-block">${UI.line('إلى', esc(who ? shopperName(who) : 'العميل') + ` · <bdi dir="ltr">${esc(V.mask(i.phone))}</bdi>`)}${UI.line('المول', esc(mallOf(i.mall)?.name || ''))}${UI.line('رقم الفاتورة', UI.ltr(i.number))}${UI.line('المبلغ المدفوع للمتجر', UI.cash(i.amount))}${UI.line('الأكياس', UI.count(i.bags, 'bag') + ' · ' + (UI.isReady(i) ? 'جاهزة للجمع' : 'قيد التجهيز'))}${i.items ? UI.line('الوصف', esc(i.items)) : ''}</section>` +
      UI.callout('package', 'التالي', UI.isReady(i) ? 'احتفظ بالأكياس جاهزة. عندما يطلب العميل الجمع، يظهر الطلب في «جهّزها للمندوب».' : 'حدّد الأكياس جاهزة من «الفواتير المرتبطة» عند انتهاء تجهيزها.'),
      b(ic('plus') + ' ربط فاتورة أخرى', 'visit-merchant-start') + b('الفواتير المرتبطة', 'go:merchant-pickups', 'secondary'), 'merchant-register', false);
  };
  F.views['merchant-pickups'] = () => {
    const s = ownStore();
    if (!s) return F.views['merchant-home']();
    const invoices = data.invoices.filter(i => i.store === s.id).slice().reverse();
    return page('الفواتير المرتبطة', invoices.length ? `<div class="fh-list">${invoices.map(i => {
      const o = data.orders.find(x => x.id === i.order);
      const stop = o?.stops.find(t => t.store === s.id);
      const [label, tone, next] = stop?.done ? ['استلمها المندوب', 'ok', ''] : o ? ['بانتظار المندوب', 'wait', 'سلّم الأكياس للمندوب'] : !UI.isReady(i) ? ['قيد التجهيز', 'wait', 'جهّز الأكياس وحدّدها جاهزة'] : ['محفوظة للعميل', 'muted', 'العميل يطلب الجمع من التطبيق'];
      return `<div class="fh-task-row"><span class="fh-icon-tile">${ic('receipt-text')}</span><span><strong>فاتورة <bdi dir="ltr">${esc(i.number)}</bdi> ${UI.status(label, tone)}</strong><small><bdi dir="ltr">${esc(V.mask(i.phone))}</bdi> · ${UI.cash(i.amount)} · ${UI.count(i.bags, 'bag')}${o ? ` · <bdi dir="ltr">${esc(o.id)}</bdi>` : ''}${i.source === 'demo' ? ' · تجريبية' : ''}</small>${i.items ? `<small>${esc(i.items)}</small>` : ''}${next ? `<small class="fh-next-actor">${ic('arrow-left')} التالي: ${next}</small>` : ''}
        ${!o && !UI.isReady(i) ? b(ic('package-check') + ' الأكياس جاهزة', 'fh-receipt-ready', 'secondary small', `data-id="${esc(i.id)}"`) : ''}</span></div>`;
    }).join('')}</div>` : UI.empty('receipt-text', 'لا فواتير مرتبطة', 'اربط فاتورة مدفوعة برمز العميل أو رقم جواله لتظهر هنا.'),
      b(ic('plus') + ' ربط فاتورة مدفوعة', 'visit-merchant-start'), 'merchant-home');
  };
  F.actions['fh-receipt-ready'] = btn => {
    const i = data.invoices.find(x => x.id === btn.dataset.id && x.store === ownStore()?.id && !x.order);
    if (!i) return;
    Object.assign(i, { ready: true, readyAt: new Date().toISOString() });
    V.save();
    UI.rerender();
    F.toast('الأكياس جاهزة. يستطيع العميل طلب جمعها الآن.');
  };

  /* ---------- Operations team and delivery partner ----------
     Operations accounts see their own mall; the delivery partner serves every mall in the prototype.
     Bag custody: store hands over (store screen) → collector confirms the count (here) → car or
     carrier delivery → delivered. Issues and failed deliveries are recorded, not hidden. */
  const visibleOrders = () => data.orders.filter(o => A.session?.role !== 'operations' || o.mall === (A.session.org || 'front'));
  const taskOrder = () => visibleOrders().find(o => o.id === F.s.visitDeliveryOrder);
  const isOps = () => A.session?.role === 'operations';
  const staffName = () => A.session?.name || UI.roleNames[A.session?.role] || 'الفريق';
  F.views['delivery-home'] = F.views['ops-home'] = () => {
    const orders = visibleOrders().slice().reverse();
    const closed = orders.filter(o => UI.isClosed(o));
    const collecting = orders.filter(o => o.status === 'collecting');
    const onTheWay = orders.filter(o => ['ready', 'shipped'].includes(o.status));
    const list = (title, items, tone) => items.length ? UI.section(title, UI.status(UI.count(items.length, 'order'), tone)) + `<div class="fh-list">${items.map(o => orderCard(o, 'visit-delivery-order')).join('')}</div>` : '';
    // Collection staff start with pickups; delivery staff start with handovers to shoppers.
    const sections = isOps()
      ? list('بحاجة إلى استلام من المتاجر', collecting, 'wait') + list('في الطريق إلى العميل', onTheWay, 'info')
      : list('جاهزة للتسليم', onTheWay, 'wait') + list('قيد الجمع من المتاجر', collecting, 'info');
    const scope = isOps() ? 'طلبات ' + esc(mallOf(A.session.org || 'front')?.name || 'المول') : 'طلبات كل المولات المشاركة';
    return page(isOps() ? 'مهام الجمع' : 'مهام التوصيل', `<p class="fh-lead">${scope}.</p>` +
      (orders.length ? (sections || UI.callout('circle-check', 'لا مهام جارية', 'كل الطلبات مكتملة.')) + (closed.length ? UI.section('مكتملة أو ملغاة') + `<div class="fh-list">${closed.map(o => orderCard(o, 'visit-delivery-order')).join('')}</div>` : '')
        : UI.empty('route', 'لا مهام بعد', 'تظهر المهمة بعد دفع المتسوّق وتأكيد طلب الجمع.')),
      '', isOps() ? 'ops-home' : 'delivery-home', false);
  };
  F.views['delivery-task'] = F.views['ops-task'] = () => {
    const o = taskOrder();
    if (!o) return F.views['delivery-home']();
    const done = o.stops.filter(s => s.done).length;
    const all = done === o.stops.length;
    const home = o.destination === 'home';
    const place = o.deliveryPlace;
    const m = mallOf(o.mall);
    const [label] = UI.staffStatus(o);
    const closed = UI.isClosed(o);
    const cta = { collecting: home ? `${ic('truck')} تسليم الطلب إلى ${esc(o.carrier)}` : `${ic('car-front')} بدء التوصيل إلى السيارة`, ready: `${ic('package-check')} تأكيد التسليم عند السيارة`, shipped: `${ic('package-check')} تأكيد تسليم الشحنة` }[o.status];
    const destination = home
      ? `${UI.line('شركة التوصيل', esc(o.carrier) + (o.carrierEta ? ' · ' + esc(o.carrierEta) : ''))}${UI.line('العنوان', esc([o.address, o.city].filter(Boolean).join('، ')))}`
      : `${UI.line('مكان السيارة', esc(place ? UI.placeSummary(place) : o.point))}`;
    const notes = o.deliveryNotes || place?.notes;
    const stopCard = stop => {
      const s = V.get('stores', stop.store);
      const inv = stop.invoices.map(id => V.get('invoices', id)).filter(Boolean);
      const issue = stop.issue && !stop.issue.resolved ? stop.issue : null;
      const [st, tone] = stop.done ? [stop.receivedBags != null && stop.receivedBags < UI.bagsIn(stop) ? 'استُلم مع نقص' : 'تم الاستلام', stop.receivedBags != null && stop.receivedBags < UI.bagsIn(stop) ? 'wait' : 'ok'] : stop.handedAt ? ['سلّمها المتجر · أكّد العدد', 'info'] : ['بانتظار الاستلام', 'wait'];
      return `<section class="a-card fh-stop-card${stop.done ? ' is-done' : ''}">
        <div class="fh-row"><strong>${esc(s?.name || 'متجر')}</strong>${UI.status(st, tone)}</div>
        <small>${ic('map-pin')} ${UI.iso(s?.floor || '')} · ${ic('shopping-bag')} ${UI.count(UI.bagsIn(stop), 'bag')}${stop.receivedBags != null ? ` · المستلم: ${UI.num(stop.receivedBags)}` : ''}</small>
        <p class="fh-muted-small">${inv.map(i => `فاتورة <bdi dir="ltr">${esc(i.number)}</bdi>`).join('، ')}</p>
        ${issue ? UI.callout('triangle-alert', esc(UI.issueTypes[issue.type] || 'ملاحظة'), esc(issue.note || '') + (issue.by ? `<br><small>سجّلها ${esc(issue.by)}</small>` : ''), 'warn') : ''}
        ${!stop.done && o.status === 'collecting' ? `<div class="fh-stop-actions">${b(ic('check') + ' تأكيد الاستلام', 'fh-pickup-open', 'secondary small', `data-id="${esc(stop.store)}"`)}${b(ic('flag') + ' إبلاغ', 'fh-issue-open', 'ghost small', `data-id="${esc(stop.store)}"`)}</div>` : ''}
        ${issue ? b(ic('circle-check') + ' حُلّت الملاحظة', 'fh-issue-resolve', 'ghost small', `data-id="${esc(stop.store)}"`) : ''}</section>`;
    };
    let footer = '';
    if (!closed) {
      if (o.exception) footer = b(ic('rotate-ccw') + ' إعادة محاولة التسليم', 'fh-exception-clear');
      else if (o.status === 'collecting') footer = b(all ? cta : `${ic('lock')} أكمل الاستلام من المتاجر أولًا`, 'visit-delivery-next', '', all ? '' : 'disabled');
      else footer = b(cta, 'fh-confirm-delivery') + b(ic('circle-alert') + ' تعذّر التسليم', 'fh-delivery-fail', 'secondary');
    }
    return page('طلب ' + o.id, `<section class="fh-org-head"><small>${esc(m?.name || '')} · <bdi dir="ltr">${esc(o.id)}</bdi></small><h2>${label}</h2>
        ${closed ? '' : `<p class="fh-next-actor light">${ic('arrow-left')} التالي: ${nextActor(o)}</p>`}</section>` +
      (o.exception ? UI.callout('circle-alert', 'تعذّر التسليم: ' + esc(UI.failReasons[o.exception.reason] || ''), esc(o.exception.note || '') + `<br><small>المحاولات: ${UI.num(o.attempts || 1)}</small>`, 'warn') : '') +
      `<section class="a-card fh-assign"><span class="fh-icon-tile">${ic('user-round')}</span><div><small>المكلّف بالمهمة</small><strong>${o.assignee ? esc(o.assignee.name) : 'غير مسندة'}</strong></div>
        ${closed || o.assignee?.email === A.session?.email ? '' : b(o.assignee ? 'نقلها إليّ' : 'استلام المهمة', 'fh-assign', 'small')}</section>` +
      UI.section('الاستلام من المتاجر', `<span class="fh-muted-small">${UI.num(done)} من ${UI.num(o.stops.length)}</span>`) +
      `<div class="fh-list">${o.stops.map(stopCard).join('')}</div>` +
      `<section class="a-card fh-review-block"><h3>${ic('warehouse')} نقطة التجميع</h3><p>${esc(m?.point || 'نقطة خدمة Free Hand في المول')}</p></section>` +
      `<section class="a-card fh-review-block"><h3>${ic(home ? 'house' : 'car-front')} ${home ? 'التوصيل إلى المنزل' : 'التسليم عند السيارة'}</h3>${destination}${notes ? `<p class="fh-muted-small">${ic('message-square')} ${esc(notes)}</p>` : ''}
        ${o.coordinates ? `<a class="fh-map-link" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(o.coordinates.lat)}&amp;mlon=${encodeURIComponent(o.coordinates.lng)}#map=18/${encodeURIComponent(o.coordinates.lat)}/${encodeURIComponent(o.coordinates.lng)}" target="_blank" rel="noopener noreferrer">${ic('map-pinned')} فتح نقطة التسليم على الخريطة</a>` : ''}</section>`,
      footer, isOps() ? 'ops-home' : 'delivery-home');
  };
  const stopOf = id => taskOrder()?.stops.find(s => s.store === id);
  const assignToMe = o => { o.assignee = { name: staffName(), email: A.session.email, role: A.session.role, at: new Date().toISOString() }; };
  F.actions['fh-assign'] = () => { const o = taskOrder(); if (!o || UI.isClosed(o)) return; assignToMe(o); V.save(); UI.rerender(); F.toast('أصبحت المهمة مسندة إليك'); };

  // Pickup: the collector confirms how many bags were actually received from the store.
  F.actions['fh-pickup-open'] = btn => {
    const stop = stopOf(btn.dataset.id);
    if (!stop || stop.done) return;
    const s = V.get('stores', stop.store);
    F.sheet('تأكيد الاستلام من ' + (s?.name || 'المتجر'), `<p class="fh-sheet-text">المتوقع: ${UI.count(UI.bagsIn(stop), 'bag')}${stop.handedAt ? ' · سجّل المتجر التسليم' : ''}. عُدّ الأكياس قبل التأكيد.</p>` +
      form('fh-pickup', `<input type="hidden" name="store" value="${esc(stop.store)}">` +
        UI.field({ name: 'count', label: 'عدد الأكياس المستلمة', value: String(UI.bagsIn(stop)), attrs: 'dir="ltr" inputmode="numeric" maxlength="2"' }) +
        UI.field({ name: 'note', label: 'ملاحظة' + UI.optional, placeholder: 'مطلوبة إذا اختلف العدد', attrs: 'maxlength="140"' })),
      submit(ic('check') + ' تأكيد الاستلام') + b('تراجع', 'close-sheet', 'secondary'));
  };
  F.forms['fh-pickup'] = d => {
    const o = taskOrder();
    const stop = stopOf(d.store);
    if (!o || !stop || stop.done || o.status !== 'collecting') return;
    const count = UI.latin(String(d.count || '').trim());
    const expected = UI.bagsIn(stop);
    const note = String(d.note || '').trim().slice(0, 140);
    if (!/^\d{1,2}$/.test(count)) return UI.showErrors({ count: 'أدخل عدد الأكياس (0 إلى 99).' }, { toast: false });
    const received = Number(count);
    if (received !== expected && note.length < 3) return UI.showErrors({ note: 'اكتب ملاحظة قصيرة لأن العدد يختلف عن المتوقع.' }, { toast: false });
    if (!o.assignee) assignToMe(o);
    if (received === 0) {
      stop.issue = { type: 'not-ready', note: note || 'لم تُستلم أي أكياس.', at: new Date().toISOString(), by: staffName() };
      V.save(); F.closeSheet(); UI.rerender();
      return F.toast('سُجّلت الملاحظة. لم يُؤكد الاستلام.', true);
    }
    Object.assign(stop, { receivedBags: received, expectedBags: expected, receivedAt: new Date().toISOString() });
    if (received < expected) stop.issue = { type: 'missing', note, at: new Date().toISOString(), by: staffName() };
    F.closeSheet();
    F.actions['visit-stop-pickup']({ dataset: { id: stop.store } }); // marks the stop collected
    if (received < expected) F.toast('سُجّل الاستلام مع نقص في الأكياس', true);
  };
  F.actions['fh-issue-open'] = btn => {
    const stop = stopOf(btn.dataset.id);
    if (!stop) return;
    F.sheet('إبلاغ عن مشكلة', form('fh-issue', `<input type="hidden" name="store" value="${esc(stop.store)}">` +
        UI.selectField({ name: 'type', label: 'نوع المشكلة', options: Object.entries(UI.issueTypes), value: 'not-ready' }) +
        UI.field({ name: 'note', label: 'التفاصيل', placeholder: 'ماذا حدث؟ ومن تواصلت معه؟', attrs: 'maxlength="140"' })),
      submit('حفظ الملاحظة') + b('تراجع', 'close-sheet', 'secondary'));
  };
  F.forms['fh-issue'] = d => {
    const stop = stopOf(d.store);
    if (!stop || !UI.issueTypes[d.type]) return;
    const note = String(d.note || '').trim().slice(0, 140);
    if (note.length < 3) return UI.showErrors({ note: 'اكتب تفاصيل قصيرة للمشكلة.' }, { toast: false });
    stop.issue = { type: d.type, note, at: new Date().toISOString(), by: staffName() };
    V.save(); F.closeSheet(); UI.rerender();
    F.toast('سُجّلت الملاحظة، وتظهر للمتجر والعميل');
  };
  F.actions['fh-issue-resolve'] = btn => {
    const stop = stopOf(btn.dataset.id);
    if (!stop?.issue) return;
    Object.assign(stop.issue, { resolved: true, resolvedAt: new Date().toISOString(), resolvedBy: staffName() });
    V.save(); UI.rerender();
  };

  // Delivery: confirm, or record why it failed and retry later.
  F.actions['fh-confirm-delivery'] = () => {
    const o = taskOrder();
    if (!o || !['ready', 'shipped'].includes(o.status) || o.exception) return;
    F.sheet('تأكيد التسليم؟', `<p class="fh-sheet-text">تأكّد من استلام العميل لطلب <bdi dir="ltr">${esc(o.id)}</bdi> (${UI.count(o.stops.reduce((n, s) => n + (s.receivedBags ?? UI.bagsIn(s)), 0), 'bag')}). لا يمكن التراجع بعد التأكيد.</p>`,
      b(ic('package-check') + ' نعم، تم التسليم', 'fh-delivery-done') + b('تراجع', 'close-sheet', 'secondary'));
  };
  F.actions['fh-delivery-done'] = () => { F.closeSheet(); F.actions['visit-delivery-next'](); };
  F.actions['fh-delivery-fail'] = () => {
    const o = taskOrder();
    if (!o || !['ready', 'shipped'].includes(o.status)) return;
    F.sheet('تعذّر التسليم', form('fh-fail', UI.selectField({ name: 'reason', label: 'السبب', options: Object.entries(UI.failReasons), value: 'unreachable' }) +
        UI.field({ name: 'note', label: 'ملاحظة' + UI.optional, placeholder: 'مثال: اتصلت مرتين دون رد', attrs: 'maxlength="140"' })),
      submit('حفظ وإعادة الجدولة') + b('تراجع', 'close-sheet', 'secondary'));
  };
  F.forms['fh-fail'] = d => {
    const o = taskOrder();
    if (!o || !['ready', 'shipped'].includes(o.status) || !UI.failReasons[d.reason]) return;
    o.exception = { reason: d.reason, note: String(d.note || '').trim().slice(0, 140), at: new Date().toISOString(), by: staffName() };
    o.attempts = (o.attempts || 0) + 1;
    V.save(); F.closeSheet(); UI.rerender();
    F.toast('سُجّل تعذّر التسليم، ويرى العميل المطلوب منه');
  };
  F.actions['fh-exception-clear'] = () => {
    const o = taskOrder();
    if (!o?.exception) return;
    o.lastException = o.exception;
    o.exception = null;
    V.save(); UI.rerender();
    F.toast('أُعيدت جدولة التسليم');
  };
  const guard = action => { const original = F.actions[action]; F.actions[action] = btn => { if (!taskOrder()) return F.toast('هذا الطلب خارج نطاق حسابك.', true); original(btn); }; };
  guard('visit-stop-pickup');
  guard('visit-delivery-next');
  const openTask = F.actions['visit-delivery-order'];
  F.actions['visit-delivery-order'] = btn => { if (!visibleOrders().some(o => o.id === btn.dataset.id)) return F.toast('هذا الطلب خارج نطاق حسابك.', true); openTask(btn); };

  /* ---------- Business account ---------- */
  F.views['auth-account'] = () => page('الحساب', `<section class="a-card fh-identity"><span class="fh-avatar big">${ic('user-round')}</span><div><strong>${esc(A.session?.organization || A.session?.name || '')}</strong><small>${esc(UI.roleNames[A.session?.role] || '')}</small><bdi dir="ltr">${esc(A.session?.email || '')}</bdi></div></section>` +
    `<section class="a-card fh-menu">${F.listButton('الصفحة الرئيسية', 'layout-dashboard', 'auth-home')}${F.listButton('تغيير كلمة المرور', 'lock-keyhole', 'go:auth-password')}${F.listButton('أدوات العرض', 'flask-conical', 'fh-demo-tools')}</section>`,
    b(ic('log-out') + ' تسجيل الخروج', 'auth-logout', 'secondary'), 'auth-account', false);

  /* ---------- Remaining management forms in the shared design ---------- */
  // A mall manager can create a store account directly; the password needs confirmation like every other flow.
  F.views['mall-store-new'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const s = V.get('stores', F.s.visitEditStore);
    return page(s ? 'حساب المتجر' : 'إضافة متجر',
      `<p class="fh-lead">${s ? `حساب دخول لمتجر ${esc(s.name)} في ${esc(m.name)}.` : `متجر جديد معتمد مباشرة في ${esc(m.name)}، مع حساب دخول لموظفيه.`}</p>` + UI.requiredNote +
      form('visit-mall-store', (s ? '' : section('المتجر', text('name', 'اسم المتجر', 'اسم المتجر', 'maxlength="65"') + `<div class="a-grid2">${text('category', 'التصنيف', 'أزياء، أحذية…', 'maxlength="40"')}${text('floor', 'الدور ورقم المحل', 'الأرضي · A12', 'maxlength="50"')}</div>`)) +
        section('حساب المتجر', UI.field({ name: 'email', label: 'بريد المتجر', value: draft('email'), placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120"' }) +
          passwordField('password', 'كلمة المرور', 'new-password', policy) + passwordField('confirm', 'تأكيد كلمة المرور', 'new-password'))),
      submit(s ? 'إنشاء حساب المتجر' : 'إضافة المتجر وإنشاء حسابه'), 'mall-stores');
  };
  const mallStore = F.forms['visit-mall-store'];
  F.forms['visit-mall-store'] = async d => {
    if (UI.isBusy()) return;
    const existing = V.get('stores', F.s.visitEditStore);
    const email = clean(d.email, 120).toLowerCase();
    const errors = {};
    if (!existing) {
      if (clean(d.name, 65).length < 2) errors.name = 'أدخل اسم المتجر.';
      if (clean(d.category, 40).length < 2) errors.category = 'أدخل التصنيف.';
      if (clean(d.floor, 50).length < 2) errors.floor = 'أدخل الدور ورقم المحل.';
    }
    if (!A.validEmail(email)) errors.email = 'أدخل بريدًا إلكترونيًا صحيحًا.';
    else if (emailTaken(email)) errors.email = 'هذا البريد مرتبط بحساب آخر.';
    Object.assign(errors, UI.passwordErrors(d.password, d.confirm));
    if (UI.showErrors(errors)) return;
    await mallStore(d);
  };

  F.views['mall-carrier-edit'] = () => {
    if (!approvedMall()) return F.views['u-mall-status']();
    const c = V.get('carriers', F.s.visitEditCarrier);
    const v = (k, fallback) => F.draft[k] ?? fallback ?? '';
    return page(c ? 'تعديل شركة التوصيل' : 'إضافة شركة توصيل', UI.requiredNote +
      form('visit-carrier', UI.field({ name: 'name', label: 'اسم الشركة', value: v('name', c?.name), attrs: 'maxlength="65"' }) +
        UI.field({ name: 'coverage', label: 'المدن المشمولة', value: v('coverage', c?.coverage), placeholder: 'الرياض، الدرعية', attrs: 'maxlength="400"', hint: 'افصل بين المدن بفاصلة.' }) +
        `<div class="a-grid2">${UI.field({ name: 'eta', label: 'مدة التوصيل', value: v('eta', c?.eta), placeholder: 'خلال 24 ساعة', attrs: 'maxlength="45"' })}${UI.field({ name: 'fee', label: 'الرسوم (ر.س)', value: v('fee', c?.fee), placeholder: '0', attrs: 'dir="ltr" inputmode="decimal" maxlength="7"' })}</div>`),
      submit('حفظ الشركة'), 'mall-carriers');
  };
  const saveCarrier = F.forms['visit-carrier'];
  F.forms['visit-carrier'] = d => {
    const fee = UI.latin(String(d.fee || '')).trim();
    const errors = {};
    if (clean(d.name, 65).length < 2) errors.name = 'أدخل اسم الشركة.';
    if (clean(d.coverage, 400).length < 2) errors.coverage = 'أدخل مدينة واحدة على الأقل.';
    if (clean(d.eta, 45).length < 2) errors.eta = 'أدخل مدة التوصيل.';
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(fee)) errors.fee = 'رسوم من 0 إلى 999 ريالًا.';
    if (UI.showErrors(errors)) return;
    saveCarrier({ ...d, fee });
  };

  F.views['merchant-profile'] = () => {
    const s = ownStore();
    if (!s) return F.views['merchant-home']();
    return page('ملف المتجر', `<p class="fh-lead">هذه البيانات تظهر لزوار ${esc(mallOf(s.mall)?.name || 'المول')} في قائمة المتاجر.</p>` +
      ((s.logo || s.photo) ? `<section class="a-card fh-store-card">${V.storeLogo(s)}<div><strong>الشعار والصورة الحالية</strong>${s.photo ? `<img class="visit-photo" src="${esc(s.photo)}" alt="صورة المتجر الحالية">` : ''}</div></section>` : '') + UI.requiredNote +
      form('visit-store-profile', section('البيانات', UI.field({ name: 'name', label: 'اسم المتجر', value: s.name, attrs: 'maxlength="65"' }) + UI.field({ name: 'category', label: 'التصنيف', value: s.category, attrs: 'maxlength="40"' }) +
          UI.textarea({ name: 'description', label: 'وصف المتجر' + UI.optional, value: s.description || '', attrs: 'maxlength="180" rows="3"' }) +
          `<div class="a-grid2">${UI.field({ name: 'hours', label: 'أوقات العمل' + UI.optional, value: s.hours || '', placeholder: '10 ص – 11 م', attrs: 'maxlength="60"' })}${UI.field({ name: 'contact', label: 'التواصل' + UI.optional, value: s.contact || '', attrs: 'maxlength="70"' })}</div>`) +
        section('الصور', `<label class="a-field fh-field fh-file"><span class="fh-label">شعار المتجر${UI.optional}</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp"><small class="fh-hint">PNG أو JPG أو WebP حتى 350 كيلوبايت</small></label>
          <label class="a-field fh-field fh-file"><span class="fh-label">صورة المتجر${UI.optional}</span><input type="file" name="photo" accept="image/png,image/jpeg,image/webp"><small class="fh-hint">PNG أو JPG أو WebP حتى 350 كيلوبايت</small></label>`)),
      submit('حفظ ملف المتجر'), 'merchant-home');
  };

  /* ---------- Navigation per role ---------- */
  F.tabs.mall = [['mall-home', 'الرئيسية', 'layout-dashboard'], ['mall-stores', 'المتاجر', 'store'], ['mall-carriers', 'التوصيل', 'truck'], ['auth-account', 'الحساب', 'user-round']];
  F.tabs.merchant = [['merchant-home', 'المتجر', 'store'], ['merchant-register', 'ربط فاتورة', 'link'], ['merchant-pickups', 'الفواتير', 'receipt-text'], ['auth-account', 'الحساب', 'user-round']];
  F.tabs.admin = [['admin-home', 'المولات', 'building-2'], ['auth-account', 'الحساب', 'user-round']];
  F.tabs.operations = [['ops-home', 'مهام الجمع', 'route'], ['auth-account', 'الحساب', 'user-round']];
  F.tabs.delivery = [['delivery-home', 'مهام التوصيل', 'truck'], ['auth-account', 'الحساب', 'user-round']];

  /* ---------- Role guards on handlers ----------
     Routes are already limited per role (access.js, visit-work.js). Each sensitive action and form
     handler also checks the signed-in role and its approval state, so a handler called directly
     (stale screen, console, tampered button) does nothing outside the account's scope.
     This is browser-side only; the full build must enforce the same rules on the server. */
  const approvedStore = () => { const s = ownStore(); return !!s && !inReview(s); };
  const scopes = {
    admin: { roles: ['admin'], actions: ['visit-admin-mall', 'visit-mall-approve', 'visit-mall-reject'], forms: ['visit-reject'] },
    mall: { roles: ['mall'], when: () => !!approvedMall(),
      actions: ['join-review', 'join-approve', 'join-reject', 'join-back', 'visit-store-active', 'visit-new-store', 'visit-existing-store', 'visit-carrier-new', 'visit-carrier-edit', 'visit-carrier-active'],
      forms: ['visit-mall-store', 'visit-carrier', 'fh-mall-parking', 'join-decision'] },
    mallApplicant: { roles: ['mall'], forms: ['fh-mall-resubmit'] },
    merchant: { roles: ['merchant'], when: approvedStore,
      actions: ['visit-merchant-start', 'fh-lookup', 'fh-mode', 'fh-code-match', 'fh-scan', 'fh-confirm-shopper', 'fh-receipt-reset-person', 'visit-invoice-scan', 'fh-store-handover', 'fh-receipt-ready'],
      forms: ['visit-invoice', 'visit-store-profile'] },
    field: { roles: ['operations', 'delivery'], actions: ['visit-delivery-order', 'visit-stop-pickup', 'visit-delivery-next', 'fh-confirm-delivery', 'fh-delivery-done', 'fh-assign', 'fh-pickup-open', 'fh-issue-open', 'fh-issue-resolve', 'fh-delivery-fail', 'fh-exception-clear'],
      forms: ['fh-pickup', 'fh-issue', 'fh-fail'] },
    shopper: { roles: ['customer'],
      actions: ['fh-demo-receipts', 'visit-sample', 'visit-finish', 'visit-select-mall', 'fh-my-code', 'fh-pass-save', 'fh-edit-name', 'fh-toggle-phone', 'fh-place-new', 'fh-place-edit', 'fh-place-default', 'fh-place-pick', 'fh-place-continue', 'fh-place-delete-confirm', 'fh-carrier', 'fh-method', 'fh-pay-open', 'fh-pay-confirm', 'visit-pay', 'fh-cancel-order', 'fh-cancel-confirm'],
      forms: ['fh-place', 'fh-name', 'auth-customer-name'] }
  };
  const refuse = () => F.toast('هذا الإجراء غير متاح لهذا الحساب.', true);
  for (const { roles, when, actions = [], forms = [] } of Object.values(scopes)) {
    const allowedNow = () => !!A.session && roles.includes(A.session.role) && (!when || when());
    for (const name of actions) { const fn = F.actions[name]; if (fn) F.actions[name] = (...args) => allowedNow() ? fn(...args) : refuse(); }
    for (const name of forms) { const fn = F.forms[name]; if (fn) F.forms[name] = (...args) => allowedNow() ? fn(...args) : refuse(); }
  }

  // A stored session must match a stored account with the same role; an edited role signs out.
  const sessionMatchesAccount = () => {
    const s = A.session;
    if (!s) return true;
    const record = A.model.records[s.id] || (s.role !== 'customer' ? A.recordFor(s.role, s.email) : null);
    return !!record && record.role === s.role && (s.role === 'customer' ? record.phone === s.phone : String(record.email || '').toLowerCase() === String(s.email || '').toLowerCase());
  };
  const render = F.render;
  F.render = animate => {
    if (F.s.route !== 'auth-role-login') loginError = '';
    if (!sessionMatchesAccount()) { A.logout(); F.toast('انتهت الجلسة. سجّل الدخول مرة أخرى.', true); return; }
    render(animate);
  };
  F.render();
})();
