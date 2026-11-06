(()=>{
'use strict';
const F=window.FH,A=F.Access,{ic,b,card,head,lead,field,form,submit,note,tag,link,esc,empty,row}=F;
const key='fh-visit-showcase-v1';
const fixtures={
  malls:[
    {id:'front',name:'مول الواجهة',city:'الرياض',point:'البوابة أ · الدور الأرضي',status:'approved',company:'الواجهة للتشغيل',email:'mall@example.com'},
    {id:'garden',name:'مول الحدائق',city:'الرياض',point:'بوابة ٢ · مكتب الخدمات',status:'approved',company:'الحدائق للتشغيل'}
  ],
  stores:[
    {id:'linen',mall:'front',name:'لين للأزياء',category:'أزياء',floor:'الأرضي · A12',active:true,email:'store@example.com',amount:250},
    {id:'step',mall:'front',name:'خطوة للأحذية',category:'أحذية',floor:'الأرضي · A08',active:true,email:'shoes@example.com',amount:200},
    {id:'perfume',mall:'front',name:'أثر للعطور',category:'عطور',floor:'الأول · B14',active:true,email:'perfume@example.com',amount:150},
    {id:'home',mall:'front',name:'دار المنزل',category:'منزل',floor:'الأول · B03',active:true,amount:120},
    {id:'green',mall:'garden',name:'ركن الهدايا',category:'هدايا',floor:'الأرضي · A02',active:true,amount:95}
  ],
  carriers:[
    {id:'city',mall:'front',name:'مسار المدينة',fee:19,coverage:'الرياض',eta:'خلال ٢٤ ساعة',active:true},
    {id:'fast',mall:'front',name:'توصيل الواجهة',fee:26,coverage:'الرياض، الدرعية',eta:'خلال ٤ ساعات',active:true},
    {id:'garden-carrier',mall:'garden',name:'ناقل الحدائق',fee:20,coverage:'الرياض',eta:'خلال ٢٤ ساعة',active:true}
  ],
  visits:{},invoices:[],orders:[]
};
let data;
try {data=JSON.parse(sessionStorage.getItem(key));} catch {}
data ||= fixtures;
const save=()=>sessionStorage.setItem(key,JSON.stringify(data));
const V=F.Visit={data,save,fee:12,category:'الكل',search:'',
  get checkout(){return F.s.visitCheckout||={destination:'parking',city:'',address:'',carrier:''};},
  set checkout(value){F.s.visitCheckout=value;}
};
const get=(kind,id)=>data[kind].find(x=>x.id===id);
const mall=()=>get('malls',F.s.unifiedMallId);
const stores=id=>data.stores.filter(s=>s.mall===id);
const cash=n=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:2}).format(n)+' ر.س';
const line=(label,value)=>row('<span>'+label+'</span>','<strong>'+value+'</strong>');
const idButton=(label,action,id,variant='secondary small')=>b(label,action,variant,'data-id="'+esc(id)+'"');
const page=(title,html,footer='',nav=F.s.route,back=true)=>({title,header:head(title,back),html:'<div class="a-pad a-stack visit-page">'+html+'</div>',footer,nav});
const hero=(label,title,subtitle,icon)=>`<section class="visit-hero"><span class="visit-hero-icon">${ic(icon)}</span><small>${label}</small><h2>${title}</h2><p>${subtitle}</p></section>`;
const select=(label,action,id,pressed,icon,sub,value='')=>`<button type="button" class="visit-option" data-action="${action}" data-id="${esc(id)}" aria-pressed="${pressed}"><span class="visit-icon">${ic(icon)}</span><span><strong>${label}</strong><small>${sub}</small></span>${value?'<b>'+value+'</b>':ic(pressed?'circle-check':'chevron-left')}</button>`;
const textInput=(value,max=100)=>typeof value==='string'?value.trim().slice(0,max):'';
const uid=prefix=>prefix+'-'+crypto.randomUUID().slice(0,8);
const mask=phone=>'••••••'+phone.slice(-4);
const customer=()=>A.session?.phone;
const allOrders=()=>data.orders.filter(o=>o.phone===customer());
const currentOrder=()=>allOrders().find(o=>o.id===F.s.visitOrderId)||allOrders().at(-1);
const openOrder=()=>allOrders().find(o=>o.mall===mall()?.id&&o.status!=='delivered');
const invoiceItems=()=>data.invoices.filter(i=>i.phone===customer()&&i.mall===mall()?.id&&!i.order);
const sum=items=>items.reduce((total,x)=>total+x.amount,0);
const stage={collecting:'نجمع مشترياتك',ready:'في الطريق إلى سيارتك',shipped:'في الطريق إليك',delivered:'تم التسليم'};
const storeLogo=s=>`<span class="store-logo visit-logo">${s.logo?`<img src="${esc(s.logo)}" alt="">`:esc(s.name[0])}</span>`;
Object.assign(V,{get,mall,stores,cash,line,idButton,page,hero,select,textInput,uid,mask,customer,stage,storeLogo,sum});

F.views.malls=()=>page('اختيار المول',lead('وين تتسوّق اليوم؟','اختر المول اللي أنت فيه.')+
  data.malls.filter(m=>m.status==='approved').map(m=>select(esc(m.name),'visit-select-mall',m.id,false,'building-2',esc(m.city)+' · '+stores(m.id).filter(s=>s.active).length+' متاجر')).join(''),
  '',null,false);
F.actions['visit-select-mall']=button=>{
  const m=get('malls',button.dataset.id);
  if(m?.status!=='approved')return;
  F.s.unifiedMallId=m.id;F.s.mall=m.name;F.s.session=true;V.category='الكل';V.search='';
  V.checkout={destination:'parking',city:m.city,address:'',carrier:''};
  F.go('stores');
};
function storeList() {
  const m=mall();
  const query=V.search.toLowerCase().trim();
  const shown=stores(m?.id).filter(s=>s.active&&(V.category==='الكل'||s.category===V.category)
    &&(s.name+' '+s.category).toLowerCase().includes(query));
  return shown.length?shown.map(s=>`<button class="visit-store-row a-card" data-action="visit-open-store" data-id="${esc(s.id)}">
    ${storeLogo(s)}<span><strong>${esc(s.name)}</strong><small>${esc(s.category)} · ${esc(s.floor)}</small></span>${ic('chevron-left')}</button>`).join('')
    :empty('search','ما فيه متاجر في هذا الاختيار','جرّب تصنيفًا آخر أو ابحث باسم المتجر.');
}
F.views.stores=()=>{
  const m=mall();
  if(!m)return F.views.malls();
  const categories=['الكل',...new Set(stores(m.id).filter(s=>s.active).map(s=>s.category))];
  return page('المول',hero(esc(m.city),esc(m.name),'اشترِ من المحلات، وخلّنا نجمع مشترياتك.', 'building-2')+
    '<div class="visit-services">'+tag('توصيل إلى المواقف')+(data.carriers.some(c=>c.mall===m.id&&c.active)?tag('توصيل إلى المنزل'):'')+'</div>'+
    row('<h3 class="a-section">المتاجر</h3>',link('تغيير المول','go:malls'))+
    `<label class="u-search">${ic('search')}<input type="search" name="visit-search" aria-label="ابحث عن متجر" placeholder="ابحث عن متجر" value="${esc(V.search)}"></label>
    <div class="j-categories">${categories.map(c=>`<button data-action="visit-category" data-id="${esc(c)}" aria-pressed="${V.category===c}">${esc(c)}</button>`).join('')}</div>
    <div id="visit-stores" class="visit-list">${storeList()}</div>`,b('عرض مشترياتي '+ic('arrow-left'),'visit-start'),'stores',false);
};
F.views.home=F.views['mall-detail']=F.views.stores;
F.actions['visit-category']=button=>{V.category=button.dataset.id;F.render();};
F.$('#phone-app').addEventListener('input',e=>{
  if(e.target.name==='visit-search'){V.search=e.target.value;F.$('#visit-stores').innerHTML=storeList();F.icons();}
});
F.actions['visit-open-store']=button=>{F.s.visitStore=button.dataset.id;F.go('u-store-detail');};
F.views['u-store-detail']=()=>{
  const s=get('stores',F.s.visitStore);
  if(!s)return F.views.stores();
  return page('تفاصيل المتجر',hero(esc(s.category),esc(s.name),esc(s.floor),'store')+
    (s.photo?`<img class="visit-photo" src="${esc(s.photo)}" alt="">`:'')+
    card(`<div class="a-inline">${storeLogo(s)}<div><strong>${esc(s.description||'تسوّق داخل المتجر')}</strong>
      <p class="a-muted">${[s.hours,s.contact].filter(Boolean).map(esc).join(' · ')}</p></div></div>`)+
    note('ادفع عند الكاشير، ثم أعطه رقم جوالك لربط الفاتورة بحسابك.'),b('عرض مشترياتي','visit-start'),'stores');
};
F.actions['visit-start']=()=>{
  const m=mall();
  if(!m)return F.go('malls');
  data.visits[customer()]={mall:m.id,name:F.s.name,qr:data.visits[customer()]?.qr||uid('FH').toUpperCase()};
  save();F.go('bags');
};
F.actions['visit-qr']=()=>{
  if(!data.visits[customer()])return F.toast('ابدأ التسوق أولًا.',true);
  const visit=data.visits[customer()];
  F.sheet('رمز الربط الاحتياطي',`<div class="j-qr-card"><img src="assets/session-qr.svg" alt="مثال رمز QR للعرض">
    <strong dir="ltr">${esc(visit.qr)}</strong><small>رمز عرض · يستخدم عند تعذّر الربط بالجوال</small></div>`,b('تم','close-sheet','secondary'));
};
const sampleStores=mallId=>stores(mallId).filter(store=>store.active).slice(0,3);
const sampleInvoices=()=>{
  const m=mall();
  if(!m||!customer()||invoiceItems().length||openOrder())return;
  const examples=sampleStores(m.id);
  if(!examples.length)return;
  for(const s of examples){
    data.invoices.push({id:uid('invoice'),mall:m.id,store:s.id,phone:customer(),number:'DEMO-'+s.id.toUpperCase(),
      amount:s.amount,bags:1,source:'demo',order:null});
  }
  save();F.render();F.toast('تمت إضافة فواتير العرض');
};
F.actions['visit-sample']=sampleInvoices;
F.views.bags=()=>{
  const m=mall();
  if(!m)return F.views.malls();
  const items=invoiceItems(),order=openOrder();
  const groups=[...new Set(items.map(i=>i.store))].map(id=>items.filter(i=>i.store===id));
  const demo=!items.length&&!order&&sampleStores(m.id).length
    ?card('<h3 class="a-section">الفواتير التجريبية</h3>'+
      '<p class="a-muted">أضف فواتير مدفوعة تجريبيًا وجرّب طلب الجمع والدفع.</p>'+
      b('إضافة فواتير تجريبية','visit-sample','secondary'),'visit-form-card')
    :'';
  return page('مشترياتي',lead(esc(m.name),'ادفع عند الكاشير وأعطه رقم جوالك. فواتيرك تظهر هنا.')+
    demo+
    (order?card(row('<strong>طلب الجمع '+esc(order.id)+'</strong>',tag(stage[order.status]))+
      '<p class="a-muted">تابع طلبك الحالي، أو اختر مولًا آخر لبدء تجربة جديدة.</p>'+
      link('اختيار مول آخر','go:malls')):'')+
    (items.length?card(line('قيمة المشتريات المدفوعة',cash(sum(items)))+
      '<p class="a-muted">الدفعات تمت لدى المتاجر. تدفع داخل التطبيق رسوم الخدمة فقط.</p>','visit-total')+
      groups.map(group=>card(`<div class="a-inline">${storeLogo(get('stores',group[0].store))}<strong>${esc(get('stores',group[0].store).name)}</strong></div>
        ${group.map(i=>`<div class="visit-invoice">${line((i.source==='demo'?'فاتورة تجريبية':'فاتورة')+' <span dir="ltr">'+esc(i.number)+'</span>',cash(i.amount))}<small>${i.bags} أكياس</small>${tag('مدفوعة للمحل')}</div>`).join('')}`)).join('')
      :(demo||order?'':empty('receipt-text','ما ظهرت فواتيرك بعد','بعد الدفع، اطلب من الكاشير ربط الفاتورة برقم جوالك.')))+
    '<div class="visit-links">'+link('تصفح المتاجر','go:stores')+link('رمز QR الاحتياطي','visit-qr')+'</div>',
    order?idButton('تابع جمع مشترياتي','visit-open-order',order.id,''):items.length?b('اطلب جمع مشترياتي '+ic('arrow-left'),'visit-finish'):'','bags',false);
};
F.actions['visit-finish']=()=>{
  if(!invoiceItems().length)return;
  V.checkout={destination:'parking',city:mall().city,address:'',carrier:''};
  F.go('destination');
};
const available=()=>data.carriers.filter(c=>c.mall===mall()?.id&&c.active&&c.coverage.split(/[,،]/).map(x=>x.trim()).includes(V.checkout.city));
const choice=()=>available().find(c=>c.id===V.checkout.carrier);
const total=()=>V.fee+(V.checkout.destination==='home'?(choice()?.fee||0):0);
F.views.destination=()=>{
  const m=mall();
  if(!m)return F.views.malls();
  if(V.checkout.destination==='pickup')V.checkout.destination='parking';
  const home=V.checkout.destination==='home';
  const carriers=available();
  return page('الاستلام والتوصيل',lead('وين تستلم مشترياتك؟','من '+new Set(invoiceItems().map(i=>i.store)).size+' متاجر · قيمة الفواتير مدفوعة.')+
    select('التوصيل إلى مواقف السيارة','visit-destination','parking',!home,'car-front','نوصل مشترياتك لسيارتك عند المواقف المحددة',cash(V.fee))+
    select('التوصيل إلى المنزل','visit-destination','home',home,'house','اختر عنوانك وشركة التوصيل')+
    (!home?form('visit-parking',field('parking','البوابة ورقم الموقف',V.checkout.parking||'','مثال: بوابة ٢، منطقة B، موقف ١٥','text','maxlength="100"')+'<button class="a-button secondary small" type="submit">حفظ موقع السيارة</button>'): '')+(home?form('visit-address',field('city','المدينة',V.checkout.city,'الرياض')+
      field('address','الحي والشارع ورقم المبنى',V.checkout.address,'مثال: حي الربيع، مبنى ١٢','text','maxlength="160"')+
      '<button class="a-button secondary small" type="submit">عرض خيارات التوصيل</button>')+
      (V.checkout.address?(carriers.length?carriers.map(c=>select(esc(c.name),'visit-carrier',c.id,c.id===V.checkout.carrier,'truck',esc(c.eta),cash(c.fee))).join('')
      :note('ما فيه شركة مفعلة تغطي هذه المدينة. غيّر المدينة أو اختر التوصيل إلى مواقف السيارة.','warn')):''):''),
    b('راجع رسوم الخدمة'+(!home||choice()?' · '+cash(total()):''),'visit-review','',!home||choice()?'':'disabled'),'bags');
};
F.actions['visit-destination']=button=>{if(!['home','parking'].includes(button.dataset.id))return;V.checkout.destination=button.dataset.id;F.render();};
F.forms['visit-parking']=d=>{const parking=textInput(d.parking,100);if(parking.length<4)return F.fail('حدد البوابة ورقم الموقف ليسهل الوصول إليك.');V.checkout.parking=parking;F.render();};
F.forms['visit-address']=d=>{
  const city=textInput(d.city,40),address=textInput(d.address,160);
  if(!city||address.length<6)return F.toast('أدخل المدينة وعنوان الاستلام.',true);
  V.checkout={...V.checkout,city,address,carrier:''};
  V.checkout.carrier=available().slice().sort((a,b)=>a.fee-b.fee)[0]?.id||'';
  F.error='';F.render();
};
F.actions['visit-carrier']=button=>{V.checkout.carrier=button.dataset.id;F.render();};
F.actions['visit-review']=()=>{
  const address=F.$('#app-form');
  if(V.checkout.destination==='parking'){if(!V.checkout.parking||address&&new FormData(address).get('parking')?.trim()!==V.checkout.parking)return F.fail('احفظ البوابة ورقم الموقف قبل المتابعة.');}else if(address){const d=new FormData(address);if(d.get('city').trim()!==V.checkout.city||d.get('address').trim()!==V.checkout.address)return F.toast('حدّث خيارات التوصيل بعد تعديل العنوان.',true);}
  if(V.checkout.destination==='home'&&!choice())return;
  F.go('review');
};
F.views.review=()=>{
  const m=mall(),c=V.checkout.destination==='home'?choice():null,items=invoiceItems();
  if(!m||!items.length)return F.views.bags();
  return page('تأكيد طلب الجمع',lead('أكد طلب جمع مشترياتك.',c?esc(c.name+' · '+V.checkout.address):esc(V.checkout.parking||m.point))+
    card(line('قيمة الفواتير · مدفوعة للمتاجر',cash(sum(items)))+
      '<p class="a-muted">هذا المبلغ لا يدخل في رسوم الطلب.</p>')+
    card('<h3 class="a-section">رسوم الخدمة</h3>'+line('التجميع',cash(V.fee))+
      (c?line('التوصيل · '+esc(c.name),cash(c.fee)):'')+'<hr class="a-rule">'+line('المبلغ المطلوب',cash(total())),'visit-total')+
    link('تغيير الاستلام أو التوصيل','go:destination')+note('تأكيد تجريبي للعرض. لا يُخصم أي مبلغ.'),
    b('أكد وادفع تجريبيًا · '+cash(total()),'visit-pay'),'bags');
};
F.actions['visit-pay']=()=>{
  const m=mall(),items=invoiceItems(),home=V.checkout.destination==='home',c=home?choice():null;
  if(!m||!items.length||openOrder()||!['home','parking'].includes(V.checkout.destination)||!home&&!V.checkout.parking||home&&!c)return F.toast('راجع المشتريات وخيار الاستلام.',true);
  const id='FH-'+(4100+data.orders.length);
  const o={id,mall:m.id,phone:customer(),destination:V.checkout.destination,point:home?'':V.checkout.parking,
    city:home?V.checkout.city:'',address:home?V.checkout.address:'',carrier:c?.name||'',fee:total(),status:'collecting',
    stops:[...new Set(items.map(i=>i.store))].map(store=>({store,done:false,invoices:items.filter(i=>i.store===store).map(i=>i.id)}))};
  items.forEach(i=>i.order=id);data.orders.push(o);save();F.s.visitOrderId=id;F.stack=[];
  F.go('tracking',{replace:true});F.toast('تم تأكيد طلب الجمع');
};
F.actions['visit-open-order']=button=>{F.s.visitOrderId=button.dataset.id;F.go('tracking');};
F.views.orders=()=>page('طلباتي',lead('طلبات جمع مشترياتك','تابع حالة كل طلب.')+
  (allOrders().slice().reverse().map(o=>card(row('<strong>'+esc(o.id)+'</strong>',tag(stage[o.status]))+
    '<p class="a-muted">'+esc(get('malls',o.mall)?.name)+'</p>'+idButton('عرض التتبع','visit-open-order',o.id))).join('')
    ||empty('route','ما عندك طلبات جمع','تظهر طلباتك بعد تأكيد رسوم الخدمة.')),'','account');
F.views.tracking=()=>{
  const o=currentOrder();
  if(!o)return F.views.orders();
  const n=o.stops.filter(s=>s.done).length;
  return page('متابعة الطلب',hero(esc(o.id),stage[o.status],o.destination==='home'?esc(o.carrier+' · '+o.address):esc(o.point),'route')+
    `<div class="visit-progress"><progress value="${n}" max="${o.stops.length}"></progress><span>${n} من ${o.stops.length} متاجر تم الاستلام منها</span></div>`+
    o.stops.map(s=>card(row('<strong>'+esc(get('stores',s.store)?.name)+'</strong>',tag(s.done?'تم الاستلام':'بانتظار الاستلام',s.done?'':'warn'))+
      '<p class="a-muted">'+s.invoices.length+' فواتير مدفوعة</p>')).join('')+
    card(line('رسوم الخدمة · مدفوعة تجريبيًا',cash(o.fee)))+
    (o.status==='ready'?note('المندوب يوصل مشترياتك إلى الموقف المحدد. ابقَ متاحًا للتواصل.'):''),b('رجوع إلى مشترياتي','go:bags','secondary'),'bags');
};
F.views['order-success']=F.views.tracking;
F.views.account=()=>page('حسابي',hero('حساب العميل',esc(F.s.name),esc(mask(customer()||'')),'user-round')+
  card(F.listButton('طلبات الجمع','route','go:orders')+F.listButton('اختيار المول','building-2','go:malls'))+
  b('تسجيل الخروج','auth-logout','secondary'),'','account',false);
F.tabs.customer=[['stores','المول','building-2'],['bags','مشترياتي','shopping-bag'],['account','حسابي','user-round']];
})();


