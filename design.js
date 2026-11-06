(() => {
  'use strict';
  const F = window.FH;
  const { Access: A, Visit: V, ic, esc, b, card, field, form, submit, lead, link, empty } = F;
  const format = new Intl.NumberFormat('ar-SA-u-nu-latn');
  const number = value => format.format(value);
  const steps = [
    ['shopping-bag', 'تسوّق', 'ادفع في المتجر واربط فاتورتك برقم جوالك.'],
    ['package-check', 'نجمع مشترياتك', 'نستلم الأكياس من المتاجر المشاركة.'],
    ['map-pin', 'استلمها حيث تختار', 'عند سيارتك في المول أو على عنوانك.']
  ];
  const brand = `<span class="fh-brand" dir="ltr"><img src="assets/free-hand-signature.svg" width="36" height="36" alt=""><strong>Free <span>Hand</span></strong></span>`;

  function howItWorks() {
    return `<ol class="fh-guide-steps">${steps.map(([icon, title, description], i) => `
      <li><span class="fh-step-icon">${ic(icon)}</span><div><small>الخطوة ${number(i + 1)}</small><strong>${title}</strong><p>${description}</p></div></li>`).join('')}</ol>`;
  }

  F.actions['fh-guide'] = () => F.sheet('كيف تعمل الخدمة؟', howItWorks(), b('دخول المتسوّق ' + ic('arrow-left'), 'go:login'));

  F.views['auth-entry'] = () => ({
    title: 'Free Hand', header: '', nav: null,
    html: `<div class="fh-welcome">
      <div class="fh-welcome-top">${brand}${F.link('كيف تعمل؟ ' + ic('circle-help'), 'fh-guide')}</div>
      <div class="fh-welcome-content">
        <div class="fh-welcome-copy">
          <span class="fh-kicker"><i></i> خدمة للمتسوّقين في المول</span>
          <h1>نجمع مشترياتك<br><em>ونوصّلها لك</em></h1>
          <p>بعد الدفع، أعطِ الكاشير رقم جوالك لربط الفاتورة، ثم اختر مكان التسليم.</p>
        </div>
        <ul class="fh-delivery-modes" aria-label="خيارات التسليم">
          <li>${ic('house')} <span>إلى المنزل</span></li>
          <li>${ic('car-front')} <span>عند سيارتك في المول</span></li>
        </ul>
        <div class="fh-welcome-actions">
          ${b(ic('shopping-bag') + '<span>دخول المتسوّق</span>' + ic('arrow-left'), 'go:login', 'fh-primary')}
          ${b(ic('store') + '<span>دخول حساب العمل</span>' + ic('chevron-left'), 'go:auth-role-login', 'secondary fh-secondary')}
        </div>
      </div>
      <p class="fh-prototype">تجربة تفاعلية · استخدم بيانات تجريبية</p>
    </div>`
  });

  function authPage(title, icon, heading, description, fields, footer, extra = '') {
    const intro = `<div class="fh-auth-intro"><span class="fh-auth-icon">${ic(icon)}</span>${lead(heading, description)}</div>`;
    return V.page(title, intro + card(fields, 'fh-auth-form') + extra, footer, null);
  }

  function loginSteps(current) {
    return `<ol class="fh-login-steps" aria-label="خطوات تسجيل الدخول">
      <li ${current===1?'aria-current="step"':'class="is-done"'}><span>${current===1?'1':ic('check')}</span> رقم الجوال</li>
      <li ${current===2?'aria-current="step"':''}><span>2</span> رمز التحقق</li>
    </ol>`;
  }
  F.views.login = () => authPage('دخول المتسوق', 'smartphone', 'رقم جوالك',
    'استخدم الرقم نفسه عند الكاشير لتظهر فواتيرك هنا.',
    loginSteps(1) + form('auth-customer-phone', field('customer-phone', 'رقم الجوال', A.pendingPhone, '05xxxxxxxx', 'tel', 'dir="ltr" inputmode="tel" maxlength="10" autocomplete="tel-national"')),
    submit('متابعة ' + ic('arrow-left')),
    `<details class="visit-details fh-demo-details"><summary>بيانات تجربة المتسوق</summary><p>رقم الجوال <b dir="ltr">0500000000</b> ورمز التحقق <b dir="ltr">1234</b>.</p></details>`);

  F.views.otp = () => authPage('التحقق', 'shield-check', 'أدخل رمز التحقق',
    `متابعة الدخول للرقم <bdi dir="ltr">${esc(A.pendingPhone)}</bdi>`,
    loginSteps(2) + form('auth-customer-otp', field('customer-code', 'رمز التحقق التجريبي', '', '1234', 'text', 'dir="ltr" inputmode="numeric" maxlength="4" autocomplete="one-time-code" class="fh-code"')),
    submit('دخول ' + ic('arrow-left')), link('تعديل رقم الجوال', 'go:login'));

  F.views['auth-role-login'] = () => authPage('حساب العمل', 'store', 'دخول حساب العمل',
    'ادخل إلى حساب المتجر أو المول أو فريق التوصيل.',
    form('visit-login', field('email', 'البريد الإلكتروني', V.loginEmail, 'name@example.com', 'email', 'dir="ltr" autocomplete="username" maxlength="120"') +
      `<div class="fh-password">${field('password', 'كلمة المرور', '', 'أدخل كلمة المرور', 'password', 'autocomplete="current-password" maxlength="128"')}
      <button type="button" class="a-iconbtn clear" data-action="fh-password" aria-label="إظهار كلمة المرور" aria-pressed="false">${ic('eye')}</button></div>`),
    submit('تسجيل الدخول ' + ic('arrow-left')),
    `<div class="fh-signup"><strong>الانضمام إلى Free Hand</strong><div class="fh-signup-actions">
      ${b(ic('building-2')+' تسجيل مول', 'join-mall', 'secondary small')}${b(ic('store')+' انضمام متجر', 'join-store', 'secondary small')}
    </div></div>`);

  F.actions['fh-password'] = button => {
    const input = button.closest('.fh-password').querySelector('input');
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    button.innerHTML = ic(visible ? 'eye-off' : 'eye');
    F.icons();
  };

  F.views.malls = () => V.page('اختيار المول',
    `<div class="fh-auth-intro"><span class="fh-auth-icon">${ic('building-2')}</span>${lead('وين تتسوّق اليوم؟', 'اختر المول لعرض المتاجر المشاركة.')}</div>` +
    V.data.malls.filter(mall => mall.status === 'approved').map(mall => {
      const count = V.stores(mall.id).filter(store => store.active).length;
      return V.select(esc(mall.name), 'visit-select-mall', mall.id, false, 'building-2', `${esc(mall.city)} · ${number(count)} متاجر مشاركة`);
    }).join(''), '', null, false);

  function activeOrder() {
    return V.data.orders.slice().reverse().find(order => order.phone === V.customer() && order.status !== 'delivered');
  }

  const storesView = F.views.stores;
  F.views.stores = () => {
    const view = storesView();
    const order = activeOrder();
    if (order) {
      const shortcut = `<button class="fh-order-shortcut" type="button" data-action="visit-open-order" data-id="${esc(order.id)}"><span class="visit-icon">${ic('route')}</span><span><strong>تابع طلبك</strong><small>${esc(V.stage[order.status])} · <bdi>${esc(order.id)}</bdi></small></span>${ic('chevron-left')}</button>`;
      view.html = view.html.replace(/(<section class="visit-hero")/, shortcut + '$1');
    }
    return view;
  };

  function orderRow(order) {
    const mall = V.get('malls', order.mall);
    const delivered = order.status === 'delivered';
    return `<button class="fh-order-row" type="button" data-action="visit-open-order" data-id="${esc(order.id)}">
      <span class="visit-icon">${ic(delivered ? 'package-check' : 'route')}</span>
      <span class="fh-order-details"><strong><bdi>${esc(order.id)}</bdi></strong><small>${esc(mall?.name || 'المول')} · ${order.destination === 'home' ? 'إلى المنزل' : 'إلى السيارة'}</small></span>
      <span class="fh-order-state ${delivered ? 'is-delivered' : ''}">${esc(V.stage[order.status])}</span>${ic('chevron-left')}
    </button>`;
  }

  F.views.orders = () => {
    const orders = V.data.orders.filter(order => order.phone === V.customer()).reverse();
    const active = orders.filter(order => order.status !== 'delivered');
    const previous = orders.filter(order => order.status === 'delivered');
    const group = (label, entries) => entries.length
      ? `<section class="fh-order-group"><h3 class="a-section">${label}</h3>${entries.map(orderRow).join('')}</section>`
      : '';
    return V.page('الطلبات', lead('طلباتك', 'اضغط على طلب لعرض التتبّع ومكان التسليم.') +
      (orders.length ? group('جارية الآن', active) + group('تم تسليمها', previous) :
        empty('receipt-text', 'ما عندك طلبات بعد', 'بعد تأكيد طلب الجمع، يظهر هنا مع حالة التسليم.')),
      orders.length ? '' : b('عرض مشترياتي', 'go:bags', 'secondary'), 'orders', false);
  };

  F.tabs.customer = [
    ['stores', 'المول', 'building-2'], ['bags', 'المشتريات', 'shopping-bag'],
    ['orders', 'الطلبات', 'receipt-text'], ['account', 'حسابي', 'user-round']
  ];

  const merchantView = F.views['merchant-home'];
  F.views['merchant-home'] = () => {
    const view = merchantView();
    view.html = view.html.replace('اربط الفاتورة بعد الدفع عند الكاشير.', 'أضف فاتورة مدفوعة إلى مشتريات العميل.').replace('داخل النموذج', 'مرتبطة بحسابات العملاء');
    view.footer = view.footer.replace('إضافة مشتريات عميل', ic('receipt-text') + ' ربط فاتورة جديدة');
    return view;
  };

  const checkoutRoutes = new Set(['destination', 'shipping-choice', 'review', 'payment']);
  const render = F.render;
  let previousRoute = F.s.route;
  F.render = function renderDesign(animate) {
    const oldFocus = document.activeElement;
    const focusedAction = oldFocus?.closest('#app-screen') && oldFocus.dataset.action;
    const focusedId = oldFocus?.dataset.id;
    render(animate);
    const route = F.s.route;
    const screen = F.$('#app-screen');
    if (A.session?.role === 'customer') {
      const current = route === 'tracking' || route === 'order-success' ? 'orders'
        : checkoutRoutes.has(route) ? 'bags' : route === 'malls' || route === 'u-store-detail' ? 'stores' : route;
      const nav = F.$('#app-nav');
      if (route === 'place-editor') nav.replaceChildren();
      for (const button of nav.querySelectorAll('button')) {
        button.setAttribute('aria-current', button.dataset.action === 'go:' + current ? 'page' : 'false');
      }
    }
    if (previousRoute !== route || (animate && route === 'auth-register')) {
      screen.scrollTop = 0;
      if (animate) screen.focus({ preventScroll: true });
    } else if (focusedAction && !oldFocus.isConnected) {
      const nextFocus = Array.from(screen.querySelectorAll('[data-action]')).find(button => button.dataset.action === focusedAction && button.dataset.id === focusedId);
      nextFocus?.focus({ preventScroll: true });
    }
    previousRoute = route;
  };

  F.$('#app-screen').tabIndex = -1;
  F.render();
})();
