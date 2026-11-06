(()=>{
'use strict';
const F=window.FH,A=F.Access,V=F.Visit;
const {data,save,page,hero,line,idButton,uid,textInput}=V;
const {b,card,lead,field,form,submit,note,tag,esc}=F;
const owner=()=>data.malls.find(m=>m.email===A.session?.email&&m.status==='approved');
const pending=s=>s.status==='pending'||s.status==='rejected';
const status=s=>({pending:'بانتظار اعتماد المول',approved:'معتمد',rejected:'يحتاج تعديلًا'})[s.status]||'معتمد';
const clean=(v,n=100)=>textInput(v,n);
const file=(name,label)=>`<label class="a-field">${label}<input type="file" name="${name}" accept=".pdf,image/png,image/jpeg"></label>`;
const section=(title,fields)=>`<fieldset class="fh-form-section"><legend>${title}</legend>${fields}</fieldset>`;
let kind='choose',sending=false,direct=false;
const documents=F.JoinDocuments||={
 async database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('fh-join-documents',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});},
 async put(id,file){const db=await this.database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}},
 async get(id){const db=await this.database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
};
const invalid=message=>F.toast(message,true);
F.actions['work-join']=()=>{kind='choose';direct=false;V.joinSent=null;F.go('auth-register');};
function join(type){
 direct=F.s.route!=='auth-register';kind=type;V.joinSent=null;
 F.go('auth-register',{replace:!direct});
}
F.actions['join-store']=()=>join('store');
F.actions['join-mall']=()=>join('mall');
const back=F.actions.back;
F.actions.back=()=>{
 if(F.s.route!=='auth-register'||kind==='choose')return back();
 kind='choose';V.joinSent=null;
 if(direct){direct=false;return back();}
 F.go('auth-register',{replace:true});
};
const mallRegistration=F.views['auth-register'];
F.views['auth-register']=()=>{
 if(kind==='choose')return page('إنشاء حساب عمل',lead('كيف تستخدم Free Hand؟','اختر الجهة التي تمثّلها.')+
 V.select('تسجيل مول','join-mall','',false,'building-2','لإدارة المتاجر وطلبات انضمامها.')+
 V.select('انضمام متجر','join-store','',false,'store','أرسل طلبًا إلى إدارة المول الذي يقع فيه متجرك.'),
 b('لدي حساب · تسجيل الدخول','back','secondary'),null);
 if(kind!=='store')return mallRegistration();
 if(V.joinSent)return page('تم إرسال طلب المتجر',hero('طلب الانضمام','طلبك لدى إدارة المول','ستراجع الإدارة بيانات متجرك وتطابق السجل وعقد الفرع قبل اعتماد الحساب.','file-check-2')+card(line('المتجر',esc(V.joinSent.name))+line('المول',esc(data.malls.find(m=>m.id===V.joinSent.mall)?.name))+line('الحالة',tag('بانتظار المراجعة','warn')))+note('بعد الموافقة ادخل بالبريد وكلمة المرور اللذين سجلتهما. إذا رُفض الطلب، يظهر السبب عند محاولة الدخول.'),b('العودة إلى تسجيل الدخول','go:auth-role-login'),null);
 const malls=data.malls.filter(m=>m.status==='approved');
 return page('انضمام متجر',lead('قدّم طلبًا لمولك','بعد اعتماد إدارة المول، يمكنك الدخول إلى حساب متجرك.')+
 (malls.length?form('join-request',section('بيانات الفرع',F.select('mall','المول المسجّل',[['','اختر المول الذي يقع فيه المتجر'],...malls.map(m=>[m.id,m.name+' · '+m.city])],'')+
 field('name','اسم المتجر والفرع','','مثال: متجر العطور · فرع المول','text','maxlength="65"')+
 field('category','نشاط المتجر','','أزياء، عطور، إلكترونيات','text','maxlength="40"')+
 field('floor','الدور ورقم المحل','','مثال: الدور الأول، محل B14','text','maxlength="50"'))+
 section('مستندات الاعتماد',field('registration','رقم السجل التجاري','','١٠ أرقام','text','inputmode="numeric" maxlength="10" dir="ltr"')+
 field('lease','رقم عقد الإيجار أو مرجع الفرع لدى المول','','رقم المرجع','text','maxlength="60"')+
 file('document','نسخة السجل التجاري · ملف تجريبي مطلوب')+
 file('leaseDocument','إثبات وجود الفرع في المول · ملف تجريبي مطلوب'))+
 section('حساب مسؤول المتجر',field('manager','اسم مسؤول المتجر','','الاسم','text','maxlength="60"')+
 field('phone','جوال التواصل','','05xxxxxxxx','tel','maxlength="10" dir="ltr"')+
 field('email','البريد الإلكتروني للحساب','','name@example.com','email','dir="ltr" autocomplete="username"')+
 field('password','كلمة المرور','','٨ أحرف على الأقل، حرف ورقم','password','autocomplete="new-password"')+
 field('confirm','تأكيد كلمة المرور','','أعد كتابة كلمة المرور','password','autocomplete="new-password"'))+
 '<label class="a-check"><input type="checkbox" name="authorized"><span>أقر بصحة البيانات وأني مخوّل بتقديم الطلب عن المتجر.</span></label>'):
 note('لا توجد مولات معتمدة حاليًا. يجب تسجيل المول واعتماده أولًا.'))+
 note('نموذج محلي: المرفقات محفوظة في هذا المتصفح للمراجعة التجريبية، وبيانات الحسابات في جلسة هذا التبويب. لا يوجد تحقق رسمي من السجل؛ استخدم بيانات تجريبية.'),malls.length?submit('إرسال الطلب إلى إدارة المول'):'',null);
};
F.forms['join-request']=async d=>{
 if(sending)return;
 const m=data.malls.find(m=>m.id===d.mall&&m.status==='approved');
 const identity=clean(d.email,120).toLowerCase(),registration=F.digits(d.registration),phone=F.digits(d.phone);
 if(!m)return invalid('اختر مولًا معتمدًا من القائمة.');
 if([d.name,d.category,d.floor,d.lease,d.manager].some(x=>clean(x).length<2))return invalid('أكمل بيانات الفرع ومسؤوله ومرجع وجوده في المول.');
 if(!/^\d{10}$/.test(registration)||!/^05\d{8}$/.test(phone))return invalid('أدخل سجلًا من ١٠ أرقام وجوالًا صحيحًا يبدأ بـ05.');
 if(!A.validEmail(identity)||!A.passwordValid(d.password)||d.password!==d.confirm)return invalid('راجع البريد وتطابق كلمتي المرور. كلمة المرور ٨ أحرف على الأقل وفيها حرف ورقم.');
 if(!d.authorized)return invalid('أكد صحة البيانات وصلاحيتك لتقديم الطلب.');
 if(!d.document?.size||!d.leaseDocument?.size)return invalid('أرفق السجل وإثبات وجود الفرع باستخدام ملفين تجريبيين.');
 const docs=[d.document,d.leaseDocument];
 if(docs.some(f=>f.size>5*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(f.type)))return invalid('المرفقات PDF أو PNG أو JPG، حتى ٥ ميغابايت للملف.');
 if(['mall','merchant','delivery','admin','operations'].some(r=>A.recordFor(r,identity))||data.stores.some(s=>s.email===identity)||data.malls.some(m=>m.email===identity))return invalid('البريد مسجل مسبقًا. استخدم بريدًا آخر أو سجّل الدخول.');
 if(data.stores.some(s=>s.mall===m.id&&(s.name.trim()===clean(d.name,65)||s.floor.trim()===clean(d.floor,50))&&s.status!=='rejected'))return invalid('يوجد متجر أو طلب لهذا الاسم أو رقم المحل في المول. راجع إدارة المول.');
 sending=true;
 try{
 const s={id:uid('store'),mall:m.id,name:clean(d.name,65),category:clean(d.category,40),floor:clean(d.floor,50),registration,lease:clean(d.lease,60),manager:clean(d.manager,60),phone,email:identity,status:'pending',active:false,amount:100,submittedAt:new Date().toISOString(),docs:docs.map(f=>({name:clean(f.name,120),size:f.size}))};
 for(let i=0;i<docs.length;i++){const id=s.id+'-'+i;await documents.put(id,docs[i]);s.docs[i].id=id;}
 await A.storePassword({id:'merchant:'+identity,role:'merchant',email:identity,name:s.manager,organization:s.name,org:m.id},d.password);
 data.stores.push(s);save();V.joinSent=s;F.render();
 }catch{F.fail('تعذر حفظ الطلب في المتصفح. أعد المحاولة.');}finally{sending=false;}
};
// Enforce approval at the actual login handler, including old login entry points.
const login=F.forms['auth-business-login'];
F.forms['auth-business-login']=async d=>{
 const s=data.stores.find(s=>s.email===String(d['business-email']).trim().toLowerCase());
 if(A.chosenRole==='merchant'&&s&&pending(s))return invalid(s.status==='pending'?'حساب المتجر بانتظار موافقة إدارة '+data.malls.find(m=>m.id===s.mall)?.name+'. لم يُفعّل الدخول بعد.':'لم يُعتمد الطلب: '+(s.reason||'راجع إدارة المول.')+' تواصل مع الإدارة لإعادة المراجعة.');
 return login(d);
};
const storeList=F.views['mall-stores'];
F.views['mall-stores']=()=>{
 const m=owner();if(!m)return F.views['u-mall-status']();
 const requests=data.stores.filter(s=>s.mall===m.id&&pending(s));
 const view=storeList();
 // Pending applications are reviewed separately and cannot be activated from the store list.
 const approved=data.stores.filter(s=>s.mall===m.id&&!pending(s));
 view.html=`<div class="a-pad a-stack visit-page">${lead('متاجر '+esc(m.name),'إدارة طلبات الانضمام والحسابات من مكان واحد.')}${card(line('بانتظار المراجعة',String(requests.filter(s=>s.status==='pending').length))+line('متاجر معتمدة',String(approved.length)))}<h3 class="a-section">طلبات الانضمام</h3>${requests.length?requests.map(s=>card(line(esc(s.name),tag(status(s),'warn'))+'<p class="a-muted">'+esc(s.floor)+' · '+esc(s.email)+'</p>'+idButton('مراجعة الطلب','join-review',s.id))).join(''):note('لا توجد طلبات معلّقة. طلبات المتاجر التي تختار هذا المول تظهر هنا.')}<h3 class="a-section">المتاجر المعتمدة</h3>${approved.map(s=>card(line(esc(s.name),tag(s.active?'مفعّل':'موقوف',s.active?'':'warn'))+'<p class="a-muted">'+esc(s.floor)+' · '+esc(s.email||'بدون حساب')+'</p>'+idButton(s.active?'إيقاف ظهور المتجر':'تفعيل ظهور المتجر','visit-store-active',s.id)+(!s.email?idButton('إنشاء حساب','visit-existing-store',s.id):''))).join('')||note('لم تُضف متاجر معتمدة بعد.')}</div>`;
 return view;
};
let docURLs=[];
F.actions['join-review']=async btn=>{
 const s=data.stores.find(s=>s.id===btn.dataset.id&&s.mall===owner()?.id);if(!s)return;
 docURLs.forEach(d=>URL.revokeObjectURL(d.url));docURLs=[];
 for(const d of s.docs||[]){try{const file=d.id&&await documents.get(d.id);if(file)docURLs.push({id:d.id,url:URL.createObjectURL(file)});}catch{}}
 F.s.joinReview=s.id;F.go('mall-stores');
};
const listing=F.views['mall-stores'];
const selected=()=>data.stores.find(s=>s.id===F.s.joinReview&&s.mall===owner()?.id&&pending(s));
F.views['mall-stores']=()=>{
 const s=selected();if(!s)return listing();
 return page('مراجعة انضمام المتجر',lead(esc(s.name),esc(owner().name)+' · '+status(s))+
 card(line('الموقع',esc(s.floor))+line('النشاط',esc(s.category))+line('السجل التجاري',esc(s.registration))+line('مرجع الفرع / العقد',esc(s.lease))+line('المسؤول',esc(s.manager))+line('التواصل',esc(s.phone))+line('البريد',esc(s.email)))+
 card('<h3 class="a-section">المستندات المقدمة</h3>'+(s.docs||[]).map(d=>{const f=docURLs.find(f=>f.id===d.id);return '<p class="a-muted">'+esc(d.name)+(f?' · <a href="'+esc(f.url)+'" download="'+esc(d.name)+'">تنزيل للمراجعة</a>':' · الملف غير متاح في هذا المتصفح')+'</p>';}).join(''))+
 (s.reason?note('سبب القرار السابق: '+esc(s.reason),'warn'):'')+
 form('join-decision','<label class="a-check"><input type="checkbox" name="verified"><span>طابقت بيانات السجل ومرجع الفرع مع سجلات المول ضمن تجربة العرض.</span></label>'+field('reason','ملاحظات المراجعة أو سبب الرفض','','مطلوب عند الرفض','text','maxlength="200"'))+
 note('الموافقة تفعّل حساب المتجر وظهوره ضمن هذا المول فقط.')+b('العودة إلى المتاجر','join-back','secondary'),
 b('اعتماد المتجر وتفعيل حسابه','join-approve')+b('رفض مع توضيح السبب','join-reject','secondary'),'mall-stores');
};
F.actions['join-back']=()=>{F.s.joinReview=null;F.render();};
function decide(approve){
 const s=selected();if(!s||!owner())return;
 const fields=new FormData(F.$('#app-form')),reason=clean(fields.get('reason'),200);
 if(approve&&!fields.get('verified'))return invalid('أكد مطابقة السجل ووجود الفرع في المول قبل الاعتماد.');
 if(!approve&&reason.length<5)return invalid('اكتب سببًا واضحًا للرفض من ٥ أحرف على الأقل.');
 s.status=approve?'approved':'rejected';s.active=approve;s.reason=reason;s.reviewedBy=A.session.email;s.reviewedAt=new Date().toISOString();save();F.s.joinReview=null;F.render();F.toast(approve?'تم اعتماد المتجر، ويمكنه تسجيل الدخول الآن.':'تم حفظ سبب الرفض.');
}
F.actions['join-approve']=()=>decide(true);F.actions['join-reject']=()=>decide(false);
const activate=F.actions['visit-store-active'];
F.actions['visit-store-active']=btn=>{const s=data.stores.find(s=>s.id===btn.dataset.id);if(s&&pending(s))return F.toast('اعتمد طلب الانضمام أولًا.',true);activate(btn);};
const dashboard=F.views['mall-home'];
F.views['mall-home']=()=>{const view=dashboard(),m=owner();if(m){const n=data.stores.filter(s=>s.mall===m.id&&s.status==='pending').length;view.html=view.html.replace('متاجر المول وحساباتها','المتاجر وطلبات الانضمام'+(n?' · '+n+' طلب جديد':''));}return view;};
// A pending account restored from an old session must not reach merchant tools.
const render=F.render;
F.render=animate=>{const s=data.stores.find(s=>s.email===A.session?.email);if(A.session?.role==='merchant'&&s&&pending(s)){A.logout();F.error='حساب المتجر لم يُعتمد بعد. راجع إدارة المول.';}render(animate);};
F.render();
})();

