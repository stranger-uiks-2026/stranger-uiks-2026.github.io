const $=id=>document.getElementById(id);
const map=L.map('map',{preferCanvas:true}).setView([55.75,37.62],9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
const updateLabelVisibility=()=>map.getContainer().classList.toggle('show-uik-values',map.getZoom()>=13);
map.on('zoomend',updateLabelVisibility);updateLabelVisibility();
const layer=L.layerGroup().addTo(map);
const detailLayer=L.layerGroup().addTo(map);
let rows=[],pairs=[];
let regionRequest=0;
let selectedTiks=new Set(),requestedTiks=[];
let requestedUik=null;
const defaults={metric:'er',distance:'2',threshold:'15',sameTik:true};
const regionAliases={'spb':'83.json','msk':'82.json'};
function regionFromCode(code){if(!code)return null;const value=code.trim().toLocaleLowerCase('ru');return window.index.find(x=>x.name.toLocaleLowerCase('ru')===value||x.file.slice(0,2)===value||x.file===value||regionAliases[value]===x.file)}
function regionPath(item){return item.file==='83.json'?'/spb/':'/'}
function uikLabel(row){return `#${row[0]}<br>явка ${fmt(row[4])}%<br>ЕР ${fmt(row[5])}%`}
function readUrl(){
  const params=new URLSearchParams(location.search);
  const pathCode=location.pathname.split('/').filter(Boolean)[0];
  const region=regionFromCode(pathCode)||regionFromCode(params.get('region'))||regionFromCode('spb')||window.index[0];
  const metric=['er','turnout'].includes(params.get('metric'))?params.get('metric'):defaults.metric;
  const number=(name,min,max,step,fallback)=>{const value=Number(params.get(name));return params.has(name)&&Number.isFinite(value)&&value>=min&&value<=max&&Math.abs(value/step-Math.round(value/step))<1e-8?String(value):fallback};
  return {region:region.file,metric,distance:number('distance',.2,10,.2,defaults.distance),threshold:number('threshold',0,50,1,defaults.threshold),sameTik:params.get('sameTik')==='0'?false:defaults.sameTik,tiks:params.getAll('tik'),uik:params.get('uik')};
}
function applyUrl(){const state=readUrl();$('region').value=state.region;$('metric').value=state.metric;$('distance').value=state.distance;$('threshold').value=state.threshold;$('sameTik').checked=state.sameTik;requestedTiks=state.tiks;requestedUik=state.uik}
function writeUrl(mode){const url=new URL(location.href),params=url.searchParams,item=window.index.find(x=>x.file===$('region').value);url.pathname=regionPath(item);params.delete('region');if(url.pathname==='/')params.set('region',item.file.slice(0,2));params.set('metric',$('metric').value);params.set('distance',$('distance').value);params.set('threshold',$('threshold').value);params.set('sameTik',$('sameTik').checked?'1':'0');params.delete('tik');for(const tik of [...selectedTiks].sort())params.append('tik',tik);requestedUik?params.set('uik',requestedUik):params.delete('uik');history[mode+'State'](null,'',url)}
function uikHref(row){const url=new URL(location.href);url.pathname=regionPath(window.regionInfo);url.searchParams.delete('region');if(url.pathname==='/')url.searchParams.set('region',window.regionInfo.file.slice(0,2));url.searchParams.set('uik',row[7]);return url.pathname+url.search}
function openUik(uuid){requestedUik=uuid;writeUrl('push');renderDetail()}
function renderDetail(){
  const card=$('uikDetail'),row=rows.find(item=>item[7]===requestedUik);detailLayer.clearLayers();card.replaceChildren();card.hidden=!requestedUik;if(!requestedUik)return;
  if(!row){card.textContent='УИК с таким идентификатором не найден в выбранном регионе.';return}
  const heading=document.createElement('h2');heading.textContent=`УИК №${row[0]}`;card.append(heading);
  const info=document.createElement('p');info.textContent=`${row[1]} · ${window.regionInfo.name}`;card.append(info);
  const values=document.createElement('p');values.textContent=`Явка ${fmt(row[4])}% · ЕР по списку ${fmt(row[5])}% · избирателей ${fmt(row[6])}`;card.append(values);
  const point=document.createElement('p');point.textContent=`Координаты помещения: ${row[2]}, ${row[3]} (набор 2021 года)`;card.append(point);
  const link=document.createElement('a');link.href=uikHref(row);link.textContent='Постоянная ссылка на УИК';card.append(link);
  const title=document.createElement('h3');title.textContent='Ближайшие УИК той же ТИК';card.append(title);
  const neighbors=rows.filter(other=>other[7]!==row[7]&&other[1]===row[1]).map(other=>({row:other,d:km(row,other)})).sort((a,b)=>a.d-b.d).slice(0,5);
  for(const neighbor of neighbors){const button=document.createElement('button');button.type='button';button.textContent=`№${neighbor.row[0]} · ${fmt(neighbor.d)} км · явка ${fmt(neighbor.row[4])}% · ЕР ${fmt(neighbor.row[5])}%`;button.onclick=()=>openUik(neighbor.row[7]);card.append(button);L.polyline([[row[2],row[3]],[neighbor.row[2],neighbor.row[3]]],{color:'#168b6c',weight:2,opacity:.55,dashArray:'5 5'}).addTo(detailLayer);L.circleMarker([neighbor.row[2],neighbor.row[3]],{radius:7,color:'#168b6c',weight:2,fillColor:'#fff',fillOpacity:1}).bindTooltip(uikLabel(neighbor.row),{permanent:true,direction:'top',className:'selected-uik-tooltip'}).on('click',()=>openUik(neighbor.row[7])).addTo(detailLayer)}
  const close=document.createElement('button');close.type='button';close.textContent='Закрыть карточку';close.onclick=()=>{requestedUik=null;writeUrl('push');renderDetail();fitMapToRows()};card.append(close);
  L.circleMarker([row[2],row[3]],{radius:10,color:'#087354',weight:3,fillColor:'#fff',fillOpacity:1}).bindTooltip(uikLabel(row),{permanent:true,direction:'top',className:'selected-uik-tooltip'}).addTo(detailLayer);
  const nearby=[row,...neighbors.map(x=>x.row)];if(nearby.length>1)map.fitBounds(L.latLngBounds(nearby.map(x=>[x[2],x[3]])),{padding:[90,90],maxZoom:14});else map.setView([row[2],row[3]],13);
}
function renderTiks(){
  const counts=new Map();for(const row of rows)counts.set(row[1],(counts.get(row[1])||0)+1);
  const search=$('tikSearch').value.trim().toLocaleLowerCase('ru');$('tikList').replaceChildren(...[...counts].sort((a,b)=>a[0].localeCompare(b[0],'ru')).filter(([name])=>name.toLocaleLowerCase('ru').includes(search)).map(([name,count])=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=selectedTiks.has(name);input.dataset.tik=name;span.textContent=`${name} (${count})`;label.append(input,span);return label}));
  $('tikSummary').textContent=selectedTiks.size===1?`ТИК: ${[...selectedTiks][0]}`:selectedTiks.size?`ТИК: выбрано ${selectedTiks.size}`:'ТИК: все';
}
function restoreTiks(){const available=new Set(rows.map(row=>row[1]));selectedTiks=new Set(requestedTiks.filter(name=>available.has(name)));renderTiks()}
function fitMapToRows(){const visible=selectedTiks.size?rows.filter(row=>selectedTiks.has(row[1])):rows;if(visible.length===1){map.setView([visible[0][2],visible[0][3]],12);return}if(visible.length){const lat=visible.map(r=>r[2]).sort((a,b)=>a-b),lon=visible.map(r=>r[3]).sort((a,b)=>a-b),lo=Math.floor(visible.length*.01),hi=Math.ceil(visible.length*.99)-1;map.fitBounds([[lat[lo],lon[lo]],[lat[hi],lon[hi]]],{padding:[35,35]})}}
const km=(a,b)=>{const r=Math.PI/180, x=(b[2]-a[2])*r,y=(b[3]-a[3])*r;const h=Math.sin(x/2)**2+Math.cos(a[2]*r)*Math.cos(b[2]*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});
function calculate(){
  const maxDist=+$('distance').value, threshold=+$('threshold').value, metric=$('metric').value==='er'?5:4, same=$('sameTik').checked;
  $('distanceLabel').textContent=fmt(maxDist)+' км';$('thresholdLabel').textContent=threshold+' п.п.';
  const cells=new Map(),size=.08;
  const activeRows=selectedTiks.size?rows.filter(row=>selectedTiks.has(row[1])):rows;
  activeRows.forEach((r,i)=>{const key=`${Math.floor(r[2]/size)},${Math.floor(r[3]/size)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i)});
  const found=new Map();
  activeRows.forEach((a,i)=>{const ci=Math.floor(a[2]/size),cj=Math.floor(a[3]/size),near=[];
    const latCells=Math.ceil(maxDist/111/size)+1,lonCells=Math.ceil(maxDist/(111*Math.max(.15,Math.cos(a[2]*Math.PI/180)))/size)+1;
    for(let di=-latCells;di<=latCells;di++)for(let dj=-lonCells;dj<=lonCells;dj++)for(const j of cells.get(`${ci+di},${cj+dj}`)||[]){if(i===j)continue;const b=activeRows[j];if(same&&a[1]!==b[1])continue;const d=km(a,b);if(d<=maxDist)near.push([j,d])}
    near.sort((x,y)=>x[1]-y[1]);for(const [j,d] of near.slice(0,3)){const b=activeRows[j],diff=Math.abs(a[metric]-b[metric]);if(diff<threshold)continue;const key=[i,j].sort((x,y)=>x-y).join('-');found.set(key,{a,b,d,diff})}
  });
  pairs=[...found.values()].sort((x,y)=>y.diff-x.diff);layer.clearLayers();
  for(const p of pairs){const color=p.diff>=30?'#bc273c':p.diff>=20?'#e66d36':'#e4ad39';L.polyline([[p.a[2],p.a[3]],[p.b[2],p.b[3]]],{color,weight:Math.min(5,1.5+p.diff/15),opacity:.75}).bindPopup(popup(p,metric)).addTo(layer)}
  const shown=new Set();for(const p of pairs){for(const r of [p.a,p.b]){const k=r[7];if(shown.has(k))continue;shown.add(k);L.circleMarker([r[2],r[3]],{radius:4,color:'#243a43',weight:1,fillColor:'#fff',fillOpacity:1}).bindTooltip(uikLabel(r),{permanent:true,direction:'top',className:'uik-tooltip'}).bindPopup(`УИК №${r[0]} · ${r[1]}<br>Явка ${fmt(r[4])}% · ЕР ${fmt(r[5])}%<br><a href="${uikHref(r)}" data-uik="${r[7]}">Открыть УИК</a>`).addTo(layer)}}
  $('stats').innerHTML=`<strong>${fmt(pairs.length)} пар</strong> выше порога<br>${fmt(shown.size)} УИК на карте · ${fmt(activeRows.length)} в выбранных ТИК · ${fmt(rows.length)} с координатами из ${fmt(window.regionInfo.total)} протоколов региона`;
  $('pairs').replaceChildren(...pairs.slice(0,30).map(p=>{const card=document.createElement('div');card.className='pair-card';const a=document.createElement('a'),b=document.createElement('a'),diff=document.createElement('strong'),small=document.createElement('small');a.href=uikHref(p.a);a.dataset.uik=p.a[7];a.textContent=`УИК №${p.a[0]}`;b.href=uikHref(p.b);b.dataset.uik=p.b[7];b.textContent=`УИК №${p.b[0]}`;diff.textContent=`${fmt(p.diff)} п.п.`;small.textContent=`${fmt(p.d)} км · ${p.a[1]}`;card.append(a,' ↔ ',b,' ',diff,small);return card}));
}
function popup(p,m){const name=m===5?'ЕР по списку':'Явка';return `<b>${name}: разница ${fmt(p.diff)} п.п.</b><br><a href="${uikHref(p.a)}" data-uik="${p.a[7]}">УИК №${p.a[0]}</a> — ${fmt(p.a[m])}%<br><a href="${uikHref(p.b)}" data-uik="${p.b[7]}">УИК №${p.b[0]}</a> — ${fmt(p.b[m])}%<br>Расстояние ${fmt(p.d)} км`}
async function choose(){const item=window.index.find(x=>x.file===$('region').value),request=++regionRequest;window.regionInfo=item;$('stats').textContent='Загрузка региона…';const nextRows=await(await fetch('/'+item.file)).json();if(request!==regionRequest)return;rows=nextRows;restoreTiks();fitMapToRows();calculate();renderDetail()}
async function init(){try{window.index=await(await fetch('/index.json')).json();$('region').innerHTML=window.index.map(x=>`<option value="${x.file}">${x.name} (${x.mapped.toLocaleString('ru-RU')})</option>`).join('');applyUrl();await choose();writeUrl('replace')}catch(e){$('stats').textContent='Не удалось загрузить данные. Откройте сайт через локальный сервер или GitHub Pages.';console.error(e)}}
for(const id of ['metric','sameTik'])$(id).addEventListener('change',()=>{writeUrl('push');if(rows.length)calculate()});
for(const id of ['distance','threshold'])$(id).addEventListener('input',()=>{writeUrl('replace');if(rows.length)calculate()});
$('region').addEventListener('change',()=>{selectedTiks.clear();requestedTiks=[];requestedUik=null;writeUrl('push');choose()});
$('tikSearch').addEventListener('input',renderTiks);
$('tikList').addEventListener('change',event=>{const name=event.target.dataset.tik;if(!name)return;event.target.checked?selectedTiks.add(name):selectedTiks.delete(name);requestedTiks=[...selectedTiks];renderTiks();writeUrl('push');fitMapToRows();calculate()});
$('tikClear').addEventListener('click',()=>{selectedTiks.clear();requestedTiks=[];renderTiks();writeUrl('push');fitMapToRows();calculate()});
addEventListener('popstate',()=>{const previous=window.regionInfo?.file;applyUrl();if(previous!==$('region').value)choose();else if(rows.length){restoreTiks();fitMapToRows();calculate();renderDetail()}});
document.addEventListener('click',event=>{const link=event.target.closest('a[data-uik]');if(!link)return;event.preventDefault();openUik(link.dataset.uik)});
init();
