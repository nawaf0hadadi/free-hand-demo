(()=>{
'use strict';
const F=window.FH,A=F.Access,V=F.Visit;
const {data,save,page,select,cash}=V,{b,card,lead,field,form,submit,note,esc,link}=F;
const cities=['الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الظهران','الأحساء','الطائف','تبوك','بريدة','عنيزة','حائل','أبها','خميس مشيط','جازان','نجران','الباحة','ينبع','الجبيل','القطيف','حفر الباطن','الخرج','عرعر','سكاكا','القريات','بيشة','القنفذة','الرس'];
const centers={'الرياض':{lat:24.7136,lng:46.6753},'جدة':{lat:21.5433,lng:39.1728},'مكة المكرمة':{lat:21.4225,lng:39.8262},'المدينة المنورة':{lat:24.4672,lng:39.6111},'الدمام':{lat:26.4207,lng:50.0888},'الخبر':{lat:26.2172,lng:50.1971},'الطائف':{lat:21.2703,lng:40.4158},'تبوك':{lat:28.3835,lng:36.5662},'أبها':{lat:18.2164,lng:42.5053}};
Object.assign(centers,{'خميس مشيط':{lat:18.30,lng:42.73},'جازان':{lat:16.89,lng:42.55},'نجران':{lat:17.49,lng:44.13},'الباحة':{lat:20.01,lng:41.47},'بريدة':{lat:26.36,lng:43.98},'عنيزة':{lat:26.09,lng:43.99},'حائل':{lat:27.52,lng:41.70},'ينبع':{lat:24.09,lng:38.06},'الجبيل':{lat:27.01,lng:49.66},'القطيف':{lat:26.57,lng:50.00},'حفر الباطن':{lat:28.43,lng:45.97},'الخرج':{lat:24.15,lng:47.31},'عرعر':{lat:30.98,lng:41.03},'سكاكا':{lat:29.97,lng:40.21},'القريات':{lat:31.33,lng:37.34},'بيشة':{lat:20.00,lng:42.61},'القنفذة':{lat:19.13,lng:41.08},'الرس':{lat:25.87,lng:43.50},'الأحساء':{lat:25.38,lng:49.59},'الظهران':{lat:26.29,lng:50.11}});
const aliases={riyadh:'الرياض',jeddah:'جدة',jiddah:'جدة',mecca:'مكة المكرمة',makkah:'مكة المكرمة',medina:'المدينة المنورة',madinah:'المدينة المنورة',dammam:'الدمام',khobar:'الخبر',dhahran:'الظهران',taif:'الطائف',tabuk:'تبوك',abha:'أبها'};
const normalize=value=>{const s=String(value||'').trim();return aliases[s.toLowerCase().replace(/^al[ -]/,'')]||s;};
const settings=window.FHLocationConfig||{reverseEndpoint:'https://photon.komoot.io/reverse',tiles:'https://tile.openstreetmap.org/{z}/{x}/{y}.png'};
const isParking=()=>V.checkout.destination!=='home';
const coordinates=()=>isParking()?V.checkout.parkingCoordinates:V.checkout.coordinates;
const setCoordinates=value=>{if(isParking())V.checkout.parkingCoordinates=value;else V.checkout.coordinates=value;};
const parking=()=>V.checkout.parkingDetails||={gate:'',area:'',number:'',otherGate:'',notes:''};
let geoRequest=0;
const address=()=>V.checkout.details||=( {city:normalize(V.checkout.city)||'',district:'',street:'',building:'',unit:'',short:'',notes:''} );
const composed=d=>[d.district,d.street,d.building&&'مبنى '+d.building,d.unit&&'وحدة '+d.unit,d.short].filter(Boolean).join('، ');
const trim=(v,n=120)=>String(v||'').trim().slice(0,n);
const carriers=()=>data.carriers.filter(c=>c.mall===V.mall()?.id&&c.active&&c.coverage.split(/[,،]/).map(normalize).includes(V.checkout.city));
const destinationPage=(...args)=>{const v=page(...args);v.html=v.html.replace('visit-page','visit-page location-checkout');return v;};
const chosen=()=>carriers().find(c=>c.id===V.checkout.carrier);
let busy=false,message='',showMap=true,map=null,marker=null,pin=null,pendingPin=false,checkoutRef=V.checkout,sequence=0,lastLookup=0,lastMode=V.checkout.destination;
const cache=new Map();
// Existing sample services become named examples; owner-created carriers are preserved.
for(const c of data.carriers){if(c.id==='city'&&c.name==='مسار المدينة'){c.name='أرامكس';c.example=true;}if(c.id==='fast'&&c.name==='توصيل الواجهة'){c.name='سمسا';c.example=true;}if(c.id==='garden-carrier'&&c.name==='ناقل الحدائق'){c.name='سبل | SPL';c.example=true;}if(c.example)c.coverage=cities.join('،');}
if(!data.carriers.some(c=>c.id==='spl-example'))data.carriers.push({id:'spl-example',mall:'front',name:'سبل | SPL',fee:24,eta:'خلال 1–3 أيام عمل',coverage:cities.join('،'),active:true,example:true});
save();
function read(){const el=F.$('[data-form="location-address"]');if(!el)return address();const d=Object.fromEntries(new FormData(el));for(const k of ['city','district','street','building','unit','short','notes'])address()[k]=trim(d[k]);address().short=address().short.toUpperCase();return address();}
function saveAddress(){if(pendingPin)return F.toast('اعتمد النقطة المحددة على الخريطة أولًا.',true),false;const d=read();if(!d.city)return F.toast('اختر المدينة من القائمة.',true),false;
 if(!cities.includes(d.city)&&d.city!==V.checkout.detectedCity)return F.toast('اختر مدينة صحيحة.',true),false;
 if(d.short&&!/^[A-Z]{4}\d{4}$/.test(d.short))return F.toast('العنوان المختصر يتكوّن من 4 أحرف إنجليزية و4 أرقام، مثل RRRD1234.',true),false;
 if(!V.checkout.coordinates&&(!d.district||!d.street||!d.building))return F.toast('أكمل الحي والشارع ورقم المبنى، أو حدّد الموقع بالخريطة.',true),false;
 V.checkout.city=d.city;V.checkout.address=composed(d)||'موقع محدد على الخريطة';V.checkout.addressSaved=true;
 if(!chosen())V.checkout.carrier='';return true;
}
const mapMarkup=()=>`<div class="location-map-wrap"><div class="location-map-heading"><strong>${isParking()?'مكان السيارة على الخريطة':'نقطة التوصيل على الخريطة'}</strong><span>${coordinates()?'نقطة محددة':'اختر النقطة بنفسك'}</span></div><div id="delivery-map" role="region" aria-label="خريطة موقع التسليم"></div><p class="a-muted">${coordinates()?'حرّك العلامة لتصحيح النقطة، ثم اضغط تأكيد النقطة.':'هذه خريطة المنطقة وليست موقعك الحالي. اضغط عند المكان المطلوب، ثم أكّد النقطة.'}</p>${b('تأكيد النقطة المختارة','location-pin','secondary small')}</div>`;
const locationControls=()=>mapMarkup()+b(busy?'جارٍ طلب موقع الجهاز…':'استخدم موقع جهازي','location-current','secondary',busy?'disabled':'')+(busy?b('إلغاء الانتظار واختيار النقطة بنفسي','location-cancel','secondary small'):'')+(message?'<p class="location-message" role="status">'+esc(message)+'</p>':'')+(coordinates()?'<p class="location-confirm">'+F.ic('map-pin')+'تم حفظ النقطة'+(coordinates().accuracy?' · دقة الجهاز التقريبية '+Math.round(coordinates().accuracy)+' مترًا':'')+'</p>':'')+'<small class="location-privacy">الخرائط: OpenStreetMap · تُرسل النقطة إلى Photon لقراءة العنوان. يمكنك متابعة الخطوة بالنقطة حتى لو تعذّرت قراءة تفاصيلها.</small>';
function parkingFields(){const d=parking(),config=V.mall()?.parkingConfig||{gates:['البوابة أ','البوابة ب','البوابة ج'],areas:['A','B','C','المواقف السطحية','القبو']};
 return card('<h3 class="a-section">وين سيارتك؟</h3><p class="a-muted">اختر نقطة السيارة، أو أدخل البوابة ورقم الموقف.</p>'+locationControls()+
 form('location-parking','<h3 class="a-section">بيانات الموقف</h3>'+F.select('gate','البوابة',[['','اختر البوابة'],...config.gates.map(g=>[g,g]),['other','بوابة أخرى']],d.gate)+(d.gate==='other'?field('otherGate','اسم البوابة',d.otherGate,'مثال: المدخل الشمالي','text','maxlength="60"'):'')+
 '<div class="a-grid2">'+F.select('area','منطقة المواقف · اختياري',[['','اختر المنطقة'],...config.areas.map(a=>[a,a])],d.area)+field('number','رقم الموقف',d.number,'مثال: 15 أو B15','text','maxlength="16"')+'</div>'+field('parkingNotes','علامة تساعد المندوب · اختياري',d.notes,'مثال: بجانب المصعد، سيارة بيضاء','text','maxlength="120"')+
 '<button type="submit" class="a-button secondary">حفظ مكان السيارة</button>')+'<p class="a-muted">خيارات البوابات والمناطق تجريبية لهذا النموذج؛ اختر «بوابة أخرى» إذا لم تجدها.</p>');
}
function readParking(){const el=F.$('[data-form="location-parking"]');if(!el)return parking();const d=new FormData(el);for(const k of ['gate','area','number','otherGate'])parking()[k]=trim(d.get(k),60);parking().notes=trim(d.get('parkingNotes'));return parking();}
function saveParking(){const d=readParking();if(pendingPin)return F.toast('أكّد النقطة التي اخترتها على الخريطة أولًا.',true),false;const gate=d.gate==='other'?d.otherGate:d.gate;if(!coordinates()&&(!gate||!d.number))return F.toast('اختر نقطة السيارة بالخريطة، أو حدّد البوابة ورقم الموقف.',true),false;
 V.checkout.parking=[gate,d.area&&'منطقة '+d.area,d.number&&'موقف '+d.number,d.notes].filter(Boolean).join('، ')||'نقطة السيارة المحددة على الخريطة';V.checkout.parkingSaved=true;return true;}
function homeFields(){const d=address(),coords=V.checkout.coordinates;const options=[['','اختر المدينة'],...cities.map(c=>[c,c])];if(d.city&&!cities.includes(d.city))options.push([d.city,d.city+' · حسب الموقع']);
 return card('<h3 class="a-section">عنوان المنزل</h3><p class="a-muted">اختر نقطة المنزل، أو أكمل العنوان يدويًا.</p>'+locationControls()+
 form('location-address',F.select('city','المدينة',options,d.city)+
 '<div class="a-grid2">'+field('district','الحي',d.district,'اسم الحي','text','autocomplete="address-level3"')+field('street','الشارع',d.street,'اسم الشارع','text','autocomplete="address-line1"')+'</div>'+
 '<div class="a-grid2">'+field('building','رقم المبنى',d.building,'رقم المبنى','text','inputmode="numeric" maxlength="10"')+field('unit','الوحدة · اختياري',d.unit,'شقة أو مكتب','text','maxlength="15"')+'</div>'+
 '<details class="visit-details"><summary>العنوان الوطني وتفاصيل إضافية · اختياري</summary>'+field('short','العنوان الوطني المختصر',d.short,'RRRD1234','text','dir="ltr" maxlength="8" style="text-transform:uppercase"')+'<p class="a-muted">أدخل عنوانك المختصر إن توفر لديك. التحقق الرسمي عبر سبل غير مربوط في هذه النسخة.</p>'+field('notes','تعليمات للمندوب',d.notes,'مثال: المدخل الجانبي، الدور الثاني','text','maxlength="120"')+'</details>'+
 '<button class="a-button secondary" type="submit">حفظ العنوان وعرض شركات التوصيل</button>'));
}
F.views.destination=()=>{const m=V.mall();if(!m)return F.views.malls();const home=V.checkout.destination==='home',c=chosen();
 return destinationPage('مكان التسليم',lead('وين نوصل مشترياتك؟','اختر المنزل أو المواقف، ثم راجع رسوم الخدمة.')+
 '<div class="destination-choices">'+select('إلى المنزل','visit-destination','home',home,'house','على عنوانك أو موقع تختاره بالخريطة')+
 select('إلى مواقف السيارة','visit-destination','parking',!home,'car-front','بالخريطة أو بيانات الموقف',cash(V.fee))+'</div>'+
 (home?homeFields()+ (V.checkout.addressSaved?card('<h3 class="a-section">اختر شركة التوصيل</h3><p class="a-muted">رسوم التوصيل تضاف إلى رسوم الجمع · '+cash(V.fee)+'</p>'+ (carriers().length?carriers().map(c=>select(esc(c.name),'visit-carrier',c.id,c.id===V.checkout.carrier,'truck',esc(c.eta)+(c.example?' · عرض توضيحي':''),cash(c.fee))).join(''):note('لا تتوفر شركة تغطي هذه المدينة لدى هذا المول حاليًا. يمكنك تعديل العنوان أو اختيار المواقف.'))+(carriers().some(c=>c.example)?'<p class="a-muted">أسماء الشركات للعرض؛ الأسعار والمدد توضيحية وليست عروضًا مباشرة من شركات الشحن.</p>':'')):''):
 parkingFields()),
 b(home?'مراجعة الطلب'+(c?' · '+cash(V.fee+c.fee):''):'مراجعة الطلب · '+cash(V.fee),'visit-review','',home&&(!V.checkout.addressSaved||!c)?'disabled':''),'bags');};
F.forms['location-parking']=()=>{if(saveParking()){message='تم حفظ مكان السيارة. يمكنك مراجعة الطلب الآن.';F.render();}};
F.forms['location-address']=()=>{if(saveAddress()){message='راجع تفاصيل العنوان، خصوصًا رقم المبنى والمدخل.';F.render();}};
F.$('#phone-app').addEventListener('input',e=>{if(e.target.closest('[data-form="location-address"]')){read();V.checkout.addressSaved=false;V.checkout.carrier='';const button=F.$('#app-cta button');if(button&&F.s.route!=='place-editor')button.disabled=true;}});
F.$('#phone-app').addEventListener('change',e=>{if(e.target.name==='city'&&e.target.closest('[data-form="location-address"]')){read();V.checkout.cityManuallyChosen=true;if(V.checkout.coordinates&&address().city!==V.checkout.detectedCity){delete V.checkout.coordinates;pin=null;pendingPin=false;}V.checkout.addressSaved=false;V.checkout.carrier='';const button=F.$('#app-cta button');if(button&&F.s.route!=='place-editor')button.disabled=true;if(map&&!coordinates()&&centers[address().city]){const center=centers[address().city];map.setView([center.lat,center.lng],12);}}});
F.actions['location-manual']=()=>{read();pendingPin=false;pin=V.checkout.coordinates||null;showMap=true;message='اختر المدينة وأكمل تفاصيل العنوان. يمكنك تعديل أي حقل.';F.render();F.$('[name="city"]')?.focus();};
F.actions['location-clear']=()=>{read();delete V.checkout.coordinates;pendingPin=false;V.checkout.addressSaved=false;pin=null;message='تم مسح النقطة. يمكنك إدخال العنوان أو تحديد موقع جديد.';F.render();};
F.actions['location-map']=()=>{read();showMap=!showMap;F.render();};
function geoError(error){return ({1:'لم تسمح بالوصول إلى موقعك. يمكنك السماح من إعدادات المتصفح أو اختيار النقطة على الخريطة أو إدخال العنوان يدويًا.',2:'تعذر تحديد موقع الجهاز. اختر النقطة من الخريطة أو أدخل العنوان يدويًا.',3:'استغرق تحديد الموقع وقتًا طويلًا. حاول مجددًا أو اختره من الخريطة.'})[error.code]||'تعذر تحديد الموقع. أدخل العنوان يدويًا أو اختر نقطة على الخريطة.';}
async function reverse(lat,lng,accuracy,token){
 const key=lat.toFixed(5)+','+lng.toFixed(5);let response=cache.get(key);
 if(!response){const wait=1100-(Date.now()-lastLookup);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastLookup=Date.now();
 const url=new URL(settings.reverseEndpoint);url.search=new URLSearchParams({lat,lon:lng,limit:1,lang:'en'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const r=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});if(!r.ok)throw Error('lookup');response=await r.json();cache.set(key,response);}finally{clearTimeout(timer);}}
 if(token!==sequence)return;
 const p=response.features?.[0]?.properties;if(!p)throw Error('empty');
 if(p.countrycode&&p.countrycode.toUpperCase()!=='SA')throw Error('outside');
 const city=normalize(p.city||p.town||p.village||'');
 if(isParking()){message='نقطة السيارة محفوظة. أضف رقم الموقف إن توفر ليسهل الوصول.';return;}
 if(V.checkout.addressSaved){message='نقطة التسليم محفوظة، وتم الاحتفاظ بالعنوان الذي أكّدته.';return;}
 const d=read();
 setCoordinates({lat,lng,accuracy:accuracy||null});pin={lat,lng};pendingPin=false;
 if(city&&!V.checkout.cityManuallyChosen)d.city=city;V.checkout.detectedCity=city;d.district||=p.district||p.locality||p.suburb||'';d.street||=p.street||(p.type==='street'?p.name:'')||'';d.building||=p.housenumber||'';
 V.checkout.addressSaved=false;V.checkout.carrier='';showMap=true;message='تم تحديد النقطة وتعبئة التفاصيل المتاحة. راجع المدينة والعنوان وأكمل الناقص؛ أسماء الشوارع قد تظهر بالإنجليزية.';
}
async function locatePoint(lat,lng,accuracy){const token=++sequence;const mode=V.checkout.destination;setCoordinates({lat,lng,accuracy:accuracy||null});pin={lat,lng};pendingPin=false;busy=false;V.checkout.addressSaved=false;V.checkout.parkingSaved=false;message='تم حفظ النقطة. يمكنك إكمال البيانات والمتابعة الآن؛ نجلب تفاصيل العنوان إن توفرت.';F.render();
 try{await reverse(lat,lng,accuracy,token);}catch(e){if(token!==sequence||mode!==V.checkout.destination)return;if(e.message==='outside'){setCoordinates(null);pin=null;message='النقطة خارج السعودية. اختر موقعًا داخل نطاق الخدمة.';}else message='النقطة محفوظة ويمكن استخدامها. تعذرت قراءة اسم العنوان؛ عدّل التفاصيل يدويًا عند الحاجة.';}
 finally{if(token===sequence&&mode===V.checkout.destination&&['destination','place-editor'].includes(F.s.route)){readParking();const scroll=F.$('#app-screen')?.scrollTop||0;const focused=globalThis.document?.activeElement?.name;F.render();if(F.$('#app-screen'))F.$('#app-screen').scrollTop=scroll;if(focused)F.$('[name="'+focused+'"]')?.focus();}}}
F.$('#phone-app').addEventListener('input',e=>{if(e.target.closest('[data-form="location-parking"]')){readParking();V.checkout.parkingSaved=false;}});
F.$('#phone-app').addEventListener('change',e=>{if(e.target.closest('[data-form="location-parking"]')){readParking();V.checkout.parkingSaved=false;if(e.target.name==='gate')F.render();}});
F.actions['location-cancel']=()=>{geoRequest++;busy=false;message='اختر النقطة مباشرة على الخريطة، أو أكمل البيانات يدويًا.';F.render();};
F.actions['location-current']=()=>{if(busy)return;read();readParking();if(!navigator.geolocation){message='هذا المتصفح لا يوفّر موقع الجهاز. الخريطة والإدخال اليدوي يعملان دون ذلك.';return F.render();}const request=++geoRequest;busy=true;message='إذا طلب المتصفح إذن الموقع، اختر السماح. يمكنك اختيار النقطة بنفسك في أي وقت.';F.render();
 navigator.geolocation.getCurrentPosition(p=>{if(request!==geoRequest)return;busy=false;locatePoint(p.coords.latitude,p.coords.longitude,p.coords.accuracy);},e=>{if(request!==geoRequest)return;busy=false;message=geoError(e)+' الخريطة جاهزة أمامك للاختيار.';F.render();},{enableHighAccuracy:false,timeout:6000,maximumAge:60000});};
F.actions['location-pin']=()=>{if(!pin)return F.toast('اضغط على الخريطة عند مكان التسليم أولًا، ثم أكّد النقطة.',true);geoRequest++;busy=false;read();readParking();locatePoint(pin.lat,pin.lng,null);};
const oldReview=F.actions['visit-review'];F.actions['visit-review']=()=>{if(isParking()){if(saveParking())F.go('review');return;}if(!saveAddress()||!chosen())return;F.go('review');};
const oldPay=F.actions['visit-pay'];F.actions['visit-pay']=()=>{if(isParking()&&!saveParking())return;if(V.checkout.destination==='home'&&(!V.checkout.addressSaved||!chosen()))return F.toast('احفظ العنوان واختر شركة التوصيل أولًا.',true);const count=data.orders.length;oldPay();if(data.orders.length>count){const o=data.orders.at(-1);{o.coordinates=coordinates()?{...coordinates()}:null;o.addressDetails=isParking()?{...parking()}:{...address()};o.deliveryNotes=isParking()?parking().notes:address().notes;save();}}};
const oldRender=F.render;F.render=animate=>{if(checkoutRef!==V.checkout||lastMode!==V.checkout.destination){sequence++;geoRequest++;busy=false;lastMode=V.checkout.destination;F.error='';checkoutRef=V.checkout;pin=coordinates()||null;pendingPin=false;message='';showMap=true;}if(map){map.remove();map=null;marker=null;}oldRender(animate);const element=F.$('#delivery-map');if(!element)return;if(!window.L){element.innerHTML='<p class="a-muted">الخريطة غير متاحة. تحديد موقعي والإدخال اليدوي متاحان.</p>';return;}
 const center=pin||coordinates()||centers[address().city]||({lat:24.7136,lng:46.6753});
 map=L.map(element,{scrollWheelZoom:false}).setView([center.lat,center.lng],pin||coordinates()?17:centers[address().city]?12:6);
 L.tileLayer(settings.tiles,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
 const icon=L.divIcon({className:'delivery-pin',html:'<span></span>',iconSize:[28,38],iconAnchor:[14,38]});
 const position=(lat,lng)=>{pin={lat,lng};if(marker)marker.setLatLng([lat,lng]);else{marker=L.marker([lat,lng],{icon,draggable:true}).addTo(map);marker.on('dragend',()=>{const p=marker.getLatLng();pin={lat:p.lat,lng:p.lng};geoRequest++;busy=false;sequence++;pendingPin=true;V.checkout.addressSaved=false;V.checkout.parkingSaved=false;const button=F.$('#app-cta button');if(button&&F.s.route!=='place-editor')button.disabled=true;});}};
 if(pin||coordinates())position(center.lat,center.lng);
 map.on('click',e=>{position(e.latlng.lat,e.latlng.lng);geoRequest++;busy=false;sequence++;pendingPin=true;V.checkout.addressSaved=false;V.checkout.parkingSaved=false;const button=F.$('#app-cta button');if(button&&F.s.route!=='place-editor')button.disabled=true;});
};
const reviewView=F.views.review;F.views.review=()=>{const v=reviewView();if(V.checkout.destination==='home')v.html=v.html.replace('أكد طلب جمع مشترياتك.', 'أكد طلب جمع مشترياتك.').replace(V.checkout.address?esc(V.checkout.address):'__missing__',esc(V.checkout.city+'، '+V.checkout.address));return v;};
for(const route of ['delivery-task','ops-task']){const view=F.views[route];if(view)F.views[route]=()=>{const v=view(),o=data.orders.find(o=>o.id===F.s.visitDeliveryOrder);if(o?.coordinates){const {lat,lng}=o.coordinates;v.html+=card('<h3 class="a-section">موقع التسليم</h3><a href="https://www.openstreetmap.org/?mlat='+encodeURIComponent(lat)+'&amp;mlon='+encodeURIComponent(lng)+'#map=18/'+encodeURIComponent(lat)+'/'+encodeURIComponent(lng)+'" target="_blank" rel="noopener noreferrer">فتح نقطة التسليم على الخريطة</a>'+(o.deliveryNotes?'<p class="a-muted">'+esc(o.deliveryNotes)+'</p>':''));}return v;};}
F.Location={normalize,composed,geoError,reverse,settings,cities,saveParking,coordinates,
 editorStatus:()=>({message,busy,pending:pendingPin,coordinates:coordinates()}),
 acceptEditorPin:()=>{geoRequest++;sequence++;busy=false;if(pin){setCoordinates({...pin,accuracy:pendingPin?null:coordinates()?.accuracy||null});pendingPin=false;}return coordinates()||null;},
 cancelEditor:()=>{geoRequest++;sequence++;busy=false;pin=null;pendingPin=false;message='';}
};
F.render();
})();
