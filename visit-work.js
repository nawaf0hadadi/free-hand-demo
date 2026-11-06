(()=>{
'use strict';
const F=window.FH,A=F.Access,V=F.Visit;
const {data,save,get,stores,cash,line,idButton,page,hero,select,textInput,uid,mask,stage,storeLogo}=V;
const {ic,b,card,lead,field,form,submit,note,tag,link,esc,empty,row}=F;
const roles=['mall','merchant','operations','delivery','admin'];
const demoPassword='Demo1234!';
const invalid=msg=>F.toast(msg,true);
const addressOK=value=>A.validEmail(value);
const fieldEmail=(name,label,value='')=>field(name,label,value,'name@example.com','email','dir="ltr" maxlength="120"');
const fieldPass=(name,label,mode='current-password')=>field(name,label,'','8 أحرف على الأقل','password','autocomplete="'+mode+'" maxlength="128"');
const fieldFile=(name,label,accept)=>`<label class="a-field">${label}<input type="file" name="${name}" accept="${accept}"></label>`;
const textarea=(name,label,value,max)=>`<label class="a-field">${label}<textarea name="${name}" maxlength="${max}">${esc(value||'')}</textarea></label>`;
const email=value=>textInput(value,120).toLowerCase();
const mallForAccount=()=>data.malls.find(m=>m.email===A.session?.email);
const storeForAccount=()=>data.stores.find(s=>s.email===A.session?.email);
const mStatus={pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض'};
const unique=identity=>data.malls.some(m=>m.email===identity)||data.stores.some(s=>s.email===identity)||roles.some(role=>A.recordFor(role,identity));
const publicWork=()=>page('حساب العمل',lead('أهلًا بعودتك.','سجّل الدخول لإدارة المول أو المتجر ومتابعة خدماتك.')+
 form('visit-login',fieldEmail('email','البريد الإلكتروني',V.loginEmail)+fieldPass('password','كلمة المرور'))+
 '<p class="work-signup">ليس لديك حساب عمل؟ '+link('إنشاء حساب','work-join')+'</p>',submit('تسجيل الدخول'),null);
F.views['auth-role-login']=publicWork;
F.views['auth-entry']=()=>page('Free Hand',hero('FREE HAND','تسوّق براحتك.<br>ونجمعها لك.','مشترياتك من محلات المول في طلب جمع واحد.','shopping-bag')+
  select('أنا متسوق','go:login','',false,'shopping-bag','دخول برقم الجوال')+
  select('دخول حساب العمل','go:auth-role-login','',false,'building-2','المول، المتجر، المندوب أو مالك المنصة')+
  '<p class="visit-caption">نموذج تفاعلي · استخدم بيانات ومستندات تجريبية</p>','',null,false);
F.views.login=()=>page('دخول العميل',lead('ابدأ برقم جوالك.','هذا هو الرقم اللي تعطيه للكاشير بعد الدفع.')+
  form('auth-customer-phone',field('customer-phone','رقم الجوال',A.pendingPhone,'05xxxxxxxx','tel','dir="ltr" maxlength="10" autocomplete="tel-national"'))+
  note('للعرض استخدم 0500000000. رمز التحقق 1234.'),submit('متابعة'),null);
F.views.otp=()=>page('التحقق من الجوال',lead('أدخل رمز التحقق.',esc(A.pendingPhone))+
  form('auth-customer-otp',field('customer-code','رمز العرض','','1234','text','dir="ltr" inputmode="numeric" maxlength="4" autocomplete="one-time-code"')),
  submit('دخول واختيار المول'),null);
F.forms['visit-login']=async d=>{
  if(V.busy)return;
  const identity=email(d.email);
  V.loginEmail=identity;
  if(!addressOK(identity)||!d.password)return invalid('أدخل البريد الإلكتروني وكلمة المرور.');
  const role=roles.find(r=>A.recordFor(r,identity));
  const demoStore=data.stores.find(s=>s.email===identity&&['step','perfume'].includes(s.id));
  if(!role){
    if(!demoStore||d.password!==demoPassword)return invalid('البريد أو كلمة المرور غير صحيحة.');
    return A.startSession({id:'merchant:'+identity,role:'merchant',email:identity,name:demoStore.name,organization:demoStore.name,org:demoStore.mall,demo:true});
  }
  A.chosenRole=role;
  await busy('جارٍ تسجيل الدخول…',()=>F.forms['auth-business-login']({'business-email':identity,'business-password':d.password}));
};

F.views['auth-register']=()=>page('تسجيل مول',lead('أرسل طلب انضمام المول.','مالك المنصة يراجع بياناتك قبل فتح لوحة الإدارة.')+
  form('visit-mall-register',
    field('name','اسم المول','','مثال: مول الواجهة','text','maxlength="65"')+
    field('company','اسم الجهة المشغّلة','','الاسم المسجل للجهة','text','maxlength="65"')+
    field('city','المدينة','','الرياض','text','maxlength="40"')+
    field('point','موقع نقطة الاستلام','','مثال: البوابة أ · الدور الأرضي','text','maxlength="100"')+
    fieldEmail('email','بريد مسؤول المول')+fieldPass('password','كلمة المرور','new-password')+
    fieldFile('registration','السجل التجاري · مطلوب','.pdf,image/jpeg,image/png')+
    fieldFile('other','مستند داعم · اختياري','.pdf,image/jpeg,image/png'))+
  '<p class="a-muted">اختر ملفات وهمية للعرض. يظهر اسم الملف في طلب المراجعة.</p>',
  submit('إرسال للمراجعة'),null);
F.forms['visit-mall-register']=d=>busy('جارٍ إرسال الطلب…',async()=>{
  const name=textInput(d.name,65),company=textInput(d.company,65),city=textInput(d.city,40),point=textInput(d.point,100),identity=email(d.email);
  if(!name||!company||!city||!point||!addressOK(identity)||!A.passwordValid(d.password))return invalid('أكمل بيانات المول وأدخل كلمة مرور من 8 أحرف فيها حرف ورقم.');
  if(!d.registration?.size)return invalid('أرفق ملفًا تجريبيًا للسجل التجاري.');
  if(unique(identity))return invalid('البريد مسجل مسبقًا. استخدم بريدًا آخر أو سجّل الدخول.');
  const m={id:uid('mall'),name,company,city,point,email:identity,status:'pending',
    docs:[d.registration,d.other].filter(f=>f?.size).map(f=>textInput(f.name,100))};
  const record={id:'mall:'+identity,role:'mall',email:identity,name,organization:name,org:m.id};
  await A.storePassword(record,d.password);
  data.malls.push(m);save();A.startSession(A.recordFor('mall',identity));F.toast('تم إرسال طلب انضمام المول');
});
F.views['u-mall-status']=()=>{
  const m=mallForAccount();
  return page('طلب انضمام المول',hero('حساب المول',esc(m?.name||'طلب الانضمام'),m?.status==='rejected'?'يمكنك مراجعة الملاحظات مع إدارة المنصة.':'تقدر ترجع لنفس الحساب لمتابعة القرار.','file-check-2')+
    card(row('<strong>حالة الطلب</strong>',tag(mStatus[m?.status]||'قيد المراجعة',m?.status==='approved'?'':'warn'))+
      (m?.reason?'<p class="a-muted">'+esc(m.reason)+'</p>':''))+
    b('تسجيل الخروج','auth-logout','secondary'),'',null,false);
};

F.views['admin-home']=F.views['admin-malls']=()=>page('إدارة المولات',hero('مالك المنصة','طلبات انضمام المولات','راجع الطلبات وحدد المولات المعتمدة للعرض.','shield-check')+
  '<div class="visit-metrics">'+F.metric('بانتظار المراجعة',data.malls.filter(m=>m.status==='pending').length,'طلبات')+
  F.metric('معتمدة',data.malls.filter(m=>m.status==='approved').length,'مولات')+'</div>'+
  data.malls.slice().sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')).map(m=>
    card(row('<strong>'+esc(m.name)+'</strong>',tag(mStatus[m.status],m.status==='pending'?'warn':''))+
      '<p class="a-muted">'+esc(m.city+' · '+m.company)+'</p>'+idButton('عرض ملف المول','visit-admin-mall',m.id))).join(''),
  '','admin-home',false);
F.actions['visit-admin-mall']=button=>{F.s.visitReviewMall=button.dataset.id;F.go('admin-mall-review');};
F.views['admin-mall-review']=()=>{
  const m=get('malls',F.s.visitReviewMall);
  if(!m)return F.views['admin-home']();
  return page('ملف المول',lead(esc(m.name),esc(m.company+' · '+m.city))+
    card(line('حالة الطلب',tag(mStatus[m.status]))+line('بريد الحساب',esc(m.email||'حساب عرض'))+
      line('مواقف السيارة',esc(m.point)))+
    card('<h3 class="a-section">المرفقات</h3>'+(m.docs||[]).map(n=>'<p class="a-muted">'+ic('file-text')+' '+esc(n)+'</p>').join('')+
      (!m.docs?.length?'<p class="a-muted">ملف مول معتمد في بيانات العرض.</p>':'')+
      (m.reason?'<p class="a-muted">'+esc(m.reason)+'</p>':'')),
    m.status==='pending'?b('اعتماد المول','visit-mall-approve')+b('رفض الطلب','visit-mall-reject','secondary'):'','admin-home');
};
function decide(status,reason=''){
  const m=get('malls',F.s.visitReviewMall);
  if(A.session?.role!=='admin'||m?.status!=='pending')return;
  m.status=status;m.reason=reason;save();F.closeSheet();F.go('admin-home',{replace:true});
  F.toast(status==='approved'?'تم اعتماد المول، وفُتحت لوحة إدارته':'تم رفض طلب تسجيل المول، وسيرى المول السبب');
}
F.actions['visit-mall-approve']=()=>decide('approved');
F.actions['visit-mall-reject']=()=>F.sheet('رفض طلب الانضمام',form('visit-reject',field('reason','سبب الرفض','','مثال: السجل التجاري غير واضح','text','maxlength="140"')),submit('تأكيد الرفض'));
F.forms['visit-reject']=d=>{
  const reason=textInput(d.reason,140);
  if(!reason)return F.toast('اكتب سبب الرفض.',true);
  decide('rejected',reason);
};

F.views['mall-home']=()=>{
  const m=mallForAccount();
  if(m?.status!=='approved')return F.views['u-mall-status']();
  const count=stores(m.id).filter(s=>s.active).length;
  return page('لوحة المول',hero('إدارة المول',esc(m.name),'أدر المتاجر وخيارات التوصيل المتاحة للزوار.','building-2')+
    '<div class="visit-metrics">'+F.metric('متاجر ظاهرة',count,'متاجر المول')+
    F.metric('طلبات جمع',data.orders.filter(o=>o.mall===m.id&&o.status!=='delivered').length,'قيد التنفيذ')+'</div>'+
    card(F.listButton('متاجر المول وحساباتها','store','go:mall-stores')+
      F.listButton('شركات التوصيل','truck','go:mall-carriers')+F.listButton('طلبات الجمع','route','go:mall-live')),
    '','mall-home',false);
};
F.views['mall-stores']=()=>{
  const m=mallForAccount();
  return page('متاجر المول',lead('إدارة المتاجر',esc(m.name))+
    (stores(m.id).map(s=>card(`<div class="a-inline">${storeLogo(s)}<div class="a-grow"><strong>${esc(s.name)}</strong>
       <p class="a-muted">${esc(s.category+' · '+s.floor)}</p></div>${tag(s.active?'ظاهر':'موقوف',s.active?'':'warn')}</div>`+
      '<p class="a-muted visit-email">'+esc(s.email||'بدون حساب متجر')+'</p>'+
      row(idButton(s.active?'إيقاف الظهور':'تفعيل الظهور','visit-store-active',s.id),
        s.email?'':idButton('إنشاء حساب','visit-existing-store',s.id)))).join('')
      ||empty('store','أضف أول متجر','أنشئ ملف المتجر وحسابه في خطوة واحدة.')),
    b('إضافة متجر','visit-new-store'),'mall-stores',false);
};
F.actions['visit-new-store']=()=>{F.s.visitEditStore=null;F.go('mall-store-new');};
F.actions['visit-existing-store']=button=>{F.s.visitEditStore=button.dataset.id;F.go('mall-store-new');};
F.views['mall-store-new']=()=>{
  const s=get('stores',F.s.visitEditStore);
  return page(s?'حساب المتجر':'إضافة متجر',lead(s?esc(s.name):'متجر جديد داخل المول','يدخل التاجر من صفحة حساب العمل ويكمل بيانات متجره.')+
    form('visit-mall-store',(!s?field('name','اسم المتجر','','اسم المتجر','text','maxlength="65"')+
      field('category','التصنيف','','أزياء، أحذية، عطور','text','maxlength="40"')+
      field('floor','الدور ورقم المتجر','','الأرضي · A12','text','maxlength="50"'):'')+
      fieldEmail('email','بريد التاجر')+fieldPass('password','كلمة مرور حساب المتجر','new-password')),
    submit('إنشاء حساب المتجر'),'mall-stores');
};
F.forms['visit-mall-store']=d=>busy('جارٍ إنشاء الحساب…',async()=>{
  const m=mallForAccount(),identity=email(d.email);
  if(m?.status!=='approved')return;
  const existing=get('stores',F.s.visitEditStore);
  if(existing&&(existing.mall!==m.id||existing.email))return;
  const name=existing?.name||textInput(d.name,65),category=existing?.category||textInput(d.category,40),floor=existing?.floor||textInput(d.floor,50);
  if(!name||!category||!floor||!addressOK(identity)||!A.passwordValid(d.password))return invalid('أكمل بيانات المتجر وبريده وكلمة مرور من 8 أحرف فيها حرف ورقم.');
  if(unique(identity))return invalid('هذا البريد مرتبط بحساب آخر.');
  const record={id:'merchant:'+identity,role:'merchant',email:identity,name,organization:name,org:m.id};
  await A.storePassword(record,d.password);
  if(existing)existing.email=identity;
  else data.stores.push({id:uid('store'),mall:m.id,name,category,floor,email:identity,active:true,amount:100});
  save();F.go('mall-stores',{replace:true});F.toast('تم إنشاء حساب المتجر');
});
F.actions['visit-store-active']=button=>{
  const s=get('stores',button.dataset.id);
  if(s?.mall!==mallForAccount()?.id)return;
  s.active=!s.active;save();F.render();F.toast(s.active?'المتجر ظاهر للزوار':'تم إيقاف ظهور المتجر');
};
F.views['mall-carriers']=()=>{
  const m=mallForAccount();
  return page('شركات التوصيل',lead('خيارات زوار المول','اضبط الرسوم ونطاق الخدمة لكل شركة.')+
    (data.carriers.filter(c=>c.mall===m.id).map(c=>card(row('<strong>'+esc(c.name)+'</strong>',tag(c.active?'مفعّلة':'معطّلة',c.active?'':'warn'))+
      '<p class="a-muted">'+esc(c.coverage+' · '+c.eta)+' · '+cash(c.fee)+'</p>'+
      row(idButton('تعديل','visit-carrier-edit',c.id),idButton(c.active?'تعطيل':'تفعيل','visit-carrier-active',c.id)))).join('')
      ||empty('truck','أضف أول شركة','تظهر الشركات المفعلة فقط لعميل هذا المول.')),
    b('إضافة شركة','visit-carrier-new'),'mall-carriers',false);
};
F.actions['visit-carrier-new']=()=>{F.s.visitEditCarrier=null;F.go('mall-carrier-edit');};
F.actions['visit-carrier-edit']=button=>{F.s.visitEditCarrier=button.dataset.id;F.go('mall-carrier-edit');};
F.actions['visit-carrier-active']=button=>{
  const c=get('carriers',button.dataset.id);
  if(c?.mall!==mallForAccount()?.id)return;
  c.active=!c.active;save();F.render();F.toast(c.active?'تم تفعيل الشركة':'تم تعطيل الشركة');
};
F.views['mall-carrier-edit']=()=>{
  const c=get('carriers',F.s.visitEditCarrier);
  return page(c?'تعديل شركة':'إضافة شركة',form('visit-carrier',
    field('name','اسم الشركة',c?.name,'اسم تجريبي','text','maxlength="65"')+
    field('coverage','المدن المشمولة',c?.coverage,'الرياض، الدرعية','text','maxlength="100"')+
    field('eta','وقت التوصيل',c?.eta,'خلال 24 ساعة','text','maxlength="45"')+
    field('fee','رسوم التوصيل بالريال',c?.fee??'','','number','min="0" step="0.01" inputmode="decimal"')),
    submit('حفظ الشركة'),'mall-carriers');
};
F.forms['visit-carrier']=d=>{
  const m=mallForAccount(),name=textInput(d.name,65),coverage=textInput(d.coverage,100),eta=textInput(d.eta,45),fee=Number(d.fee);
  if(!m||!name||!coverage||!eta||!d.fee||!Number.isFinite(fee)||fee<0||fee>999)return invalid('أكمل اسم الشركة والتغطية والمدة ورسومًا من صفر إلى 999 ريالًا.');
  const c=get('carriers',F.s.visitEditCarrier);
  const values={name,coverage,eta,fee:Math.round(fee*100)/100};
  if(c?.mall===m.id)Object.assign(c,values);
  else if(!c)data.carriers.push({id:uid('carrier'),mall:m.id,active:true,...values});
  save();F.go('mall-carriers',{replace:true});F.toast('تم حفظ خيارات الشركة');
};
F.views['mall-live']=()=>page('طلبات الجمع',lead('متابعة الخدمة في المول','حالة الجمع والتسليم من واجهة المندوب.')+
  (data.orders.filter(o=>o.mall===mallForAccount()?.id).slice().reverse().map(o=>card(
    row('<strong>'+esc(o.id)+'</strong>',tag(stage[o.status]))+
    '<p class="a-muted">'+o.stops.filter(s=>s.done).length+' من '+o.stops.length+' متاجر · '+(o.destination==='home'?esc(o.carrier):'التوصيل إلى مواقف السيارة')+'</p>')).join('')
    ||empty('route','لا توجد طلبات بعد','تظهر طلبات العملاء هنا بعد تأكيد رسوم الجمع.')),'','mall-home');

async function busy(label,fn) {
  if(V.busy)return;
  V.busy=true;
  const btn=F.$('#app-cta button[type=submit]');
  const caption=btn?.innerHTML;
  if(btn){btn.disabled=true;btn.textContent=label;}
  try {await fn();}
  catch {invalid('تعذر إكمال الخطوة في العرض. أعد المحاولة.');}
  finally {V.busy=false;if(btn?.isConnected){btn.disabled=false;btn.innerHTML=caption;}}
}
const image=file=>new Promise((resolve,reject)=>{
  if(!file?.size)return resolve('');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>350000)return reject(new Error('image'));
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);
});
F.views['merchant-home']=()=>{
  const s=storeForAccount();
  if(!s)return page('حساب المتجر',empty('store','المتجر غير مرتبط بهذا الحساب','اطلب من إدارة المول إنشاء حساب لمتجرك.')+b('تسجيل الخروج','auth-logout','secondary'),'',null,false);
  return page('لوحة المتجر',hero(esc(get('malls',s.mall)?.name),esc(s.name),'اربط الفاتورة بعد الدفع عند الكاشير.','store')+
    '<div class="visit-metrics">'+F.metric('فواتير مرتبطة',data.invoices.filter(i=>i.store===s.id).length,'داخل النموذج')+
    F.metric('طلبات استلام',data.orders.filter(o=>o.status==='collecting'&&o.stops.some(t=>t.store===s.id&&!t.done)).length,'بانتظار المندوب')+'</div>'+
    card(F.listButton('ملف المتجر','store','go:merchant-profile')+F.listButton('الفواتير المرتبطة','receipt-text','go:merchant-pickups')),
    b('إضافة مشتريات عميل','visit-merchant-start'),'merchant-home',false);
};
F.views['merchant-profile']=()=>{
  const s=storeForAccount();
  return page('ملف المتجر',lead(esc(s.name),'تظهر هذه البيانات لزوار المول.')+
    form('visit-store-profile',field('name','اسم المتجر',s.name,'','text','maxlength="65"')+
      field('category','التصنيف',s.category,'','text','maxlength="40"')+
      textarea('description','وصف المتجر',s.description,180)+field('hours','أوقات العمل',s.hours,'مثال: 10 ص – 11 م','text','maxlength="60"')+
      field('contact','معلومات التواصل',s.contact,'جوال أو بريد العرض','text','maxlength="70"')+
      fieldFile('logo','شعار المتجر','image/png,image/jpeg,image/webp')+fieldFile('photo','صورة المتجر','image/png,image/jpeg,image/webp'))+
    (s.logo||s.photo?card(`<div class="a-inline">${storeLogo(s)}<span>الوسائط الحالية</span></div>`+
      (s.photo?`<img class="visit-photo" src="${esc(s.photo)}" alt="">`:'')):'')+
    '<p class="a-muted">صور العرض بصيغة PNG أو JPG أو WebP، حتى 350 كيلوبايت لكل صورة.</p>',submit('حفظ ملف المتجر'),'merchant-profile',false);
};
F.forms['visit-store-profile']=d=>busy('جارٍ حفظ الملف…',async()=>{
  const s=storeForAccount(),name=textInput(d.name,65),category=textInput(d.category,40);
  if(!s||!name||!category)return invalid('أدخل اسم المتجر وتصنيفه.');
  let logo,photo;
  try {[logo,photo]=await Promise.all([image(d.logo),image(d.photo)]);}
  catch {return invalid('اختر صور PNG أو JPG أو WebP بحجم 350 كيلوبايت أو أقل.');}
  Object.assign(s,{name,category,description:textInput(d.description,180),hours:textInput(d.hours,60),contact:textInput(d.contact,70),logo:logo||s.logo,photo:photo||s.photo});
  A.session.organization=name;
  A.model.records[A.session.id].organization=name;
  save();F.render();F.toast('تم حفظ ملف المتجر');
});
const newInvoice=()=>({phone:'',qr:'',person:null,miss:false,number:'',amount:'',bags:'1',source:'manual'});
const reg=()=>V.invoice||(V.invoice=newInvoice());
F.actions['visit-merchant-start']=()=>{V.invoice=newInvoice();F.go('merchant-register');};
function known(phone){
  const record=A.model.records['customer:'+phone];
  const visit=data.visits[phone];
  if(record||phone==='0500000000')return {phone,name:visit?.name||record?.name||'نورة',mall:visit?.mall};
}
F.views['merchant-register']=()=>{
  const r=reg(),s=storeForAccount();
  if(!s)return F.views['merchant-home']();
  return page('ربط فاتورة',lead('فاتورة مدفوعة',esc(s.name)+' · حدّد العميل، ثم أضف بيانات فاتورته.')+
    form('visit-invoice',card('<h3 class="a-section fh-invoice-step"><span class="fh-step-icon">1</span> تحديد العميل</h3>'+
      field('invoice-phone','رقم الجوال',r.phone,'05xxxxxxxx','tel','dir="ltr" maxlength="10" autocomplete="off"')+
      b('بحث عن العميل','visit-lookup','secondary small')+
      (r.person?'<div class="visit-person">'+ic('circle-check')+'<div><strong>'+esc(r.person.name)+'</strong><small dir="ltr">'+esc(mask(r.person.phone))+'</small></div>'+tag(r.person.via==='qr'?'ربط احتياطي':'حساب مطابق')+'</div>':'')+
      (r.miss?note('لم نجد حسابًا مطابقًا لهذا الرقم. تأكد منه أو استخدم رمز العميل.','warn')+
        field('invoice-qr','رمز العميل الاحتياطي',r.qr,'FH-…','text','dir="ltr" maxlength="32" autocomplete="off"')+
        b('مسح QR تجريبي','visit-qr-match','secondary small'):''),'visit-form-card')+
      card('<h3 class="a-section fh-invoice-step"><span class="fh-step-icon">2</span> بيانات الفاتورة</h3>'+
        b('مسح باركود فاتورة تجريبية','visit-invoice-scan','secondary small')+
        (r.source==='scan'?note('تم تحميل بيانات فاتورة عرض. راجع رقمها وقيمتها وعدد الأكياس.'):
          '<p class="a-muted">أو أدخل البيانات يدويًا من فاتورة المتجر.</p>')+
        field('invoice-number','رقم الفاتورة',r.number,'INV-123','text','dir="ltr" maxlength="45"')+
        field('invoice-amount','القيمة المدفوعة بالريال',r.amount,'','number','min="0.01" step="0.01" inputmode="decimal"')+
        field('invoice-bags','عدد الأكياس',r.bags,'1','number','min="1" max="25" inputmode="numeric"'),'visit-form-card')),
    submit('ربط الفاتورة بحساب العميل'),'merchant-register',false);
};
const inputMap={'invoice-phone':'phone','invoice-qr':'qr','invoice-number':'number','invoice-amount':'amount','invoice-bags':'bags'};
F.$('#phone-app').addEventListener('input',e=>{
  const k=inputMap[e.target.name];
  if(k)reg()[k]=e.target.value;
});
F.actions['visit-lookup']=()=>{
  const r=reg(),phone=F.digits(r.phone);
  r.phone=phone;r.person=null;
  const found=known(phone);
  if(found){r.person={...found,via:'phone'};r.miss=false;}
  else r.miss=true;
  F.error='';F.render();
};
F.actions['visit-qr-match']=()=>{
  const r=reg(),mall=storeForAccount()?.mall;
  if(!r.miss)return;
  const input=r.qr.trim().toUpperCase();
  const match=Object.entries(data.visits).find(([,v])=>v.mall===mall&&v.qr===input);
  const phone=match?.[0]||(!input&&mall==='front'?'0500000000':null);
  if(!phone||!known(phone))return F.toast('الرمز لا يطابق زيارة في هذا المول.',true);
  r.person={...known(phone),via:'qr'};r.miss=false;F.render();F.toast('تمت مطابقة رمز العرض');
};
F.actions['visit-invoice-scan']=()=>{
  const r=reg(),s=storeForAccount();
  if(!s)return;
  Object.assign(r,{number:uid('INV').toUpperCase(),amount:String(s.amount),bags:'1',source:'scan'});
  F.error='';F.render();
};
F.forms['visit-invoice']=d=>{
  const s=storeForAccount(),r=reg(),number=textInput(d['invoice-number'],45),amount=Number(d['invoice-amount']),bags=Number(d['invoice-bags']);
  if(!s?.active)return invalid('المتجر موقوف حاليًا. تواصل مع إدارة المول.');
  if(!r.person||r.person.via==='phone'&&r.person.phone!==F.digits(d['invoice-phone']))return invalid('ابحث عن العميل وتأكد من الحساب قبل الإضافة.');
  if(!number||!Number.isFinite(amount)||amount<=0||amount>100000||!Number.isInteger(bags)||bags<1||bags>25)return invalid('راجع رقم الفاتورة وقيمتها وعدد الأكياس.');
  if(data.invoices.some(i=>i.store===s.id&&i.number.toUpperCase()===number.toUpperCase()))return invalid('رقم الفاتورة مرتبط مسبقًا بهذا المتجر.');
  data.invoices.push({id:uid('invoice'),mall:s.mall,store:s.id,phone:r.person.phone,number,amount:Math.round(amount*100)/100,bags,source:r.source,order:null});
  save();V.invoice=newInvoice();F.go('merchant-pickups',{replace:true});F.toast('تمت إضافة الفاتورة لحساب العميل');
};
F.views['merchant-pickups']=()=>{
  const s=storeForAccount();
  const invoices=data.invoices.filter(i=>i.store===s?.id);
  return page('الفواتير المرتبطة',lead('مشتريات عملاء متجرك',esc(s?.name))+
    (invoices.slice().reverse().map(i=>{
      const order=data.orders.find(o=>o.id===i.order);
      const stop=order?.stops.find(t=>t.store===s.id);
      return card(line('فاتورة <span dir="ltr">'+esc(i.number)+'</span>',cash(i.amount))+
        '<p class="a-muted"><span dir="ltr">'+esc(mask(i.phone))+'</span> · '+i.bags+' أكياس</p>'+
        tag(stop?.done?'استلمها المندوب':order?'بانتظار المندوب':'محفوظة للعميل',order&&!stop?.done?'warn':''));
    }).join('')||empty('receipt-text','ما فيه فواتير مرتبطة','سجّل فاتورة مدفوعة لتظهر هنا.')),
    b('إضافة مشتريات عميل','visit-merchant-start'),'merchant-home');
};

const selectedOrder=()=>data.orders.find(o=>o.id===F.s.visitDeliveryOrder);
F.views['delivery-home']=F.views['ops-home']=()=>page('مهام الجمع',hero('المندوب','جولات الجمع','استلم المشتريات من المتاجر، ثم سلّمها حسب الوجهة.','truck')+
  (data.orders.slice().reverse().map(o=>card(row('<strong>'+esc(o.id)+'</strong>',tag(stage[o.status]))+
    '<p class="a-muted">'+esc(get('malls',o.mall)?.name)+' · '+o.stops.filter(s=>s.done).length+' / '+o.stops.length+' متاجر</p>'+
    idButton('عرض جولة المتاجر','visit-delivery-order',o.id))).join('')||
    empty('route','لا توجد مهام جمع','تظهر المهمة بعد تأكيد العميل طلب الجمع.')),
  '',A.session.role==='operations'?'ops-home':'delivery-home',false);
F.actions['visit-delivery-order']=button=>{
  F.s.visitDeliveryOrder=button.dataset.id;
  F.go(A.session.role==='operations'?'ops-task':'delivery-task');
};
F.views['delivery-task']=F.views['ops-task']=()=>{
  const o=selectedOrder();
  if(!o)return F.views['delivery-home']();
  const count=o.stops.filter(s=>s.done).length;
  const next=o.status==='collecting'?(o.destination==='home'?'ابدأ التوصيل':'ابدأ التوصيل إلى المواقف'):
    o.status==='ready'||o.status==='shipped'?'تأكيد التسليم للعميل':'';
  return page('جولة المتاجر',lead(esc(o.id),esc(get('malls',o.mall)?.name)+' · '+stage[o.status])+
    `<div class="visit-progress"><progress value="${count}" max="${o.stops.length}"></progress><span>${count} / ${o.stops.length} متاجر</span></div>`+
    o.stops.map(stop=>{
      const s=get('stores',stop.store);
      return card(row('<strong>'+esc(s.name)+'</strong>',tag(stop.done?'تم الاستلام':'بانتظار الاستلام',stop.done?'':'warn'))+
        '<p class="a-muted">'+esc(s.floor)+'</p>'+
        stop.invoices.map(id=>{const i=get('invoices',id);return '<div class="visit-invoice">'+line('فاتورة <span dir="ltr">'+esc(i.number)+'</span>',i.bags+' أكياس')+'</div>';}).join('')+
        (!stop.done?idButton('تأكيد استلام المتجر','visit-stop-pickup',s.id):''));
    }).join('')+
    card(line('وجهة التسليم',o.destination==='home'?esc(o.carrier):'مواقف السيارة')+
      '<p class="a-muted">'+esc(o.destination==='home'?o.city+' · '+o.address:o.point)+'</p>'),
    next?b(next,'visit-delivery-next','',count===o.stops.length?'':'disabled'):'',A.session.role==='operations'?'ops-home':'delivery-home');
};
F.actions['visit-stop-pickup']=button=>{
  const o=selectedOrder(),s=o?.stops.find(t=>t.store===button.dataset.id);
  if(!s||o.status!=='collecting')return;
  s.done=true;save();F.render();F.toast('تم تسجيل استلام مشتريات المتجر');
};
F.actions['visit-delivery-next']=()=>{
  const o=selectedOrder();
  if(!o||o.stops.some(s=>!s.done)||o.status==='delivered')return;
  o.status=o.status==='collecting'?(o.destination==='home'?'shipped':'ready'):'delivered';
  save();F.render();F.toast(stage[o.status]);
};

F.views['auth-account']=()=>page('حساب العمل',hero('Free Hand',esc(A.session.organization||A.session.name),esc(A.session.email),'user-round')+
  b('تسجيل الخروج','auth-logout','secondary'),'','auth-account',false);
F.tabs.mall=[['mall-home','الرئيسية','layout-dashboard'],['mall-stores','المتاجر','store'],['mall-carriers','التوصيل','truck'],['auth-account','حسابي','user-round']];
F.tabs.merchant=[['merchant-home','المتجر','store'],['merchant-register','إضافة فاتورة','receipt-text'],['merchant-profile','الملف','settings'],['auth-account','حسابي','user-round']];
F.tabs.admin=[['admin-home','المولات','building-2'],['auth-account','حسابي','user-round']];
F.tabs.delivery=[['delivery-home','مهام الجمع','route'],['auth-account','حسابي','user-round']];
F.tabs.operations=[['ops-home','مهام الجمع','route'],['auth-account','حسابي','user-round']];
const supported={
  customer:['saved-places','place-editor','shipping-choice','malls','stores','home','mall-detail','u-store-detail','bags','destination','review','payment','tracking','order-success','account','orders'],
  mall:['mall-home','mall-stores','mall-store-new','mall-carriers','mall-carrier-edit','mall-live','u-mall-status','auth-account'],
  merchant:['merchant-home','merchant-register','merchant-profile','merchant-pickups','auth-account'],
  admin:['admin-home','admin-malls','admin-mall-review','auth-account'],
  delivery:['delivery-home','delivery-task','auth-account'],
  operations:['ops-home','ops-task','auth-account']
};
V.supported=supported;
const homeFor=role=>({customer:F.s.session&&V.mall()?'stores':'malls',mall:'mall-home',merchant:'merchant-home',admin:'admin-home',delivery:'delivery-home',operations:'ops-home'})[role];
F.actions['auth-home']=()=>F.go(homeFor(A.session?.role)||'auth-entry',{replace:true});
const render=F.render;
F.render=animate=>{
  const role=A.session?.role;
  if(role&&!supported[role]?.includes(F.s.route))F.s.route=homeFor(role);
  if(role==='mall'&&mallForAccount()?.status!=='approved'&&F.s.route!=='auth-account')F.s.route='u-mall-status';
  if(role==='merchant'&&!storeForAccount()&&F.s.route!=='auth-account')F.s.route='merchant-home';
  if(role==='customer'&&F.s.route==='destination'&&!V.checkout.city&&V.mall())V.checkout.city=V.mall().city;
  render(animate);
  if(role==='mall'&&mallForAccount()?.status!=='approved')F.$('#app-nav').replaceChildren();
};
const logout=F.actions['auth-confirm-logout'];
F.actions['auth-confirm-logout']=()=>{V.invoice=null;V.loginEmail='';logout();};
window.addEventListener('pageshow',e=>{if(e.persisted)F.render();});
})();
