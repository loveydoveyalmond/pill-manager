
const K='pillManagerV4';
const DEFAULT={max:120,rest:4,notify:'21:00',e:{}};
const MED_RANGES=[
 ['2023-02-16','2023-06-13'],['2023-06-18','2023-09-12'],['2023-09-17','2023-12-25'],
 ['2023-12-30','2024-04-10'],['2024-04-15','2024-08-05'],['2024-08-10','2024-09-24'],
 ['2024-09-29','2025-01-22'],['2025-01-27','2025-05-26'],['2025-05-31','2025-08-17'],
 ['2025-08-22','2025-10-11'],['2025-12-31','2026-02-13'],['2026-02-18','2026-06-01'],
 ['2026-06-06','2026-09-22'],['2026-09-26','2026-09-27']
];
function buildHistory(){
  const e={};
  const start=new Date('2023-02-16T00:00:00'), end=new Date('2026-09-27T00:00:00');
  const med=new Set();
  const iso=d=>d.toLocaleDateString('sv-SE');
  for(const [a,b] of MED_RANGES){let d=new Date(a+'T00:00:00'),z=new Date(b+'T00:00:00');while(d<=z){med.add(iso(d));d.setDate(d.getDate()+1)}}
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const x=iso(d);e[x]=med.has(x)?{med:true}:{rest:true}}
  e['2026-09-27'].time=new Date().toISOString();
  return e;
}
let s=JSON.parse(localStorage.getItem(K)||'null');
if(!s||typeof s!=='object')s={...DEFAULT,e:buildHistory()};
if(!s.e||Object.keys(s.e).length===0)s.e=buildHistory();
s.max=+s.max||120;s.rest=+s.rest||4;s.notify=s.notify||'21:00';
let cm=new Date();cm.setDate(1);
const I=d=>{let x=new Date(d);return x.toLocaleDateString('sv-SE')},T=()=>{let d=new Date();d.setHours(0,0,0,0);return d},P=x=>new Date(x+'T00:00:00'),A=(d,n)=>{let x=new Date(d);x.setDate(x.getDate()+n);return x},F=x=>new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'numeric',day:'numeric'}).format(P(x)),E=x=>s.e[x]||{},save=()=>localStorage.setItem(K,JSON.stringify(s));
function set(x,v){let next={...E(x),...v};if(!Object.values(next).some(Boolean))delete s.e[x];else s.e[x]=next;save()}
function medRun(x){let n=0,d=P(x);while(E(I(d)).med){n++;d=A(d,-1)}return n}
function bleedRun(x){let n=0,d=P(x);while(E(I(d)).bleed){n++;d=A(d,-1)}return n}
function restRun(x){let n=0,d=P(x);while(E(I(d)).rest){n++;d=A(d,-1)}return n}
function latestMedDate(){let ds=Object.keys(s.e).filter(x=>E(x).med).sort();return ds.length?ds[ds.length-1]:null}
function currentMedStart(){let last=latestMedDate();if(!last)return null;let d=P(last);while(E(I(A(d,-1))).med)d=A(d,-1);return I(d)}
function plannedRestStart(){
  const today=I(T());
  // 3日連続出血が今日で成立 → 明日から休薬
  if(bleedRun(today)>=3)return I(A(T(),1));
  // 直近の服薬日を基準に120日目の翌日を予定休薬開始日とする
  const start=currentMedStart();
  if(!start)return null;
  const day=medRun(latestMedDate());
  const last=latestMedDate();
  if(day>=+s.max)return I(A(P(last),1));
  return I(A(P(start),+s.max));
}
function projectedRestDates(){
  const start=plannedRestStart();if(!start)return new Set();
  const out=new Set();for(let i=0;i<+s.rest;i++)out.add(I(A(P(start),i)));return out;
}
function autoRest(){
  // 実績として3日連続出血が成立した場合、翌日から休薬を自動記録。
  const dates=Object.keys(s.e).sort();
  let changed=false;
  for(const x of dates){
    if(!E(x).bleed||bleedRun(x)<3)continue;
    const st=I(A(P(x),1));
    // 出血3日目以降に服薬を記録した場合でも、翌日から休薬。
    for(let i=0;i<+s.rest;i++){
      const y=I(A(P(st),i)), old=E(y);
      if(old.med||!old.rest){s.e[y]={...old,med:false,rest:true};changed=true}
    }
    break;
  }
  // 120日連続服薬の実績が成立した場合も、翌日から休薬。
  for(const x of dates){
    if(!E(x).med||medRun(x)<+s.max)continue;
    const st=I(A(P(x),1));
    for(let i=0;i<+s.rest;i++){
      const y=I(A(P(st),i)),old=E(y);
      if(old.med||!old.rest){s.e[y]={...old,med:false,rest:true};changed=true}
    }
    break;
  }
  if(changed)save();
}
function status(){
  autoRest();
  const x=I(T()),e=E(x);
  if(e.rest){return ['rest',restRun(x)]}
  if(e.med){return ['med',medRun(x)]}
  return ['none',0]
}
function toast(t){let q=document.createElement('div');q.className='toast';q.textContent=t;document.body.append(q);setTimeout(()=>q.remove(),1600)}
function take(){
  const x=I(T()),old=E(x);
  // 服薬を押した瞬間に「服薬1日目」へ反映。出血記録は消さない。
  set(x,{...old,med:true,rest:false,time:new Date().toISOString()});
  render();toast('今日の服薬を記録しました');
}
function manualRest(){
  const st=T();
  for(let i=0;i<+s.rest;i++){
    const x=I(A(st,i)),old=E(x);
    s.e[x]={...old,med:false,rest:true};
  }
  save();render();toast('今日から休薬を開始しました');
}
function bleed(){
  const x=I(T()),old=E(x),next=!old.bleed;
  set(x,{...old,bleed:next});
  autoRest();render();toast(next?'出血を記録しました':'出血記録を解除しました');
}
function home(){
  let [t,n]=status(),x=I(T()),e=E(x),pct=t==='med'?Math.min(100,n/+s.max*100):t==='rest'?n/+s.rest*100:0;
  const b=[0,1,2].filter(i=>E(I(A(T(),-i))).bleed).length;
  const ps=plannedRestStart();
  let next='—';
  if(t==='rest')next=`休薬中（あと${Math.max(0,+s.rest-n)}日）`;
  else if(ps)next=`${F(ps)}から${s.rest}日`;
  else if(t==='med')next=`あと${Math.max(0,+s.max-n)}日`;
  document.querySelector('#home').innerHTML=`
  <div class="card status"><div class="small">${t==='rest'?'現在は休薬期間':t==='med'?'現在は服薬期間':'記録待ち'}</div><div class="big">${t==='rest'?`休薬 ${n}日目`:t==='med'?`連続服薬 ${n}日目`:'服薬開始前'}</div><div class="small">${F(x)}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="note">${t==='rest'?`あと${Math.max(0,+s.rest-n)}日で服薬再開`:`上限 ${s.max}日まであと${Math.max(0,+s.max-n)}日`}</div></div>
  <div class="card"><div class="row"><button class="btn b" onclick="take()">💊${e.med?' ✓':''}</button><button class="btn g" onclick="manualRest()">🌱</button><button class="btn r" onclick="bleed()">🌷${e.bleed?' ✓':''}</button></div><div class="note" style="margin-top:9px">${e.time?'服薬時刻：'+new Date(e.time).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'「服薬」を押すと、今日の服薬としてすぐに記録されます。'}</div></div>
  <div class="card"><div class="summary"><div class="mini"><span>次の休薬予定</span><b>${next}</b></div><div class="mini"><span>過去3日間の出血</span><b>${b}日</b></div></div>${ps?`<p class="note" style="margin-top:10px">📅 カレンダーでは、次の休薬${F(ps)}〜${F(I(A(P(ps),+s.rest-1)))}を予定として表示しています。</p>`:''}</div>
`
}
function cal(){
  autoRest();let y=cm.getFullYear(),m=cm.getMonth(),f=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),w=f.getDay(),planned=projectedRestDates(),h='';
  for(let q of ['日','月','火','水','木','金','土'])h+=`<div class="dow">${q}</div>`;
  for(let i=0;i<w;i++)h+='<div></div>';
  for(let d=1;d<=days;d++){
    let x=I(new Date(y,m,d)),e=E(x),isPlan=planned.has(x)&&!e.rest;
    let marks=(e.med?'💊':'')+(e.rest?'🌱':'')+(e.bleed?'🌷':'')+(isPlan?'🌱':'');
    h+=`<button class="day ${x===I(T())?'today':''} ${isPlan?'planned':''}" onclick="edit('${x}')"><b>${d}</b><div class="mark">${marks||' '}</div>${isPlan?'<div style="font-size:9px;color:#8b7545">休薬予定</div>':''}</button>`
  }
  document.querySelector('#calendar').innerHTML=`<div class="card"><div class="month"><button class="nav" onclick="cm.setMonth(cm.getMonth()-1);render()">‹</button><b>${y}年${m+1}月</b><button class="nav" onclick="cm.setMonth(cm.getMonth()+1);render()">›</button></div><div class="cal">${h}</div><div class="legend"><span>💊服薬</span><span>🌱休薬</span><span>🌷出血</span></div><p class="note">3日連続出血、または${s.max}日連続服薬が成立すると、翌日から${s.rest}日間が自動的に休薬表示になります。休薬は🌱、出血は🌷で表示します。日付をタップすると修正できます。</p></div>`
}
function edit(x){let e=E(x);document.querySelector('#modal').innerHTML=`<div class="modal"><div class="sheet"><button class="close" onclick="closeM()">×</button><h2>${F(x)}</h2><button class="btn b" onclick="tog('${x}','med')">服薬 ${e.med?'✓':''}</button><br><br><button class="btn r" onclick="tog('${x}','bleed')">出血 ${e.bleed?'✓':''}</button><br><br><button class="btn g" onclick="tog('${x}','rest')">休薬 ${e.rest?'✓':''}</button><br><br><button class="btn gray" onclick="del('${x}')">この日の記録を削除</button><p class="note">過去の日付も追加・修正・削除できます。</p></div></div>`}
function closeM(){document.querySelector('#modal').innerHTML=''}
function tog(x,k){let e=E(x);e[k]=!e[k];if(k==='med'&&e.med){e.rest=false;e.time=new Date().toISOString()}if(k==='rest'&&e.rest)e.med=false;set(x,e);autoRest();closeM();render()}
function del(x){delete s.e[x];save();closeM();render()}
function history(){let meds=Object.keys(s.e).filter(x=>E(x).med).sort(),groups=[],cur=null;for(const x of meds){if(!cur||I(A(P(cur.b),1))!==x){if(cur)groups.push(cur);cur={a:x,b:x}}else cur.b=x}if(cur)groups.push(cur);document.querySelector('#history').innerHTML=`<div class="card"><h3>サイクル履歴</h3><div class="list">${groups.length?groups.map((c,i)=>{let rs=Object.keys(s.e).filter(x=>E(x).rest&&x>=I(A(P(c.b),1))).sort();let r1=rs[0],r2=r1?rs[Math.min(+s.rest-1,rs.length-1)]:null;return `<div class="cycle"><b>第${i+1}サイクル</b><p>服薬：${F(c.a)}〜${F(c.b)}（${Math.floor((P(c.b)-P(c.a))/86400000)+1}日）</p><p>休薬：${r1?F(r1)+'〜'+F(r2):'—'}</p></div>`}).join(''):'<p class="note">服薬記録がまだありません。</p>'}</div></div>`}
function settings(){document.querySelector('#settings').innerHTML=`<div class="card"><h3>設定</h3><label>毎日の服薬通知時間</label><input id="nt" type="time" value="${s.notify}"><h4 style="margin:20px 0 4px">判定ルール</h4><label>連続服薬の上限日数</label><input id="mx" type="number" min="1" max="365" value="${s.max}"><label>休薬日数</label><input id="rs" type="number" min="1" max="14" value="${s.rest}"><div class="rulebox"><p><b>① 連続服薬の上限</b><br>${s.max}日連続で服薬した場合、翌日から${s.rest}日間を休薬とします。</p><p><b>② 3日連続の出血</b><br>出血が3日連続した場合は、${s.max}日の上限よりもこちらを優先し、3日目の翌日から${s.rest}日間を休薬とします。</p><p><b>③ 手動休薬</b><br>ホームの「休薬」を押すと、今日から${s.rest}日間を休薬として記録します。</p></div><button class="btn p" style="margin-top:16px;width:100%" onclick="saveSet()">設定を保存</button><p class="note">初期値：通知21:00／連続服薬120日／休薬4日。データは端末のLocalStorageに保存されます。</p></div><div class="card"><button class="btn gray" style="width:100%" onclick="if(confirm('全記録を削除しますか？')){s={max:120,rest:4,notify:'21:00',e:{}};save();render()}else{}">全記録を削除</button></div>`}
function saveSet(){s.notify=document.querySelector('#nt').value;s.max=+document.querySelector('#mx').value||120;s.rest=+document.querySelector('#rs').value||4;save();render();toast('設定を保存しました')}
function render(){autoRest();home();cal();history();settings()}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');['home','calendar','history','settings'].forEach(p=>document.querySelector('#'+p).classList.toggle('hide',p!==b.dataset.p))});
render();
