(()=>{
'use strict';
const F=window.FH,A=F.Access,V=F.Visit,L=F.Location;
const {page,cash,line,data}=V,{ic,b,card,lead,field,form,submit,link,esc,note}=F;
const clone=x=>JSON.parse(JSON.stringify(x));
const screen=(...args)=>{const v=page(...args);v.html=v.html.replace('visit-page','visit-page places-screen');return v;};
const trim=(v,n=160)=>String(v||'').trim().slice(0,n);
const owner=()=>A.session?.role==='customer'?A.session.id:null;
const key=()=>owner()?'fh-saved-places-v1:'+owner():null;
const mallId=()=>V.mall()?.id||'';
function load(){try{const d=JSON.parse(localStorage.getItem(key())||'null');if(d?.version===1&&Array.isArray(d.places))return {...d,selected:d.selected||{}};}catch{}return {version:1,places:[],selected:{}};}
function write(d){if(!owner())return false;try{localStorage.setItem(key(),JSON.stringify(d));return true;}catch{F.toast('تعذر حفظ المكان في المتصفح. أتح مساحة للتخزين ثم أعد المحاولة.',true);return false;}}
const eligible=p=>p.type==='home'||p.type==='parking'&&p.mall===mallId();
const places=()=>load().places.filter(eligible);
const selected=()=>{const d=load();return d.places.find(p=>p.id===d.selected[mallId()]&&eligible(p));};
const label=p=>p?.type==='parking'?'إلى مواقف السيارة':'إلى المنزل';
const icon=p=>p?.type==='parking'?'car-front':'house';
const summary=p=>p?.type==='parking'?[p.gate,p.area&&'منطقة '+p.area,p.number&&'موقف '+p.number].filter(Boolean).join('، ')||'نقطة السيارة المحددة على الخريطة':[p.city,p.address].filter(Boolean).join('، ');
const items=()=>data.invoices.filter(i=>i.phone===A.session?.phone&&i.mall===mallId()&&!i.order);
const carriers=()=>data.carriers.filter(c=>c.mall===mallId()&&c.active&&c.coverage.split(/[,،]/).map(L.normalize).includes(V.checkout.city));
const carrier=()=>carriers().find(c=>c.id===V.checkout.carrier);
const total=()=>V.fee+(selected()?.type==='home'?(carrier()?.fee||0):0);
const paymentMethods=[
 {id:'apple',label:'Apple Pay',icon:'smartphone'},
 {id:'mada',label:'مدى / بطاقة بنكية',icon:'credit-card'}
];
const paymentMethod=id=>paymentMethods.find(method=>method.id===id);
const isPaymentReview=route=>route==='review'||route==='payment';
function apply(p){if(!p||!eligible(p))return false;V.checkout={destination:p.type,city:p.city||V.mall()?.city||'',address:p.type==='home'?p.address:'',details:clone(p.details||{}),coordinates:p.type==='home'?clone(p.coordinates||null):null,parkingCoordinates:p.type==='parking'?clone(p.coordinates||null):null,parkingDetails:p.type==='parking'?{gate:p.gate||'',area:p.area||'',number:p.number||'',otherGate:'',notes:p.notes||''}:{},parking:p.type==='parking'?summary(p):'',addressSaved:p.type==='home',parkingSaved:p.type==='parking',carrier:'',savedPlaceId:p.id};return true;}
function selectPlace(id){const d=load(),p=d.places.find(p=>p.id===id&&eligible(p));if(!p)return false;d.selected[mallId()]=p.id;if(!write(d))return false;apply(p);return true;}
function savePlace(p){const d=load(),index=d.places.findIndex(x=>x.id===p.id);if(index>=0)d.places[index]=clone(p);else d.places.push(clone(p));d.selected[mallId()]=p.id;return write(d);}
function flow(){return F.s.placeFlow||={purpose:'manage',returnTo:'stores'};}
function openPlaces(purpose='manage',returnTo='stores'){F.s.placeFlow={purpose,returnTo};F.go(purpose==='checkout'?'destination':'saved-places');}
function placeCard(p,compact=false){return `<div class="place-row ${selected()?.id===p.id?'is-selected':''}"><button type="button" class="place-choice" data-action="places-select" data-id="${esc(p.id)}" aria-label="استخدام ${esc(p.title)}"><span class="place-symbol">${ic(icon(p))}</span><span class="place-copy"><strong>${esc(p.title)}</strong><small>${esc(summary(p))}</small>${p.type==='parking'?'<small>'+esc(V.get('malls',p.mall)?.name||'')+'</small>':''}</span>${ic(selected()?.id===p.id?'circle-check':'chevron-left')}</button>${compact?'':`<button type="button" class="a-link place-edit" data-action="places-edit" data-id="${esc(p.id)}">${ic('pencil')} تعديل</button>`}</div>`;}
function placeSummary(p,action='places-change'){return card(`<div class="place-summary"><span class="place-symbol">${ic(icon(p))}</span><div class="place-copy"><small>${label(p)}</small><h3 class="a-section">${esc(p?.title||'اختر مكان التسليم')}</h3><p class="a-muted">${esc(summary(p))}</p></div>${link('تغيير',action)}</div>`);}
function steps(index,parking=false){
 const labels=parking?['المكان','الدفع']:['المكان','التوصيل','الدفع'];
 return '<ol class="place-steps" aria-label="خطوات الطلب">'+labels.map((t,i)=>`<li class="${i===index?'current':i<index?'done':''}" ${i===index?'aria-current="step"':''}><span>${i<index?ic('check'):i+1}</span>${t}</li>`).join('')+'</ol>';
}
function listView(checkout=false){if(checkout&&flow().purpose!=='checkout')F.s.placeFlow={purpose:'checkout',returnTo:'bags'};const list=places(),p=selected();return screen(checkout?'مكان التسليم':'أماكن التسليم',
 (checkout?steps(0,p?.type==='parking'):'')+lead(list.length?'اختر مكان التسليم':'أين تستلم مشترياتك؟',list.length?'اختر مكانًا محفوظًا أو أضف مكانًا جديدًا.':'احفظ مكانك مرة واحدة لاستخدامه عند الطلب.')+
 (list.length?'<div class="place-list">'+list.map(p=>placeCard(p)).join('')+'</div>'+b(ic('plus')+' إضافة مكان جديد','places-add','secondary'):
 V.select('إضافة عنوان منزل','places-new-home','',false,'house','اختره على الخريطة أو اكتب العنوان')+V.select('إضافة موقف السيارة','places-new-parking','',false,'car-front','حدّد الموقع أو أدخل البوابة ورقم الموقف')),
 checkout&&p?b('المتابعة بهذا المكان','places-continue'):'',checkout?'bags':null);}
F.views['saved-places']=()=>listView(false);F.views.destination=()=>listView(true);
F.actions['places-add']=()=>F.sheet('إضافة مكان جديد',V.select('عنوان منزل','places-new-home','',false,'house','للتوصيل إلى المنزل')+V.select('موقف السيارة','places-new-parking','',false,'car-front','للتوصيل إلى سيارتك في '+esc(V.mall()?.name||'المول')));
F.actions['places-new-home']=()=>openEditor('home');F.actions['places-new-parking']=()=>openEditor('parking');
F.actions['places-edit']=btn=>{const p=places().find(p=>p.id===btn.dataset.id);if(p)openEditor(p.type,p);};
function openEditor(type,p=null){if(!owner()||!V.mall())return;L.cancelEditor();F.closeSheet();const prior=clone(V.checkout);F.s.placeEditor={id:p?.id||null,type,title:p?.title||'',manualAddress:p?.address||'',notes:p?.notes||'',prior};
 V.checkout={destination:type,city:p?.city||V.mall().city,address:'',carrier:'',details:clone(p?.details||{city:p?.city||V.mall().city,district:'',street:'',building:'',unit:'',short:'',notes:''}),coordinates:type==='home'?clone(p?.coordinates||null):null,parkingCoordinates:type==='parking'?clone(p?.coordinates||null):null,parkingDetails:{gate:p?.gate||'',area:p?.area||'',number:p?.number||'',otherGate:'',notes:p?.notes||''}};
 F.go('place-editor');}
const editor=()=>F.s.placeEditor;
function capture(){const e=editor(),el=F.$('[data-form="place-save"]');if(!e||!el)return;const d=Object.fromEntries(new FormData(el));e.title=trim(d.title,45);e.notes=trim(d.notes,120);if(e.type==='home'){V.checkout.details.city=trim(d.city,50);e.manualAddress=trim(d.address,180);}else{Object.assign(V.checkout.parkingDetails,{gate:trim(d.gate,60),otherGate:trim(d.otherGate,60),area:trim(d.area,40),number:trim(d.number,16)});}}
function editorView(){const e=editor();if(!e)return listView(false);const home=e.type==='home',status=L.editorStatus(),d=V.checkout.details,parking=V.checkout.parkingDetails;const cityOptions=[['','اختر المدينة'],...L.cities.map(c=>[c,c])];if(d.city&&!L.cities.includes(d.city))cityOptions.push([d.city,d.city]);
 const content=lead(home?'عنوان المنزل':'موقف السيارة','حدّد نقطة على الخريطة أو أدخل التفاصيل يدويًا.')+
 '<div class="place-editor-map"><div id="delivery-map" role="region" aria-label="خريطة مكان التسليم"></div><div class="place-map-caption">'+ic('map-pin')+' حرّك الخريطة واضغط على مكان التسليم.</div></div>'+
 b(status.busy?'جارٍ تحديد موقعي…':ic('locate-fixed')+' تحديد موقعي','location-current','secondary',status.busy?'disabled':'')+
 (status.message?'<p class="place-editor-status" role="status">'+esc(status.message)+'</p>':'')+
 form('place-save',field('title','اسم المكان',e.title,home?'مثال: المنزل أو العمل':'مثال: سيارتي عند البوابة ب','text','maxlength="45"')+
 (home?F.select('city','المدينة',cityOptions,d.city)+field('address','تفاصيل العنوان',e.manualAddress||L.composed(d),'الحي، الشارع، رقم المبنى','text','maxlength="180" autocomplete="street-address"'):
 F.select('gate','البوابة',[['','اختر البوابة'],['البوابة أ','البوابة أ'],['البوابة ب','البوابة ب'],['البوابة ج','البوابة ج'],['other','بوابة أخرى']],parking.gate)+(parking.gate==='other'?field('otherGate','اسم البوابة',parking.otherGate,'المدخل الشمالي','text','maxlength="60"'):'')+'<div class="a-grid2">'+F.select('area','المنطقة · اختياري',[['','اختر المنطقة'],['A','A'],['B','B'],['C','C'],['المواقف السطحية','المواقف السطحية'],['القبو','القبو']],parking.area)+field('number','رقم الموقف',parking.number,'مثال: 15','text','maxlength="16"')+'</div>')+
 '<details class="visit-details"><summary>تعليمات إضافية · اختياري</summary>'+field('notes','تعليمات للمندوب',e.notes,'مثال: المدخل الجانبي أو بجانب المصعد','text','maxlength="120"')+'</details>')+
 '<small class="location-privacy">المكان محفوظ في هذا المتصفح لحسابك. الخرائط من OpenStreetMap، وقراءة العنوان عبر Photon.</small>';
 const view=screen(e.id?'تعديل المكان':'إضافة مكان',content,submit(ic('bookmark-check')+' حفظ المكان'),null);view.header=`<div class="a-pagehead"><button type="button" class="a-iconbtn clear" data-action="places-cancel" aria-label="رجوع">${ic('arrow-right')}</button><h1>${e.id?'تعديل المكان':'إضافة مكان'}</h1><span class="a-spacer"></span></div>`;return view;}
F.views['place-editor']=editorView;
F.$('#phone-app').addEventListener('input',e=>{if(e.target.closest('[data-form="place-save"]'))capture();});
F.$('#phone-app').addEventListener('change',e=>{if(!e.target.closest('[data-form="place-save"]'))return;capture();if(e.target.name==='city'){V.checkout.cityManuallyChosen=true;V.checkout.city=V.checkout.details.city;}if(e.target.name==='gate')F.render();});
F.forms['place-save']=()=>{const e=editor();if(!e||!owner())return;capture();const coords=L.acceptEditorPin(),home=e.type==='home',d=V.checkout.details,parking=V.checkout.parkingDetails;const text=trim(e.manualAddress||L.composed(d),180),gate=parking.gate==='other'?parking.otherGate:parking.gate;
 if(home&&(!d.city||(!coords&&text.length<6)))return F.toast('اختر المدينة، ثم حدّد النقطة أو اكتب عنوانًا واضحًا.',true);
 if(!home&&!coords&&(!gate||!parking.number))return F.toast('حدّد نقطة السيارة أو أدخل البوابة ورقم الموقف.',true);
 const p={id:e.id||'place-'+crypto.randomUUID(),type:e.type,title:e.title||(home?'المنزل':'موقف سيارتي'),city:home?d.city:V.mall().city,address:home?(text||'نقطة المنزل على الخريطة'):'',details:home?clone({...d,notes:e.notes}):{},coordinates:clone(coords),notes:e.notes,mall:home?null:mallId(),gate:home?'':gate,area:home?'':parking.area,number:home?'':parking.number,updatedAt:new Date().toISOString()};
 if(!savePlace(p))return;F.s.placeEditor=null;L.cancelEditor();apply(p);F.stack=[];
 if(flow().purpose==='setup'){F.go(flow().returnTo||'stores',{replace:true});F.toast('تم حفظ مكان التسليم. جاهز للتسوق.');}else{F.go(flow().purpose==='checkout'?'destination':'saved-places',{replace:true});F.toast('تم حفظ المكان. لن تحتاج لإدخاله من جديد.');}};
F.actions['places-cancel']=()=>{const e=editor();if(e)V.checkout=clone(e.prior);F.s.placeEditor=null;L.cancelEditor();F.go(flow().purpose==='checkout'?'destination':'saved-places',{replace:true});};
const back=F.actions.back;F.actions.back=()=>F.s.route==='place-editor'?F.actions['places-cancel']():back();
F.actions['places-select']=btn=>{if(!selectPlace(btn.dataset.id))return;if(flow().purpose==='checkout')proceed();else{F.go(flow().returnTo||'stores',{replace:true});F.toast('التسليم إلى '+selected().title);}};
function proceed(){const p=selected();if(!p)return F.toast('اختر مكانًا محفوظًا أو أضف مكانًا أولًا.',true);if(V.checkout.savedPlaceId!==p.id)apply(p);F.go(p.type==='home'?'shipping-choice':'review');}
F.actions['places-continue']=()=>{if(flow().purpose==='checkout')return proceed();if(!selected())return;F.go(flow().returnTo||'stores',{replace:true});};
F.actions['places-change']=()=>openPlaces('checkout','bags');
F.actions['places-open']=()=>openPlaces('manage',F.s.route==='account'?'account':F.s.route==='bags'?'bags':'stores');
const pickMall=F.actions['visit-select-mall'];
F.actions['visit-select-mall']=button=>{
 pickMall(button);
 const place=selected();
 if(place)apply(place);
};
F.actions['visit-finish']=()=>{if(!items().length)return;if(selected())apply(selected());openPlaces('checkout','bags');};
const chip=()=>{const p=selected();return `<button type="button" class="place-address-bar" data-action="places-open"><span class="place-symbol">${ic(p?icon(p):'map-pin')}</span><span class="place-copy"><small>مكان التسليم</small><strong>${esc(p?.title||'أضف مكان التسليم')}</strong><small>${p?esc(summary(p)):'احفظ مكانك مرة واحدة واستخدمه عند الطلب'}</small></span>${ic('chevron-down')}</button>`;};
for(const route of ['stores','bags']){const view=F.views[route];F.views[route]=()=>{const v=view();v.html=v.html.replace(/(<div class="a-pad a-stack visit-page">)/,'$1'+chip());return v;};}
const account=F.views.account;F.views.account=()=>{const v=account();v.html=v.html.replace(/(<div class="a-pad a-stack visit-page">)/,'$1'+card(F.listButton('أماكن التسليم المحفوظة','map-pinned','places-open')));return v;};
F.views['shipping-choice']=()=>{const p=selected();if(!p||p.type!=='home')return listView(true);return screen('شركة التوصيل',steps(1)+placeSummary(p)+lead('اختر شركة التوصيل.','رسوم الجمع '+cash(V.fee)+'، وتضاف لها رسوم الشركة.')+
 '<div class="place-carriers">'+(carriers().map(c=>V.select(esc(c.name),'visit-carrier',c.id,c.id===V.checkout.carrier,'truck',esc(c.eta),cash(c.fee))).join('')||note('لا تتوفر شركة لهذا العنوان لدى المول. غيّر المكان أو اختر موقف السيارة.'))+'</div>'+
 '<p class="place-footnote">الشركات والأسعار للعرض التجريبي، دون حجز فعلي.</p>',b('المراجعة والدفع'+(carrier()?' · '+cash(total()):''),'places-review','',carrier()?'':'disabled'),'bags');};
F.actions['places-review']=()=>{if(selected()?.type==='home'&&!carrier())return;F.go('review');};
F.views.review=F.views.payment=()=>{
 const place=selected();
 if(!place)return listView(true);
 const parking=place.type==='parking';
 const company=parking?null:carrier();
 if(!parking&&!company)return F.views['shipping-choice']();
 const invoices=items();
 const invoiceTotal=invoices.reduce((sum,invoice)=>sum+invoice.amount,0);
 const serviceTotal=cash(total());
 const method=paymentMethod(V.checkout.paymentMethod);
 const options=paymentMethods.map(option=>V.select(
  option.label,'places-payment-method',option.id,option===method,option.icon,''
 )).join('');
 const shipping=company?line('التوصيل · '+esc(company.name),cash(company.fee))+link('تغيير الشركة','go:shipping-choice'):'';
 return screen('مراجعة الطلب والدفع',
  steps(parking?1:2,parking)+
  lead('اختر طريقة الدفع','المطلوب لرسوم الخدمة '+serviceTotal+'. يتأكد الطلب بعد الدفع التجريبي.')+
  '<div class="place-payment-methods" role="group" aria-label="طرق الدفع">'+options+'</div>'+
  placeSummary(place)+
  card(line('جمع المشتريات',cash(V.fee))+shipping+line('إجمالي الخدمة',serviceTotal),'visit-total')+
  card(line('المشتريات المدفوعة للمتاجر',cash(invoiceTotal))+line('الفواتير',invoices.length+' فواتير'))+
  '<p class="place-footnote">دفع تجريبي دون خصم مبلغ.</p>',
  b('ادفع تجريبيًا · '+serviceTotal,'visit-pay','',method?'':'disabled'),'bags');
};
F.actions['places-payment-method']=button=>{
 const method=paymentMethod(button.dataset.id);
 if(!isPaymentReview(F.s.route)||!method)return;
 V.checkout.paymentMethod=method.id;
 F.render();
};
const pay=F.actions['visit-pay'];
F.actions['visit-pay']=()=>{
 const p=selected(),method=paymentMethod(V.checkout.paymentMethod);
 if(!owner()||!isPaymentReview(F.s.route)||!method)return F.toast('اختر طريقة الدفع أولًا.',true);
 if(!p||V.checkout.savedPlaceId!==p.id)return F.toast('اختر مكان التسليم قبل الدفع.',true);
 if(p.type==='home'&&!carrier())return F.toast('اختر شركة التوصيل أولًا.',true);
 const count=data.orders.length;
 pay();
 if(data.orders.length===count)return;
 const order=data.orders.at(-1);
 order.deliveryPlace=clone(p);
 order.paymentMethod=method.id;
 V.save();
 F.render(true);
 F.toast('تم الدفع التجريبي وتأكيد طلب الجمع');
};
function trackingView(){const o=data.orders.filter(o=>o.phone===A.session?.phone).find(o=>o.id===F.s.visitOrderId)||data.orders.filter(o=>o.phone===A.session?.phone).at(-1);if(!o)return F.views.orders();const p=o.deliveryPlace||{title:o.destination==='home'?'المنزل':'موقف السيارة',type:o.destination,city:o.city,address:o.address,coordinates:o.coordinates,gate:o.point};const delivered=o.status==='delivered',inTransit=['ready','shipped'].includes(o.status),index=delivered?3:inTransit?2:1,done=o.stops.filter(s=>s.done).length;
 const count=new Intl.NumberFormat('ar-SA');
 const method=paymentMethod(o.paymentMethod);
 const confirmation=method?'تم دفع '+cash(o.fee)+' تجريبيًا عبر '+method.label:'حُفظ مكان التسليم وطلب الجمع';
 const stages=[['receipt-check','تم تأكيد الطلب',confirmation],['shopping-bag','نجمع مشترياتك',`المتاجر التي استلمنا منها: ${count.format(done)} من ${count.format(o.stops.length)}`],[p.type==='home'?'truck':'car-front',p.type==='home'?'في الطريق إلى المنزل':'في الطريق إلى سيارتك',inTransit||delivered?'توجّه المندوب إلى مكان التسليم':'بعد اكتمال جمع المشتريات'],['package-check','تم التسليم',delivered?'أكّد المندوب التسليم.':'يظهر التأكيد بعد تسجيل تسليم الطلب']];
 const mapLink=p.coordinates?`<a class="place-map-link" target="_blank" rel="noopener noreferrer" href="https://www.openstreetmap.org/?mlat=${encodeURIComponent(p.coordinates.lat)}&amp;mlon=${encodeURIComponent(p.coordinates.lng)}#map=18/${encodeURIComponent(p.coordinates.lat)}/${encodeURIComponent(p.coordinates.lng)}">${ic('map-pinned')} عرض مكان التسليم</a>`:'';
 const progress=index===1&&o.stops.length?`<progress class="fh-collection-progress" value="${done}" max="${o.stops.length}" aria-label="تقدم جمع المشتريات من المتاجر"></progress>`:'';
 return screen('تتبّع طلبك',`<div class="place-tracking-title" aria-live="polite"><div class="fh-tracking-meta"><span>${ic(stages[index][0])}</span><small>طلب <bdi>${esc(o.id)}</bdi></small></div><h2>${delivered?'وصلت مشترياتك':inTransit?'مشترياتك في الطريق':'نجمع مشترياتك من المتاجر'}</h2><p>${esc(stages[index][2])}</p>${progress}</div>`+
 card('<ol class="place-timeline">'+stages.map(([i,t,sub],n)=>`<li class="${n<index?'done':n===index?'current':''}"${n===index?' aria-current="step"':''}><span>${ic(n<index?'check':i)}</span><div><strong>${t}</strong><small>${sub}</small></div></li>`).join('')+'</ol>')+
 card(`<div class="place-summary"><span class="place-symbol">${ic(icon(p))}</span><div class="place-copy"><small>مكان التسليم المحفوظ لهذا الطلب</small><h3 class="a-section">${esc(p.title)}</h3><p class="a-muted">${esc(summary(p))}</p>${p.notes?'<p class="a-muted">'+esc(p.notes)+'</p>':''}</div></div>`+mapLink)+
 '<details class="visit-details"><summary>المتاجر في الطلب</summary>'+o.stops.map(s=>`<div class="place-store-stop">${ic(s.done?'circle-check':'store')}<span>${esc(V.get('stores',s.store)?.name||'المتجر')}</span><small>${s.done?'تم الاستلام':'بانتظار الجمع'}</small></div>`).join('')+'</details>'+
 '<p class="place-footnote">تتغير الحالة عند تسجيل الجمع والتسليم في النموذج.</p>',b('عرض طلباتي','go:orders','secondary'),'orders');}
F.views.tracking=F.views['order-success']=trackingView;
F.SavedPlaces={load,places,selected,savePlace,selectPlace,apply,eligible,summary};
const render=F.render;
F.render=animate=>{
 const paymentReview=isPaymentReview(F.s.route);
 if(A.session?.role==='customer'&&(paymentReview||F.s.route==='shipping-choice')){
  const p=selected();
  if(!p||(paymentReview&&V.checkout.savedPlaceId!==p.id)){
   F.s.placeFlow={purpose:'checkout',returnTo:'bags'};
   F.s.route='destination';
  }else if(paymentReview){
   if(!items().length)F.s.route='bags';
   else if(p.type==='home'&&!carrier())F.s.route='shipping-choice';
  }
 }
 render(animate);
};
F.render();
})();
