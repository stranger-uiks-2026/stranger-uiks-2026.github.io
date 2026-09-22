const $=id=>document.getElementById(id);
const map=L.map('map',{preferCanvas:true}).setView([55.75,37.62],9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
const layer=L.layerGroup().addTo(map);
const detailLayer=L.layerGroup().addTo(map);
const markerLayer=L.layerGroup().addTo(map);
let shownRows=[];
map.on('zoomend',()=>{renderMarkers(shownRows);if(requestedUik)renderDetail()});
let rows=[],pairs=[];
let regionRequest=0;
let selectedTiks=new Set(),requestedTiks=[];
let requestedUik=null;
let areaGroups={},requestedArea='';
const areas=()=>areaGroups[$('region').value]||[];
const defaults={metric:'er',distance:'2',threshold:'15',sameTik:true};
const regionSlugs=["altai-krai", "amur", "arkhangelsk", "astrakhan", "belgorod", "bryansk", "vladimir", "volgograd", "vologda", "voronezh", "eao", "zabaikalye", "ivanovo", "irkutsk", "kbr", "kaliningrad", "kaluga", "kamchatka", "kchr", "kuzbass", "kirov", "kostroma", "krasnodar", "krasnoyarsk", "kurgan", "kursk", "lenoblast", "lipetsk", "magadan", "mosoblast", "murmansk", "nao", "nizhny-novgorod", "novgorod", "novosibirsk", "omsk", "orenburg", "orel", "penza", "perm", "primorye", "pskov", "adygea", "altai-republic", "buryatia", "dagestan", "ingushetia", "kalmykia", "karelia", "komi", "krym", "mari-el", "mordovia", "yakutia", "osetia", "tatarstan", "tuva", "khakasia", "rostov", "ryazan", "samara", "saratov", "sakhalin", "sverdlovsk", "smolensk", "stavropol", "tambov", "tver", "tomsk", "tula", "tyumen", "udmurtia", "ulyanovsk", "khabarovsk", "khmao", "chelyabinsk", "chechnya", "chuvashia", "chukotka", "yanao", "yaroslavl", "msk", "spb", "sevastopol"];
function slugFor(item){return regionSlugs[Number(item.file.slice(0,2))-1]}
function regionFromCode(code){if(!code)return null;const value=code.trim().toLocaleLowerCase('ru');return window.index.find(x=>x.name.toLocaleLowerCase('ru')===value||x.file.slice(0,2)===value||x.file===value||slugFor(x)===value)}
function regionPath(item){return '/'+slugFor(item)+'/'}
function tikNames(region){return [...new Set((region===$('region').value?rows:[]).map(row=>row[1]))].sort((a,b)=>a.localeCompare(b,'ru'))}
function tikCode(name){const region=$('region').value;if(region==='83.json'){const match=name.match(/№(\d+)$/);if(match)return match[1]}if(region==='10.json'&&name.startsWith('Воронеж, ')){const codes={'Железнодорожная':'vrn-zhl','Коминтерновская':'vrn-kom','Левобережная':'vrn-lev','Ленинская':'vrn-len','Советская':'vrn-sov','Центральная':'vrn-ctr'};return codes[name.slice(9)]||name}return String(tikNames(region).indexOf(name)+1)}
function tikName(code){if(rows.some(row=>row[1]===code))return code;return tikNames($('region').value).find(name=>tikCode(name)===code)}
function readUrl(){
  const params=new URLSearchParams(location.search);
  const pathCode=location.pathname.split('/').filter(Boolean)[0];
  const region=regionFromCode(pathCode)||regionFromCode(params.get('region'))||regionFromCode('spb')||window.index[0];
  const metric=['er','turnout'].includes(params.get('metric'))?params.get('metric'):defaults.metric;
  const number=(name,min,max,step,fallback)=>{const value=Number(params.get(name));return params.has(name)&&Number.isFinite(value)&&value>=min&&value<=max&&Math.abs(value/step-Math.round(value/step))<1e-8?String(value):fallback};
  return {region:region.file,area:(areaGroups[region.file]||[]).some(x=>x.code===params.get('area'))?params.get('area'):'',metric,distance:number('distance',.2,10,.2,defaults.distance),threshold:number('threshold',0,50,1,defaults.threshold),sameTik:params.get('sameTik')==='0'?false:defaults.sameTik,tiks:params.getAll('tik'),uik:params.get('uik')};
}
function applyUrl(){const state=readUrl();$('region').value=state.region;requestedArea=state.area;$('metric').value=state.metric;$('distance').value=state.distance;$('threshold').value=state.threshold;$('sameTik').checked=state.sameTik;requestedTiks=state.tiks;requestedUik=state.uik}
function writeUrl(mode){const url=new URL(location.href),params=url.searchParams,item=window.index.find(x=>x.file===$('region').value);url.pathname=regionPath(item);params.delete('region');$('area').value?params.set('area',$('area').value):params.delete('area');params.set('metric',$('metric').value);params.set('distance',$('distance').value);params.set('threshold',$('threshold').value);params.set('sameTik',$('sameTik').checked?'1':'0');params.delete('tik');for(const tik of [...selectedTiks].sort())params.append('tik',tikCode(tik));requestedUik?params.set('uik',requestedUik):params.delete('uik');history[mode+'State'](null,'',url)}
function uikHref(row){const url=new URL(location.href);url.pathname=regionPath(window.regionInfo);url.searchParams.delete('region');url.searchParams.set('uik',row[7]);return url.pathname+url.search}
function openUik(uuid){requestedUik=uuid;writeUrl('push');renderMarkers(shownRows);renderDetail()}
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
  for(const neighbor of neighbors){const button=document.createElement('button');button.type='button';button.textContent=`№${neighbor.row[0]} · ${fmt(neighbor.d)} км · явка ${fmt(neighbor.row[4])}% · ЕР ${fmt(neighbor.row[5])}%`;button.onclick=()=>openUik(neighbor.row[7]);card.append(button);L.polyline([[row[2],row[3]],[neighbor.row[2],neighbor.row[3]]],{color:'#168b6c',weight:2,opacity:.55,dashArray:'5 5'}).addTo(detailLayer);}
  const close=document.createElement('button');close.type='button';close.textContent='Закрыть карточку';close.onclick=()=>{requestedUik=null;writeUrl('push');renderDetail();renderMarkers(shownRows);fitMapToRows()};card.append(close);
  renderPointGroups([row,...neighbors.map(x=>x.row)],detailLayer,row[7]);
  const nearby=[row,...neighbors.map(x=>x.row)];if(nearby.length>1)map.fitBounds(L.latLngBounds(nearby.map(x=>[x[2],x[3]])),{padding:[90,90],maxZoom:14});else map.setView([row[2],row[3]],13);
}
function areaRows(){const area=areas().find(x=>x.code===$('area').value);return area?rows.filter(row=>area.tiks.includes(row[1])):rows}
function renderArea(){const available=areas(),region=$('region').value;$('areaFilter').hidden=!available.length;if(!available.length){$('area').value='';return}$('areaFilter').firstChild.textContent=region==='82.json'?'Округ Москвы':region==='83.json'?'Район Петербурга':region==='10.json'?'Район Воронежа':'Город / район';$('area').replaceChildren(new Option(region==='82.json'?'Все округа':'Все районы',''),...available.map(x=>new Option(x.name,x.code)));$('area').value=available.some(x=>x.code===requestedArea)?requestedArea:'';requestedArea=$('area').value}
function renderTiks(){
  const counts=new Map();for(const row of areaRows())counts.set(row[1],(counts.get(row[1])||0)+1);
  const search=$('tikSearch').value.trim().toLocaleLowerCase('ru');$('tikList').replaceChildren(...[...counts].sort((a,b)=>a[0].localeCompare(b[0],'ru')).filter(([name])=>name.toLocaleLowerCase('ru').includes(search)).map(([name,count])=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=selectedTiks.has(name);input.dataset.tik=name;span.textContent=`${name} (${count})`;label.append(input,span);return label}));
  $('tikSummary').textContent=selectedTiks.size===1?`ТИК: ${[...selectedTiks][0]}`:selectedTiks.size?`ТИК: выбрано ${selectedTiks.size}`:'ТИК: все';
}
function restoreTiks(){const available=new Set(areaRows().map(row=>row[1]));selectedTiks=new Set(requestedTiks.map(tikName).filter(name=>available.has(name)));renderTiks()}
function fitMapToRows(){const filtered=areaRows(),visible=selectedTiks.size?filtered.filter(row=>selectedTiks.has(row[1])):filtered;if(visible.length===1){map.setView([visible[0][2],visible[0][3]],12);return}if(visible.length){const lat=visible.map(r=>r[2]).sort((a,b)=>a-b),lon=visible.map(r=>r[3]).sort((a,b)=>a-b),lo=Math.floor(visible.length*.01),hi=Math.ceil(visible.length*.99)-1;map.fitBounds([[lat[lo],lon[lo]],[lat[hi],lon[hi]]],{padding:[35,35]})}}
const km=(a,b)=>{const r=Math.PI/180, x=(b[2]-a[2])*r,y=(b[3]-a[3])*r;const h=Math.sin(x/2)**2+Math.cos(a[2]*r)*Math.cos(b[2]*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});
function pointGroups(items){
  const groups=[],cells=new Map(),size=46;
  for(const row of items){const pt=map.latLngToLayerPoint([row[2],row[3]]),cx=Math.floor(pt.x/size),cy=Math.floor(pt.y/size);let group;
    for(let dx=-1;dx<=1&&!group;dx++)for(let dy=-1;dy<=1&&!group;dy++)for(const candidate of cells.get(`${cx+dx},${cy+dy}`)||[]){if(Math.hypot(candidate.x-pt.x,candidate.y-pt.y)<size){group=candidate;break}}
    if(group)group.rows.push(row);else{group={x:pt.x,y:pt.y,rows:[row],lat:row[2],lon:row[3]};groups.push(group);const key=`${cx},${cy}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(group)}
  }
  return groups;
}
function metricIndex(){return $('metric').value==='er'?5:4}
function metricName(){return $('metric').value==='er'?'ЕР по списку':'Явка'}
const cividis=['#00204D','#404D6B','#7C7B78','#BCAF6F','#FFEA46'];
function metricColor(value){const n=Math.max(0,Math.min(100,Number(value)||0));return cividis[Math.min(4,Math.floor(n/20))]}
function groupPopup(group){
  const items=group.rows.slice().sort((a,b)=>Number(a[0])-Number(b[0])),m=metricIndex();
  const values=items.map(r=>Number(r[m]));
  const avg=values.reduce((a,b)=>a+b,0)/values.length;
  const header=items.length===1?`УИК #${items[0][0]}`:`${items.length} УИК рядом`;
  return `<b>${header}</b><br>${metricName()}: ${items.length===1?fmt(values[0]):`в среднем ${fmt(avg)}`}%${items.length>1?` · от ${fmt(Math.min(...values))} до ${fmt(Math.max(...values))}%`:''}<div class="cluster-list">${items.map(r=>`<div><a href="${uikHref(r)}" data-uik="${r[7]}">УИК #${r[0]}</a><br>явка ${fmt(r[4])}% · ЕР ${fmt(r[5])}%</div>`).join('')}</div>`
}
function markerIcon(group,selected){
  const metric=metricIndex(),items=group.rows.slice().sort((a,b)=>a[metric]-b[metric]),expanded=map.getZoom()>=14;
  if(items.length===1){
    const value=fmt(items[0][metric]),color=metricColor(items[0][metric]);
    if(expanded)return L.divIcon({className:'uik-value-marker'+(selected?' is-selected':''),html:`<span class="value-pill" style="--value-color:${color}">${value}%</span>`,iconSize:[56,30],iconAnchor:[28,15]});
    return L.divIcon({className:'uik-point'+(selected?' is-selected':''),html:`<span style="background:${color}"></span>`,iconSize:[selected?24:20,selected?24:20],iconAnchor:[selected?12:10,selected?12:10]});
  }
  const step=360/items.length,gap=Math.min(1.5,step*.08);
  const sectors=items.map((row,i)=>`${metricColor(row[metric])} ${(i*step).toFixed(3)}deg ${((i+1)*step-gap).toFixed(3)}deg,#17252b ${((i+1)*step-gap).toFixed(3)}deg ${((i+1)*step).toFixed(3)}deg`).join(',');
  const values=items.map(r=>Number(r[metric])),range=`${Math.round(Math.min(...values))}–${Math.round(Math.max(...values))}%`;
  return L.divIcon({className:'cluster-pie'+(selected?' is-selected':''),html:`<span class="pie-disc" style="background:conic-gradient(${sectors})"><b>${items.length}</b></span>${expanded?`<span class="cluster-range">${range}</span>`:''}`,iconSize:[44,44],iconAnchor:[22,22]});
}
function renderPointGroups(items,target,selected){
  for(const group of pointGroups(items)){
    const isSelected=group.rows.some(r=>r[7]===selected),values=group.rows.map(r=>Number(r[metricIndex()]));
    const title=group.rows.length===1?`УИК #${group.rows[0][0]}: ${metricName()} ${fmt(values[0])}%`:`${group.rows.length} УИК: ${metricName()} от ${fmt(Math.min(...values))} до ${fmt(Math.max(...values))}%`;
    L.marker([group.lat,group.lon],{icon:markerIcon(group,isSelected),keyboard:true,title}).bindPopup(groupPopup(group),{maxHeight:300,minWidth:180}).addTo(target);
  }
}
function renderMarkers(items){markerLayer.clearLayers();if(!requestedUik)renderPointGroups(items,markerLayer)}
function calculate(){
  const maxDist=+$('distance').value, threshold=+$('threshold').value, metric=metricIndex(), same=$('sameTik').checked;
  $('metricLegendLabel').textContent=metricName();
  $('distanceLabel').textContent=fmt(maxDist)+' км';$('thresholdLabel').textContent=threshold+' п.п.';
  const cells=new Map(),size=.08;
  const filtered=areaRows(),activeRows=selectedTiks.size?filtered.filter(row=>selectedTiks.has(row[1])):filtered;
  activeRows.forEach((r,i)=>{const key=`${Math.floor(r[2]/size)},${Math.floor(r[3]/size)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i)});
  const found=new Map();
  activeRows.forEach((a,i)=>{const ci=Math.floor(a[2]/size),cj=Math.floor(a[3]/size),near=[];
    const latCells=Math.ceil(maxDist/111/size)+1,lonCells=Math.ceil(maxDist/(111*Math.max(.15,Math.cos(a[2]*Math.PI/180)))/size)+1;
    for(let di=-latCells;di<=latCells;di++)for(let dj=-lonCells;dj<=lonCells;dj++)for(const j of cells.get(`${ci+di},${cj+dj}`)||[]){if(i===j)continue;const b=activeRows[j];if(same&&a[1]!==b[1])continue;const d=km(a,b);if(d<=maxDist)near.push([j,d])}
    near.sort((x,y)=>x[1]-y[1]);for(const [j,d] of near.slice(0,3)){const b=activeRows[j],diff=Math.abs(a[metric]-b[metric]);if(diff<threshold)continue;const key=[i,j].sort((x,y)=>x-y).join('-');found.set(key,{a,b,d,diff})}
  });
  pairs=[...found.values()].sort((x,y)=>y.diff-x.diff);layer.clearLayers();
  for(const p of pairs){const color=p.diff>=30?'#bc273c':p.diff>=20?'#e66d36':'#e4ad39';L.polyline([[p.a[2],p.a[3]],[p.b[2],p.b[3]]],{color,weight:Math.min(5,1.5+p.diff/15),opacity:.75}).bindPopup(popup(p,metric)).addTo(layer)}
  const shown=new Map();for(const p of pairs)for(const r of [p.a,p.b])shown.set(r[7],r);shownRows=[...shown.values()];renderMarkers(shownRows);
  $('stats').innerHTML=`<strong>${fmt(pairs.length)} пар</strong> выше порога<br>${fmt(shown.size)} УИК на карте · ${fmt(activeRows.length)} в выборке · ${fmt(rows.length)} с координатами из ${fmt(window.regionInfo.total)} протоколов региона`;
  $('pairs').replaceChildren(...pairs.slice(0,30).map(p=>{const card=document.createElement('div');card.className='pair-card';const a=document.createElement('a'),b=document.createElement('a'),diff=document.createElement('strong'),small=document.createElement('small');a.href=uikHref(p.a);a.dataset.uik=p.a[7];a.textContent=`УИК №${p.a[0]}`;b.href=uikHref(p.b);b.dataset.uik=p.b[7];b.textContent=`УИК №${p.b[0]}`;diff.textContent=`${fmt(p.diff)} п.п.`;small.textContent=`${fmt(p.d)} км · ${p.a[1]}`;card.append(a,' ↔ ',b,' ',diff,small);return card}));
}
function popup(p,m){const name=m===5?'ЕР по списку':'Явка';return `<b>${name}: разница ${fmt(p.diff)} п.п.</b><br><a href="${uikHref(p.a)}" data-uik="${p.a[7]}">УИК №${p.a[0]}</a> — ${fmt(p.a[m])}%<br><a href="${uikHref(p.b)}" data-uik="${p.b[7]}">УИК №${p.b[0]}</a> — ${fmt(p.b[m])}%<br>Расстояние ${fmt(p.d)} км`}
async function choose(){const item=window.index.find(x=>x.file===$('region').value),request=++regionRequest;window.regionInfo=item;$('stats').textContent='Загрузка региона…';const nextRows=await(await fetch('/'+item.file)).json();if(request!==regionRequest)return;rows=nextRows;renderArea();restoreTiks();fitMapToRows();calculate();renderDetail()}
async function init(){try{[window.index,areaGroups]=await Promise.all([fetch('/index.json').then(r=>r.json()),fetch('/area-groups.json').then(r=>r.json())]);$('region').innerHTML=window.index.map(x=>`<option value="${x.file}">${x.name} (${x.mapped.toLocaleString('ru-RU')})</option>`).join('');applyUrl();await choose();writeUrl('replace')}catch(e){$('stats').textContent='Не удалось загрузить данные. Откройте сайт через локальный сервер или GitHub Pages.';console.error(e)}}
for(const id of ['metric','sameTik'])$(id).addEventListener('change',()=>{writeUrl('push');if(rows.length){calculate();renderDetail()}});
for(const id of ['distance','threshold'])$(id).addEventListener('input',()=>{writeUrl('replace');if(rows.length)calculate()});
$('region').addEventListener('change',()=>{selectedTiks.clear();requestedTiks=[];requestedUik=null;requestedArea='';$('area').value='';writeUrl('push');choose()});
$('area').addEventListener('change',()=>{requestedArea=$('area').value;selectedTiks.clear();requestedTiks=[];requestedUik=null;renderTiks();writeUrl('push');fitMapToRows();calculate();renderDetail()});
$('tikSearch').addEventListener('input',renderTiks);
$('tikList').addEventListener('change',event=>{const name=event.target.dataset.tik;if(!name)return;event.target.checked?selectedTiks.add(name):selectedTiks.delete(name);requestedTiks=[...selectedTiks];renderTiks();writeUrl('push');fitMapToRows();calculate()});
$('tikClear').addEventListener('click',()=>{selectedTiks.clear();requestedTiks=[];renderTiks();writeUrl('push');fitMapToRows();calculate()});
addEventListener('popstate',()=>{const previous=window.regionInfo?.file;applyUrl();if(previous!==$('region').value)choose();else if(rows.length){renderArea();restoreTiks();fitMapToRows();calculate();renderDetail()}});
document.addEventListener('click',event=>{const link=event.target.closest('a[data-uik]');if(!link)return;event.preventDefault();openUik(link.dataset.uik)});
init();
