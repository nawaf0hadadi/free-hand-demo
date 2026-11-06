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
  const passwordField = (name, label, mode, value = '') => `<div class="fh-password">${UI.field({ name, label, value, type: 'password', placeholder: mode === 'current-password' ? '••••••••' : '8 أحرف على الأقل، حرف ورقم', attrs: `autocomplete="${mode}" maxlength="128"` })}
    <button type="button" class="a-iconbtn clear" data-action="fh-password" aria-label="إظهار كلمة المرور" aria-pressed="false">${ic('eye')}</button></div>`;

  F.views['auth-role-login'] = () => page('حسابات الأعمال',
    intro('building-2', 'دخول حساب العمل', 'للمتاجر وإدارات المولات وفرق التشغيل والتوصيل وإدارة Free Hand.') +
    form('visit-login',
      UI.field({ name: 'email', label: 'البريد الإلكتروني', value: V.loginEmail, placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120" required', error: loginError }) +
      passwordField('password', 'كلمة المرور', 'current-password')) +
    `<div class="fh-divider"><span>جديد على Free Hand؟</span></div>
    <div class="fh-option-list">
      ${V.select('تسجيل مول جديد', 'join-mall', '', false, 'building-2', 'لإدارات المولات. يراجع فريق Free Hand الطلب قبل تفعيل لوحة المول.')}
      ${V.select('انضمام متجر إلى مول', 'join-store', '', false, 'store', 'لمتجر داخل مول مسجّل. تراجع إدارة المول الطلب قبل تفعيل الحساب.')}
    </div>
    <p class="fh-footnote">${ic('info')}<span>قدّمت طلب انضمام؟ سجّل الدخول ببريد الطلب وكلمة مروره لمعرفة حالته.</span></p>`,
    submit('تسجيل الدخول ' + ic('arrow-left')), null);

  const visitLogin = F.forms['visit-login'];
  F.forms['visit-login'] = async d => {
    if (UI.isBusy()) return;
    const email = String(d.email || '').trim().toLowerCase();
    V.loginEmail = email;
    if (!A.validEmail(email) || !d.password) {
      loginError = !A.validEmail(email) ? 'أدخل بريدًا إلكترونيًا صحيحًا.' : '';
      if (!loginError) F.toast('أدخل كلمة المرور.', true);
      F.render();
      return;
    }
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

  const mallRegister = F.forms['visit-mall-register'];
  F.forms['visit-mall-register'] = d => mallRegister(withFiles('visit-mall-register', d));
  const joinRequest = F.forms['join-request'];
  F.forms['join-request'] = d => UI.busy('جارٍ إرسال الطلب…', () => joinRequest(withFiles('join-request', d)));

  function chooseView() {
    return page('انضمام إلى Free Hand', intro('handshake', 'من تمثّل؟', 'اختر نوع الطلب. لكل طلب جهة تراجعه قبل تفعيل الحساب.') +
      `<div class="fh-option-list">
        ${V.select('تسجيل مول جديد', 'join-mall', '', false, 'building-2', 'يراجعه فريق Free Hand، ثم تُفتح لوحة المول.')}
        ${V.select('انضمام متجر إلى مول', 'join-store', '', false, 'store', 'تراجعه إدارة المول الذي يقع فيه المتجر.')}
      </div>`, b('لدي حساب · تسجيل الدخول', 'back', 'secondary'), null);
  }
  function mallForm() {
    return page('تسجيل مول جديد', intro('building-2', 'بيانات المول', 'يراجع فريق Free Hand الطلب والمستندات. تستطيع الدخول لمتابعة الحالة فور الإرسال.') +
      form('visit-mall-register',
        section('المول', text('name', 'اسم المول', 'مثال: مول الواجهة', 'maxlength="65"') + text('company', 'الجهة المشغّلة', 'الاسم المسجّل للجهة', 'maxlength="65"') +
          text('city', 'المدينة', 'الرياض', 'maxlength="40"') + text('point', 'نقطة تسليم السيارات', 'مثال: البوابة أ · الدور الأرضي', 'maxlength="100"', 'يراها المتسوّق عند التسليم في المواقف.')) +
        section('المستندات', fileField('visit-mall-register', 'registration', 'السجل التجاري · مطلوب', 'PDF أو صورة') + fileField('visit-mall-register', 'other', 'مستند داعم · اختياري', 'PDF أو صورة'), 'استخدم ملفات تجريبية في هذه النسخة.') +
        section('حساب مسؤول المول', UI.field({ name: 'email', label: 'البريد الإلكتروني', value: draft('email'), placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120"' }) +
          passwordField('password', 'كلمة المرور', 'new-password'), '8 أحرف على الأقل، تتضمن حرفًا ورقمًا.')),
      submit('إرسال الطلب إلى Free Hand'), null);
  }
  function storeForm(resubmit) {
    const malls = data.malls.filter(m => m.status === 'approved');
    if (!malls.length) return page('انضمام متجر', UI.empty('building-2', 'لا توجد مولات معتمدة بعد', 'يجب أن يسجّل المول ويعتمده فريق Free Hand قبل انضمام المتاجر.'), b('رجوع', 'back', 'secondary'), null);
    const s = resubmit;
    const val = (name, fallback = '') => F.draft[name] ?? fallback;
    const fields = section('المتجر', UI.selectField({ name: 'mall', label: 'المول', options: [['', 'اختر المول الذي يقع فيه المتجر'], ...malls.map(m => [m.id, m.name + ' · ' + m.city])], value: val('mall', s?.mall), hint: 'المولات المعتمدة فقط. تراجع إدارة المول طلبك.' }) +
        text('name', 'اسم المتجر والفرع', 'مثال: متجر العطور · فرع المول', 'maxlength="65"', '', val('name', s?.name)) +
        `<div class="a-grid2">${text('category', 'النشاط', 'أزياء، عطور…', 'maxlength="40"', '', val('category', s?.category))}${text('floor', 'الدور ورقم المحل', 'الأول · B14', 'maxlength="50"', '', val('floor', s?.floor))}</div>`) +
      section('بيانات الاعتماد', text('registration', 'رقم السجل التجاري', '10 أرقام', 'inputmode="numeric" maxlength="10" dir="ltr"', '', val('registration', s?.registration)) +
        text('lease', 'رقم عقد الإيجار أو مرجع الفرع لدى المول', 'رقم المرجع', 'maxlength="60" dir="auto"', '', val('lease', s?.lease)) +
        fileField(s ? 'fh-join-resubmit' : 'join-request', 'document', 'نسخة السجل التجاري' + (s ? ' · اختياري للتحديث' : ' · مطلوب'), 'PDF أو PNG أو JPG حتى 5 ميغابايت') +
        fileField(s ? 'fh-join-resubmit' : 'join-request', 'leaseDocument', 'إثبات وجود الفرع في المول' + (s ? ' · اختياري للتحديث' : ' · مطلوب'), 'PDF أو PNG أو JPG حتى 5 ميغابايت'), s ? 'المرفقات السابقة تبقى ما لم تختر ملفًا جديدًا.' : 'استخدم ملفات تجريبية في هذه النسخة.') +
      section('مسؤول المتجر', text('manager', 'الاسم', 'اسم المسؤول', 'maxlength="60" autocomplete="name"', '', val('manager', s?.manager)) +
        text('phone', 'جوال التواصل', '05XXXXXXXX', 'dir="ltr" inputmode="numeric" maxlength="10"', '', val('phone', s?.phone)) +
        (s ? UI.line('بريد الحساب', UI.ltr(s.email)) : UI.field({ name: 'email', label: 'البريد الإلكتروني للحساب', value: draft('email'), placeholder: 'name@example.com', type: 'email', attrs: 'dir="ltr" autocomplete="username" maxlength="120"' }) +
          passwordField('password', 'كلمة المرور', 'new-password') + passwordField('confirm', 'تأكيد كلمة المرور', 'new-password'))) +
      '<label class="a-check"><input type="checkbox" name="authorized"><span>أقر بصحة البيانات وأني مخوّل بتقديم الطلب عن المتجر.</span></label>';
    return page(s ? 'تعديل طلب الانضمام' : 'انضمام متجر',
      intro('store', s ? 'عدّل الطلب وأعد إرساله' : 'طلب انضمام متجر', s ? 'تراجع إدارة المول الطلب مرة أخرى بعد الإرسال.' : 'تراجع إدارة المول بيانات المتجر ومستنداته. يُفعّل الحساب بعد اعتمادها.') +
      (s?.reason ? UI.callout('message-square-warning', 'سبب الرفض السابق', esc(s.reason), 'warn') : '') +
      form(s ? 'fh-join-resubmit' : 'join-request', fields) +
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
  F.forms['fh-join-resubmit'] = d => UI.busy('جارٍ إرسال الطلب…', async () => {
    d = withFiles('fh-join-resubmit', d);
    const s = data.stores.find(x => x.id === V.resubmit && x.status === 'rejected');
    if (!s) return;
    const clean = (v, n = 100) => String(v || '').trim().slice(0, n);
    const m = data.malls.find(x => x.id === d.mall && x.status === 'approved');
    const registration = F.digits(d.registration), phone = F.digits(d.phone);
    if (!m) return F.toast('اختر مولًا معتمدًا من القائمة.', true);
    if ([d.name, d.category, d.floor, d.lease, d.manager].some(x => clean(x).length < 2)) return F.toast('أكمل بيانات المتجر ومسؤوله ومرجع الفرع.', true);
    if (!/^\d{10}$/.test(registration) || !/^05\d{8}$/.test(phone)) return F.toast('أدخل سجلًا من 10 أرقام وجوالًا صحيحًا يبدأ بـ 05.', true);
    if (!d.authorized) return F.toast('أكد صحة البيانات وصلاحيتك لتقديم الطلب.', true);
    const fresh = [d.document, d.leaseDocument];
    if (fresh.some(f => f?.size && (f.size > 5 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(f.type)))) return F.toast('المرفقات PDF أو PNG أو JPG، حتى 5 ميغابايت للملف.', true);
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
  // Resubmission mode ends when the user leaves the join flow.
  const back = F.actions.back;
  F.actions.back = () => { if (F.s.route === 'auth-register' && V.resubmit) { V.resubmit = null; F.draft = {}; F.go('join-status', { replace: true }); return; } back(); };

  /* Mall registration status (signed in as the mall account until Free Hand approves). */
  F.views['u-mall-status'] = () => {
    const m = ownMall();
    const [label, tone] = mallStatus(m);
    return page('طلب تسجيل المول', `<section class="a-card fh-review-block"><div class="fh-block-head"><h3>${ic('building-2')} ${esc(m?.name || 'طلب المول')}</h3>${UI.status(label, tone)}</div>
        ${UI.line('الجهة المشغّلة', esc(m?.company || ''))}${UI.line('المدينة', esc(m?.city || ''))}${UI.line('يراجع الطلب', 'فريق Free Hand')}
        ${(m?.docs || []).length ? `<p class="fh-muted-small">${ic('paperclip')} ${m.docs.map(esc).join('، ')}</p>` : ''}</section>` +
      (m?.status === 'rejected'
        ? UI.callout('message-square-warning', 'سبب الرفض', esc(m.reason || 'لم تُذكر ملاحظات.'), 'warn') +
          form('fh-mall-resubmit', section('عدّل البيانات وأعد الإرسال', UI.field({ name: 'name', label: 'اسم المول', value: m.name, attrs: 'maxlength="65"' }) + UI.field({ name: 'company', label: 'الجهة المشغّلة', value: m.company, attrs: 'maxlength="65"' }) +
            UI.field({ name: 'city', label: 'المدينة', value: m.city, attrs: 'maxlength="40"' }) + UI.field({ name: 'point', label: 'نقطة تسليم السيارات', value: m.point, attrs: 'maxlength="100"' }) + fileField('fh-mall-resubmit', 'registration', 'سجل تجاري محدّث · اختياري', 'PDF أو صورة')))
        : UI.callout('hourglass', 'التالي: قرار فريق Free Hand', 'تُفتح لوحة المول وإدارة المتاجر بعد الاعتماد. ادخل بالحساب نفسه لمتابعة الحالة.')),
      m?.status === 'rejected' ? submit('إعادة إرسال الطلب') + b('تسجيل الخروج', 'auth-logout', 'secondary') : b('تسجيل الخروج', 'auth-logout', 'secondary'), null, false);
  };
  F.forms['fh-mall-resubmit'] = d => {
    const m = ownMall();
    if (A.session?.role !== 'mall' || m?.status !== 'rejected') return;
    const clean = (v, n) => String(v || '').trim().slice(0, n);
    const values = { name: clean(d.name, 65), company: clean(d.company, 65), city: clean(d.city, 40), point: clean(d.point, 100) };
    if (Object.values(values).some(v => !v)) return F.toast('أكمل بيانات المول.', true);
    const file = withFiles('fh-mall-resubmit', d).registration;
    Object.assign(m, values, { status: 'pending', previousReason: m.reason, reason: '' });
    if (file?.size) m.docs = [clean(file.name, 100), ...(m.docs || []).slice(1)];
    V.save();
    F.render();
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

  const nextActor = o => ({
    collecting: o.stops.every(s => s.done) ? (o.destination === 'home' ? 'فريق الجمع يسلّم الطلب لشركة التوصيل' : 'فريق الجمع يبدأ التوصيل إلى السيارة') : 'فريق الجمع يستلم من المتاجر',
    ready: 'المندوب يسلّم عند السيارة', shipped: 'شركة التوصيل تسلّم للعميل', delivered: 'اكتمل'
  })[o.status] || '';
  UI.nextActor = nextActor;
  const orderCard = (o, action = '') => {
    const done = o.stops.filter(s => s.done).length;
    const tone = o.status === 'delivered' ? 'muted' : 'info';
    const inner = `<span class="fh-icon-tile">${ic(o.destination === 'home' ? 'truck' : 'car-front')}</span><span><strong><bdi dir="ltr">${esc(o.id)}</bdi> ${UI.status(esc(UI.statusTitle(o)), tone)}</strong>
      <small>${esc(mallOf(o.mall)?.name || '')} · ${o.destination === 'home' ? 'إلى المنزل · ' + esc(o.carrier) : 'عند السيارة'} · الاستلام: ${UI.num(done)} من ${UI.count(o.stops.length, 'store')}</small>
      ${o.status !== 'delivered' ? `<small class="fh-next-actor">${ic('arrow-left')} التالي: ${nextActor(o)}</small>` : ''}</span>`;
    return action ? `<button type="button" class="fh-task-row" data-action="${action}" data-id="${esc(o.id)}">${inner}${ic('chevron-left')}</button>` : `<div class="fh-task-row">${inner}</div>`;
  };
  F.views['mall-live'] = () => {
    const m = approvedMall();
    if (!m) return F.views['u-mall-status']();
    const orders = data.orders.filter(o => o.mall === m.id).slice().reverse();
    const active = orders.filter(o => o.status !== 'delivered');
    return page('طلبات الجمع', `<p class="fh-lead">متابعة فقط: يسجّل فريق الجمع والمندوب الخطوات من حساباتهم.</p>` +
      (orders.length ? (active.length ? UI.section('جارية') + `<div class="fh-list">${active.map(o => orderCard(o)).join('')}</div>` : '') +
        (orders.length > active.length ? UI.section('مكتملة') + `<div class="fh-list">${orders.filter(o => o.status === 'delivered').map(o => orderCard(o)).join('')}</div>` : '')
        : UI.empty('route', 'لا طلبات بعد', 'تظهر طلبات المتسوّقين هنا بعد الدفع وتأكيد الطلب.')), '', 'mall-home');
  };

  /* ---------- Free Hand admin: mall applications ---------- */
  F.views['admin-home'] = F.views['admin-malls'] = () => {
    const malls = data.malls.slice().sort((a, b2) => Number(b2.status === 'pending') - Number(a.status === 'pending'));
    const pending = malls.filter(m => m.status === 'pending');
    const row = m => { const [l, t] = mallStatus(m); return `<button type="button" class="fh-task-row" data-action="visit-admin-mall" data-id="${esc(m.id)}"><span class="fh-icon-tile">${ic('building-2')}</span><span><strong>${esc(m.name)}</strong><small>${esc(m.city)} · ${esc(m.company)} · ${UI.count(V.stores(m.id).filter(s => !inReview(s)).length, 'store')}</small>${UI.status(l, t)}</span>${ic('chevron-left')}</button>`; };
    return page('المولات', `<div class="fh-metrics two"><div><strong>${UI.num(pending.length)}</strong><small>بانتظار قرارك</small></div><div><strong>${UI.num(malls.filter(m => m.status === 'approved').length)}</strong><small>مولات معتمدة</small></div></div>` +
      (pending.length ? UI.section('بانتظار قرارك') + `<div class="fh-list">${pending.map(row).join('')}</div>` : UI.callout('circle-check', 'لا طلبات تسجيل جديدة', 'تظهر هنا طلبات المولات الجديدة لمراجعتها.')) +
      UI.section('كل المولات') + `<div class="fh-list">${malls.filter(m => m.status !== 'pending').map(row).join('')}</div>` +
      `<p class="fh-footnote">${ic('info')}<span>إدارة كل مول تراجع طلبات متاجره. يراجع فريق Free Hand تسجيل المولات.</span></p>`, '', 'admin-home', false);
  };
  F.views['admin-mall-review'] = () => {
    const m = V.get('malls', F.s.visitReviewMall);
    if (!m) return F.views['admin-home']();
    return page('طلب تسجيل مول', `<section class="fh-org-head"><small>${esc(m.city)}</small><h2>${esc(m.name)}</h2>${UI.status(...mallStatus(m))}</section>` +
      (m.status === 'pending' ? UI.callout('gavel', 'القرار لك', 'الاعتماد يفتح لوحة المول ويُظهره للمتسوّقين. الرفض يُظهر السبب لإدارة المول لتعدّل الطلب.') : '') +
      `<section class="a-card fh-review-block">${UI.line('الجهة المشغّلة', esc(m.company))}${UI.line('بريد الحساب', m.email ? UI.ltr(m.email) : 'حساب عرض')}${UI.line('نقطة التسليم', esc(m.point))}${UI.line('المتاجر', UI.count(V.stores(m.id).length, 'store'))}</section>` +
      `<section class="a-card fh-review-block"><h3>${ic('paperclip')} المستندات</h3>${(m.docs || []).map(n => `<div class="fh-doc">${ic('file-text')}<span>${esc(n)}</span><small>اسم الملف فقط في هذه النسخة</small></div>`).join('') || '<p class="fh-muted-small">ملف مول معتمد في بيانات العرض.</p>'}</section>` +
      (m.reason ? UI.callout('message-square-warning', 'سبب الرفض', esc(m.reason), 'warn') : m.previousReason ? UI.callout('history', 'أُعيد التقديم بعد رفض سابق', esc(m.previousReason)) : ''),
      m.status === 'pending' ? b(ic('circle-check') + ' اعتماد المول', 'visit-mall-approve') + b('رفض مع ذكر السبب', 'visit-mall-reject', 'secondary') : '', 'admin-home');
  };

  /* ---------- Store: link paid receipts ---------- */
  const awaiting = s => data.orders.filter(o => o.status === 'collecting' && o.stops.some(t => t.store === s.id && !t.done));
  F.views['merchant-home'] = () => {
    const s = ownStore();
    if (!s) return page('حساب المتجر', UI.empty('store', 'المتجر غير مرتبط بهذا الحساب', 'اطلب من إدارة المول إنشاء حساب لمتجرك أو قدّم طلب انضمام.'), b('تسجيل الخروج', 'auth-logout', 'secondary'), null, false);
    const m = mallOf(s.mall);
    const linked = data.invoices.filter(i => i.store === s.id);
    const waiting = awaiting(s);
    return page('المتجر', `<section class="fh-org-head"><small>${esc(m?.name || '')}</small><h2>${esc(s.name)}</h2><p>${UI.iso(s.floor)}${s.active ? '' : ' · موقوف حاليًا'}</p></section>` +
      (s.active ? '' : UI.callout('circle-pause', 'المتجر موقوف من إدارة المول', 'لا يمكن ربط فواتير جديدة حتى تعيد الإدارة تفعيله.', 'warn')) +
      `<section class="fh-link-card"><div class="fh-link-steps"><span>${ic('credit-card')}<small>العميل يدفع</small></span>${ic('chevron-left')}<span>${ic('smartphone')}<small>رقم جواله</small></span>${ic('chevron-left')}<span>${ic('receipt-text')}<small>اربط الفاتورة</small></span></div><p>الفاتورة المربوطة تظهر فورًا في مشتريات العميل في ${esc(m?.name || 'المول')}.</p></section>` +
      UI.section('جهّزها للمندوب', waiting.length ? UI.status(UI.count(waiting.length, 'order'), 'wait') : '') +
      (waiting.length ? `<div class="fh-list">${waiting.map(o => { const stop = o.stops.find(t => t.store === s.id); const inv = stop.invoices.map(id => V.get('invoices', id)).filter(Boolean); return `<div class="fh-task-row"><span class="fh-icon-tile">${ic('package')}</span><span><strong><bdi dir="ltr">${esc(o.id)}</bdi> ${UI.status('بانتظار المندوب', 'wait')}</strong><small>${inv.map(i => `<bdi dir="ltr">${esc(i.number)}</bdi>`).join('، ')} · ${UI.count(inv.reduce((n, i) => n + i.bags, 0), 'bag')}</small><small class="fh-next-actor">${ic('arrow-left')} التالي: سلّم الأكياس للمندوب عند حضوره</small></span></div>`; }).join('')}</div>`
        : `<p class="fh-footnote">${ic('circle-check')}<span>لا طلبات بانتظار الاستلام من متجرك.</span></p>`) +
      `<section class="a-card fh-menu">${F.listButton('الفواتير المرتبطة', 'receipt-text', 'go:merchant-pickups', UI.count(linked.length, 'invoice'))}${F.listButton('ملف المتجر للزوار', 'store', 'go:merchant-profile')}</section>`,
      s.active ? b(ic('receipt-text') + ' ربط فاتورة مدفوعة', 'visit-merchant-start') : '', 'merchant-home', false);
  };

  let receiptErrors = {};
  F.views['merchant-register'] = () => {
    const s = ownStore();
    if (!s) return F.views['merchant-home']();
    if (!V.invoice) V.invoice = { phone: '', qr: '', person: null, miss: false, number: '', amount: '', bags: '1', source: 'manual' };
    const r = V.invoice;
    const e = receiptErrors;
    const person = r.person;
    return page('ربط فاتورة', `<p class="fh-lead">للفواتير المدفوعة في ${esc(s.name)} فقط. ستظهر في مشتريات العميل في ${esc(mallOf(s.mall)?.name || 'المول')}.</p>` +
      form('visit-invoice',
        `<fieldset class="fh-form-section"><legend><span class="fh-num">1</span> العميل</legend>` +
        UI.field({ name: 'invoice-phone', label: 'رقم جوال العميل', value: r.phone, placeholder: '05XXXXXXXX', type: 'tel', attrs: 'dir="ltr" inputmode="numeric" maxlength="10" autocomplete="off"', error: e.phone }) +
        (person ? `<div class="fh-person">${ic('circle-check')}<div><strong>${esc(person.name)}</strong><small><bdi dir="ltr">${esc(V.mask(person.phone))}</bdi> · ${person.via === 'qr' ? 'مطابقة بالرمز الاحتياطي' : 'حساب مطابق'}</small></div><button type="button" class="fh-text-btn" data-action="fh-receipt-reset-person">تغيير</button></div>`
          : b(ic('search') + ' البحث عن العميل', 'fh-lookup', 'secondary small')) +
        (r.miss ? UI.callout('user-x', 'لا يوجد حساب بهذا الرقم', 'اطلب من العميل التسجيل في Free Hand بالرقم نفسه، أو اطلب رمزه الاحتياطي من شاشة «المشتريات».', 'warn') +
          UI.field({ name: 'invoice-qr', label: 'الرمز الاحتياطي للعميل', value: r.qr, placeholder: 'FH-XXXXXXXX', attrs: 'dir="ltr" maxlength="32" autocomplete="off"' }) + b(ic('qr-code') + ' مطابقة الرمز', 'visit-qr-match', 'secondary small') : '') +
        `</fieldset><fieldset class="fh-form-section${person ? '' : ' is-locked'}"><legend><span class="fh-num">2</span> الفاتورة المدفوعة</legend>` +
        (person ? '' : `<p class="fh-footnote">${ic('lock')}<span>حدّد العميل أولًا.</span></p>`) +
        b(ic('scan-line') + ' مسح باركود فاتورة تجريبية', 'visit-invoice-scan', 'ghost small', person ? '' : 'disabled') +
        (r.source === 'scan' ? `<p class="fh-footnote">${ic('info')}<span>حُمّلت بيانات فاتورة عرض. راجعها قبل الربط.</span></p>` : '') +
        UI.field({ name: 'invoice-number', label: 'رقم الفاتورة', value: r.number, placeholder: 'INV-12345', attrs: `dir="ltr" maxlength="45" autocomplete="off"${person ? '' : ' disabled'}`, hint: 'أحرف إنجليزية وأرقام وشرطة، كما في الفاتورة.', error: e.number }) +
        `<div class="a-grid2">${UI.field({ name: 'invoice-amount', label: 'المبلغ المدفوع (ر.س)', value: r.amount, placeholder: '0.00', type: 'text', attrs: `dir="ltr" inputmode="decimal" maxlength="10"${person ? '' : ' disabled'}`, error: e.amount })}${UI.field({ name: 'invoice-bags', label: 'عدد الأكياس', value: r.bags, placeholder: '1', type: 'text', attrs: `dir="ltr" inputmode="numeric" maxlength="2"${person ? '' : ' disabled'}`, error: e.bags })}</div>` +
        '</fieldset>'),
      submit(ic('link') + ' ربط الفاتورة بحساب العميل'), 'merchant-register', false);
  };
  F.actions['fh-lookup'] = () => {
    const r = V.invoice;
    const phone = F.digits(r?.phone);
    receiptErrors = {};
    if (!/^05\d{8}$/.test(phone)) { receiptErrors.phone = 'أدخل رقمًا من 10 أرقام يبدأ بـ 05.'; UI.rerender(); F.$('[name="invoice-phone"]')?.focus(); return; }
    F.actions['visit-lookup']();
    F.$(V.invoice.person ? '[name="invoice-number"]' : '[name="invoice-qr"]')?.focus();
  };
  F.actions['fh-receipt-reset-person'] = () => { Object.assign(V.invoice, { person: null, miss: false }); receiptErrors = {}; UI.rerender(); F.$('[name="invoice-phone"]')?.focus(); };
  const linkInvoice = F.forms['visit-invoice'];
  F.forms['visit-invoice'] = d => {
    const s = ownStore();
    const r = V.invoice;
    if (!s || !r) return;
    receiptErrors = {};
    const number = String(d['invoice-number'] || '').trim();
    const amountText = UI.latin(String(d['invoice-amount'] || '').trim()).replace(/[٫,]/g, '.');
    const bagsText = UI.latin(String(d['invoice-bags'] || '').trim());
    if (!r.person) { receiptErrors.phone = 'ابحث عن العميل وتأكد من حسابه قبل الربط.'; UI.rerender(); return; }
    if (r.person.via === 'phone' && r.person.phone !== F.digits(d['invoice-phone'])) { Object.assign(r, { person: null, miss: false }); receiptErrors.phone = 'تغيّر الرقم بعد البحث. ابحث عن العميل مرة أخرى.'; UI.rerender(); return; }
    if (!/^[A-Za-z0-9][A-Za-z0-9\-\/]{2,44}$/.test(number)) receiptErrors.number = 'من 3 إلى 45 خانة: أحرف إنجليزية وأرقام وشرطة.';
    else if (data.invoices.some(i => i.store === s.id && i.number.toUpperCase() === number.toUpperCase())) receiptErrors.number = 'هذه الفاتورة مربوطة مسبقًا في متجرك.';
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0 || Number(amountText) > 100000) receiptErrors.amount = 'مبلغ بين 0.01 و100,000 بخانتين عشريتين كحد أقصى.';
    if (!/^\d{1,2}$/.test(bagsText) || Number(bagsText) < 1 || Number(bagsText) > 25) receiptErrors.bags = 'من 1 إلى 25.';
    if (Object.keys(receiptErrors).length) { UI.rerender(); F.$('[aria-invalid="true"]')?.focus(); return; }
    const before = data.invoices.length;
    linkInvoice({ ...d, 'invoice-number': number, 'invoice-amount': amountText, 'invoice-bags': bagsText });
    if (data.invoices.length === before + 1) { F.s.linkedInvoice = data.invoices.at(-1).id; F.go('merchant-linked', { replace: true }); F.toast('تم ربط الفاتورة بحساب العميل'); }
  };
  F.views['merchant-linked'] = () => {
    const i = V.get('invoices', F.s.linkedInvoice);
    const s = ownStore();
    if (!i || i.store !== s?.id) return F.views['merchant-home']();
    const customer = A.model.records['customer:' + i.phone];
    return page('تم ربط الفاتورة', `<section class="fh-success" role="status"><span class="fh-success-check">${ic('check')}</span><div><strong>الفاتورة مرتبطة بحساب العميل</strong><small>تظهر الآن في «المشتريات» لديه في ${esc(mallOf(i.mall)?.name || 'المول')}.</small></div></section>` +
      `<section class="a-card fh-review-block">${UI.line('العميل', esc(customer?.name || (i.phone === '0500000000' ? 'نورة' : 'متسوّق')) + ` · <bdi dir="ltr">${esc(V.mask(i.phone))}</bdi>`)}${UI.line('رقم الفاتورة', UI.ltr(i.number))}${UI.line('المبلغ المدفوع', UI.cash(i.amount))}${UI.line('الأكياس', UI.count(i.bags, 'bag'))}</section>` +
      UI.callout('package', 'التالي', 'احتفظ بالأكياس جاهزة. عندما يطلب العميل الجمع، يظهر الطلب في «جهّزها للمندوب».'),
      b(ic('plus') + ' ربط فاتورة أخرى', 'visit-merchant-start') + b('الفواتير المرتبطة', 'go:merchant-pickups', 'secondary'), 'merchant-register', false);
  };
  F.views['merchant-pickups'] = () => {
    const s = ownStore();
    if (!s) return F.views['merchant-home']();
    const invoices = data.invoices.filter(i => i.store === s.id).slice().reverse();
    return page('الفواتير المرتبطة', invoices.length ? `<div class="fh-list">${invoices.map(i => {
      const o = data.orders.find(x => x.id === i.order);
      const stop = o?.stops.find(t => t.store === s.id);
      const [label, tone, next] = stop?.done ? ['استلمها المندوب', 'ok', ''] : o ? ['بانتظار المندوب', 'wait', 'سلّم الأكياس للمندوب'] : ['محفوظة للعميل', 'muted', 'العميل يطلب الجمع من التطبيق'];
      return `<div class="fh-task-row"><span class="fh-icon-tile">${ic('receipt-text')}</span><span><strong>فاتورة <bdi dir="ltr">${esc(i.number)}</bdi> ${UI.status(label, tone)}</strong><small><bdi dir="ltr">${esc(V.mask(i.phone))}</bdi> · ${UI.cash(i.amount)} · ${UI.count(i.bags, 'bag')}${o ? ` · <bdi dir="ltr">${esc(o.id)}</bdi>` : ''}</small>${next ? `<small class="fh-next-actor">${ic('arrow-left')} التالي: ${next}</small>` : ''}</span></div>`;
    }).join('')}</div>` : UI.empty('receipt-text', 'لا فواتير مرتبطة', 'اربط فاتورة مدفوعة برقم جوال العميل لتظهر هنا.'),
      b(ic('plus') + ' ربط فاتورة مدفوعة', 'visit-merchant-start'), 'merchant-home');
  };
  const start = F.actions['visit-merchant-start'];
  F.actions['visit-merchant-start'] = () => { receiptErrors = {}; start(); };

  /* ---------- Operations team and delivery partner ---------- */
  // Operations accounts see their own mall; the delivery partner serves every mall in the prototype.
  const visibleOrders = () => data.orders.filter(o => A.session?.role !== 'operations' || o.mall === (A.session.org || 'front'));
  const taskOrder = () => visibleOrders().find(o => o.id === F.s.visitDeliveryOrder);
  const isOps = () => A.session?.role === 'operations';
  F.views['delivery-home'] = F.views['ops-home'] = () => {
    const orders = visibleOrders().slice().reverse();
    const active = orders.filter(o => o.status !== 'delivered');
    const done = orders.filter(o => o.status === 'delivered');
    const scope = isOps() ? 'طلبات ' + esc(mallOf(A.session.org || 'front')?.name || 'المول') : 'طلبات كل المولات المشاركة';
    return page(isOps() ? 'مهام الجمع' : 'مهام التوصيل', `<p class="fh-lead">${scope}. افتح الطلب لتسجيل الاستلام من المتاجر ثم التسليم.</p>` +
      (orders.length ? (active.length ? UI.section('بحاجة إلى إجراء', UI.status(UI.count(active.length, 'order'), 'wait')) + `<div class="fh-list">${active.map(o => orderCard(o, 'visit-delivery-order')).join('')}</div>` : UI.callout('circle-check', 'لا مهام جارية', 'كل الطلبات مكتملة.')) +
        (done.length ? UI.section('مكتملة') + `<div class="fh-list">${done.map(o => orderCard(o, 'visit-delivery-order')).join('')}</div>` : '')
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
    const next = { collecting: all ? (home ? `سلّم الطلب إلى ${esc(o.carrier)}` : 'ابدأ التوصيل إلى سيارة العميل') : `استلم الأكياس من المتاجر (${UI.num(done)} من ${UI.num(o.stops.length)})`, ready: 'سلّم الأكياس للعميل عند سيارته', shipped: 'أكّد تسليم الشحنة للعميل', delivered: 'اكتمل الطلب' }[o.status];
    const cta = { collecting: home ? `${ic('truck')} تسليم الطلب إلى ${esc(o.carrier)}` : `${ic('car-front')} بدء التوصيل إلى السيارة`, ready: `${ic('package-check')} تأكيد التسليم عند السيارة`, shipped: `${ic('package-check')} تأكيد تسليم الشحنة` }[o.status];
    const destination = home
      ? `${UI.line('شركة التوصيل', esc(o.carrier) + (o.carrierEta ? ' · ' + esc(o.carrierEta) : ''))}${UI.line('العنوان', esc([o.address, o.city].filter(Boolean).join('، ')))}`
      : `${UI.line('مكان السيارة', esc(place ? UI.placeSummary(place) : o.point))}`;
    const notes = o.deliveryNotes || place?.notes;
    return page('طلب ' + o.id, `<section class="fh-org-head"><small>${esc(mallOf(o.mall)?.name || '')} · <bdi dir="ltr">${esc(o.id)}</bdi></small><h2>${esc(UI.statusTitle(o))}</h2>
        ${o.status !== 'delivered' ? `<p class="fh-next-actor light">${ic('arrow-left')} التالي: ${next}</p>` : ''}</section>` +
      UI.section('الاستلام من المتاجر', `<span class="fh-muted-small">${UI.num(done)} من ${UI.num(o.stops.length)}</span>`) +
      `<div class="fh-list">${o.stops.map(stop => { const s = V.get('stores', stop.store); const inv = stop.invoices.map(id => V.get('invoices', id)).filter(Boolean); return `<section class="a-card fh-stop-card${stop.done ? ' is-done' : ''}">
          <div class="fh-row"><strong>${esc(s?.name || 'متجر')}</strong>${UI.status(stop.done ? 'تم الاستلام' : 'بانتظار الاستلام', stop.done ? 'ok' : 'wait')}</div>
          <small>${UI.iso(s?.floor || '')} · ${UI.count(inv.reduce((n, i) => n + i.bags, 0), 'bag')}</small>
          <p class="fh-muted-small">${inv.map(i => `فاتورة <bdi dir="ltr">${esc(i.number)}</bdi>`).join('، ')}</p>
          ${!stop.done && o.status === 'collecting' ? b(ic('check') + ' تأكيد الاستلام من المتجر', 'visit-stop-pickup', 'secondary small', `data-id="${esc(stop.store)}"`) : ''}</section>`; }).join('')}</div>` +
      `<section class="a-card fh-review-block"><h3>${ic(home ? 'house' : 'car-front')} ${home ? 'التوصيل إلى المنزل' : 'التسليم عند السيارة'}</h3>${destination}${notes ? `<p class="fh-muted-small">${ic('message-square')} ${esc(notes)}</p>` : ''}
        ${o.coordinates ? `<a class="fh-map-link" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(o.coordinates.lat)}&amp;mlon=${encodeURIComponent(o.coordinates.lng)}#map=18/${encodeURIComponent(o.coordinates.lat)}/${encodeURIComponent(o.coordinates.lng)}" target="_blank" rel="noopener noreferrer">${ic('map-pinned')} فتح نقطة التسليم على الخريطة</a>` : ''}</section>`,
      o.status === 'delivered' ? '' : b(all ? cta : `${ic('lock')} أكمل الاستلام من المتاجر أولًا`, o.status === 'collecting' ? 'visit-delivery-next' : 'fh-confirm-delivery', '', all ? '' : 'disabled'),
      isOps() ? 'ops-home' : 'delivery-home');
  };
  const guard = action => { const original = F.actions[action]; F.actions[action] = btn => { if (!taskOrder()) return F.toast('هذا الطلب خارج نطاق حسابك.', true); original(btn); }; };
  guard('visit-stop-pickup');
  guard('visit-delivery-next');
  const openTask = F.actions['visit-delivery-order'];
  F.actions['visit-delivery-order'] = btn => { if (!visibleOrders().some(o => o.id === btn.dataset.id)) return F.toast('هذا الطلب خارج نطاق حسابك.', true); openTask(btn); };
  F.actions['fh-confirm-delivery'] = () => {
    const o = taskOrder();
    if (!o || !['ready', 'shipped'].includes(o.status)) return;
    F.sheet('تأكيد التسليم؟', `<p class="fh-sheet-text">تأكّد من استلام العميل لطلب <bdi dir="ltr">${esc(o.id)}</bdi> (${UI.count(o.stops.reduce((n, s) => n + s.invoices.map(id => V.get('invoices', id)).reduce((m, i) => m + (i?.bags || 0), 0), 0), 'bag')}). لا يمكن التراجع بعد التأكيد.</p>`,
      b(ic('package-check') + ' نعم، تم التسليم', 'fh-delivery-done') + b('تراجع', 'close-sheet', 'secondary'));
  };
  F.actions['fh-delivery-done'] = () => { F.closeSheet(); F.actions['visit-delivery-next'](); };

  /* ---------- Business account ---------- */
  F.views['auth-account'] = () => page('الحساب', `<section class="a-card fh-identity"><span class="fh-avatar big">${ic('user-round')}</span><div><strong>${esc(A.session?.organization || A.session?.name || '')}</strong><small>${esc(UI.roleNames[A.session?.role] || '')}</small><bdi dir="ltr">${esc(A.session?.email || '')}</bdi></div></section>` +
    `<section class="a-card fh-menu">${F.listButton('الصفحة الرئيسية', 'layout-dashboard', 'auth-home')}${F.listButton('أدوات العرض', 'flask-conical', 'fh-demo-tools')}</section>`,
    b(ic('log-out') + ' تسجيل الخروج', 'auth-logout', 'secondary'), 'auth-account', false);

  const render = F.render;
  F.render = animate => {
    if (F.s.route !== 'auth-role-login') loginError = '';
    if (F.s.route !== 'merchant-register') receiptErrors = {};
    render(animate);
  };
  F.render();
})();
