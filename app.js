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
const defaults={metric:'er',distance:'2',threshold:'15',sameTik:true,minPct:'0',maxPct:'100'};
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
  const region=regionFromCode(pathCode)||regionFromCode(params.get('region'))||window.index[Math.floor(Math.random()*window.index.length)];
  const metric=['er','turnout','pick'].includes(params.get('metric'))?params.get('metric'):defaults.metric;
  const number=(name,min,max,step,fallback)=>{const value=Number(params.get(name));return params.has(name)&&Number.isFinite(value)&&value>=min&&value<=max&&Math.abs(value/step-Math.round(value/step))<1e-8?String(value):fallback};
  const minPct=number('minPct',0,100,1,defaults.minPct),maxPct=number('maxPct',0,100,1,defaults.maxPct);
  return {region:region.file,area:(areaGroups[region.file]||[]).some(x=>x.code===params.get('area'))?params.get('area'):'',metric,view:params.get('view')==='all'?'all':'pairs',distance:number('distance',.2,10,.2,defaults.distance),threshold:number('threshold',0,50,1,defaults.threshold),minPct,maxPct:String(Math.max(+minPct,+maxPct)),sameTik:params.get('sameTik')==='0'?false:defaults.sameTik,tiks:params.getAll('tik'),uik:params.get('uik')};
}
function applyUrl(){const state=readUrl();$('region').value=state.region;requestedArea=state.area;$('metric').value=state.metric;$('view').value=state.view;$('distance').value=state.distance;$('threshold').value=state.threshold;$('minPct').value=state.minPct;$('maxPct').value=state.maxPct;$('sameTik').checked=state.sameTik;requestedTiks=state.tiks;requestedUik=state.uik}
function writeUrl(mode){const url=new URL(location.href),params=url.searchParams,item=window.index.find(x=>x.file===$('region').value);url.pathname=regionPath(item);params.delete('region');$('area').value?params.set('area',$('area').value):params.delete('area');params.set('metric',$('metric').value);$('view').value==='all'?params.set('view','all'):params.delete('view');params.set('distance',$('distance').value);params.set('threshold',$('threshold').value);$('minPct').value==='0'?params.delete('minPct'):params.set('minPct',$('minPct').value);$('maxPct').value==='100'?params.delete('maxPct'):params.set('maxPct',$('maxPct').value);params.set('sameTik',$('sameTik').checked?'1':'0');params.delete('tik');for(const tik of [...selectedTiks].sort())params.append('tik',tikCode(tik));requestedUik?params.set('uik',requestedUik):params.delete('uik');history[mode+'State'](null,'',url)}
function uikHref(row){const url=new URL(location.href);url.pathname=regionPath(window.regionInfo);url.searchParams.delete('region');url.searchParams.set('uik',row[7]);return url.pathname+url.search}
function openUik(uuid){requestedUik=uuid;writeUrl('push');renderMarkers(shownRows);renderDetail()}
function closeUik(){requestedUik=null;writeUrl('push');renderDetail();renderMarkers(shownRows);fitMapToRows()}
function candidateText(row){return row[8]==null?'Кандидат IditeNa: данных нет':`Кандидат IditeNa: ${row[10]} · ${fmt(row[8])}% (${fmt(row[9])} голосов)`}
function renderDetail(){
  const card=$('uikDetail'),row=rows.find(item=>item[7]===requestedUik);detailLayer.clearLayers();card.replaceChildren();card.hidden=!requestedUik;if(!requestedUik)return;
  if(!row){card.textContent='УИК с таким идентификатором не найден в выбранном регионе.';return}
  const closeIcon=document.createElement('button');closeIcon.type='button';closeIcon.className='uik-detail-close';closeIcon.setAttribute('aria-label','Закрыть карточку УИК');closeIcon.textContent='×';closeIcon.onclick=closeUik;card.append(closeIcon);
  const heading=document.createElement('h2');heading.textContent=`УИК №${row[0]}`;card.append(heading);
  const info=document.createElement('p');info.textContent=`${row[1]} · ${window.regionInfo.name}`;card.append(info);
  const values=document.createElement('p');values.textContent=`Явка ${fmt(row[4])}% · ЕР по списку ${fmt(row[5])}% · избирателей ${fmt(row[6])}`;card.append(values);
  if(metricIndex()===8){const candidate=document.createElement('p');candidate.textContent=candidateText(row);card.append(candidate);
    if(row[11]){const district=document.createElement('a');district.href=`https://iditena.org/districts/${encodeURIComponent(row[11])}/`;district.textContent=`Округ #${row[11]} на IditeNa`;district.target='_blank';district.rel='noopener noreferrer';card.append(district)}}
  const point=document.createElement('p');point.textContent=`Координаты помещения: ${row[2]}, ${row[3]} (набор 2021 года)`;card.append(point);
  const link=document.createElement('a');link.href=uikHref(row);link.textContent='Постоянная ссылка на УИК';card.append(link);
  const title=document.createElement('h3');title.textContent='Ближайшие УИК той же ТИК';card.append(title);
  const neighbors=rows.filter(other=>other[7]!==row[7]&&other[1]===row[1]).map(other=>({row:other,d:km(row,other)})).sort((a,b)=>a.d-b.d).slice(0,5);
  for(const neighbor of neighbors){const button=document.createElement('button');button.type='button';button.textContent=`#${neighbor.row[0]} · ${fmt(neighbor.d)} км · явка ${fmt(neighbor.row[4])}% · ЕР ${fmt(neighbor.row[5])}%${metricIndex()===8?` · ${candidateText(neighbor.row)}`:''}`;button.onclick=()=>openUik(neighbor.row[7]);card.append(button);L.polyline([[row[2],row[3]],[neighbor.row[2],neighbor.row[3]]],{color:'#168b6c',weight:2,opacity:.55,dashArray:'5 5'}).addTo(detailLayer);}
  const close=document.createElement('button');close.type='button';close.textContent='Закрыть карточку';close.onclick=closeUik;card.append(close);
  renderPointGroups([row,...neighbors.map(x=>x.row)].filter(item=>$('view').value==='all'||hasMetric(item)),detailLayer,row[7]);
  const nearby=[row,...neighbors.map(x=>x.row)];if(nearby.length>1)map.fitBounds(L.latLngBounds(nearby.map(x=>[x[2],x[3]])),{padding:[90,90],maxZoom:14});else map.setView([row[2],row[3]],13);
}
function areaRows(){const area=areas().find(x=>x.code===$('area').value);return area?rows.filter(row=>area.tiks.includes(row[1])):rows}
function renderArea(){const available=areas(),region=$('region').value;$('areaFilter').hidden=!available.length;if(!available.length){$('area').value='';return}$('areaFilter').firstChild.textContent=region==='82.json'?'Округ Москвы':region==='83.json'?'Район Петербурга':region==='10.json'?'Район Воронежа':'Город / район';$('area').replaceChildren(new Option(region==='82.json'?'Все округа':'Все районы',''),...available.map(x=>new Option(x.name,x.code)));$('area').value=available.some(x=>x.code===requestedArea)?requestedArea:'';requestedArea=$('area').value}
function renderTiks(){
  const counts=new Map();for(const row of areaRows())counts.set(row[1],(counts.get(row[1])||0)+1);
  const search=$('tikSearch').value.trim().toLocaleLowerCase('ru');$('tikList').replaceChildren(...[...counts].sort((a,b)=>a[0].localeCompare(b[0],'ru')).filter(([name])=>name.toLocaleLowerCase('ru').includes(search)).map(([name,count])=>{const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=selectedTiks.has(name);input.dataset.tik=name;span.textContent=`${name} (${count})`;label.append(input,span);return label}));
  $('tikSummary').textContent=selectedTiks.size===1?`ТИК: ${[...selectedTiks][0]}`:selectedTiks.size?`ТИК: выбрано ${selectedTiks.size}`:'ТИК: все';
}
function searchUiks(){const query=$('uikSearch').value.trim().replace(/^#|^№/,'').trim(),results=$('uikSearchResults');results.replaceChildren();if(!query)return;const matches=rows.filter(row=>String(row[0]).startsWith(query)).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ru',{numeric:true})).slice(0,12);if(!matches.length){results.textContent='УИК не найден в выбранном регионе';return}for(const row of matches){const button=document.createElement('button');button.type='button';button.textContent=`УИК #${row[0]} · ${row[1]}`;button.onclick=()=>{openUik(row[7]);results.replaceChildren()};results.append(button)}}
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
function metricIndex(){return $('metric').value==='er'?5:$('metric').value==='pick'?8:4}
function metricName(){return $('metric').value==='er'?'ЕР по списку':$('metric').value==='pick'?'Кандидат IditeNa':'Явка'}
function hasMetric(row){return metricIndex()!==8||row[8]!=null}
function updatePercentRange(){const min=+$('minPct').value,max=+$('maxPct').value;$('minPctLabel').textContent=min+'%';$('maxPctLabel').textContent=max+'%';$('percentRange').style.setProperty('--min-pct',min+'%');$('percentRange').style.setProperty('--max-pct',max+'%');$('minPct').classList.toggle('is-active',min===max)}
function renderDistribution(selectedRows){
  const metric=metricIndex(),min=+$('minPct').value,max=+$('maxPct').value,bins=Array(20).fill(0);
  let below=0,inside=0,above=0,missing=0;
  for(const row of selectedRows){if(!hasMetric(row)){missing++;continue}const value=Number(row[metric]);bins[Math.min(19,Math.floor(value/5))]++;if(value<min)below++;else if(value>max)above++;else inside++}
  const peak=Math.max(1,...bins),chart=$('distribution');chart.replaceChildren();
  bins.forEach((count,i)=>{const bar=document.createElement('span');const start=i*5,end=i===19?100:start+5;bar.className='distribution-bar'+(end<=min||start>max?' is-outside':'');bar.style.height=(count?Math.max(3,Math.round(44*count/peak)):0)+'px';bar.title=`${start}–${end}%: ${fmt(count)} УИК`;chart.append(bar)});
  const outside=below+above;$('distributionSummary').textContent=`В диапазоне ${fmt(inside)} · вне ${fmt(outside)} (ниже ${fmt(below)}, выше ${fmt(above)})${missing?` · без данных ${fmt(missing)}`:''}`;
  chart.setAttribute('aria-label',`Распределение ${metricName()}. ${$('distributionSummary').textContent}`);
}
const metricPalette=['#FFEA46','#BCAF6F','#7C7B78','#C8793A','#D71932'];
function metricColor(value){const n=Math.max(0,Math.min(100,Number(value)||0));return metricPalette[Math.min(4,Math.floor(n/20))]}
function groupPopup(group){
  const items=group.rows.slice().sort((a,b)=>Number(a[0])-Number(b[0])),m=metricIndex();
  const values=items.filter(hasMetric).map(r=>Number(r[m]));
  const header=items.length===1?`УИК #${items[0][0]}`:`${items.length} УИК рядом`;
  return `<b>${header}</b><br>${metricName()}: ${!values.length?'нет данных':values.length===1?`${fmt(values[0])}%`:`от ${fmt(Math.min(...values))} до ${fmt(Math.max(...values))}%`}<div class="cluster-list">${items.map(r=>`<div><a href="${uikHref(r)}" data-uik="${r[7]}">УИК #${r[0]}</a><br>явка ${fmt(r[4])}% · ЕР ${fmt(r[5])}%${metricIndex()===8?`<br>${r[8]!=null?`${escapeHtml(r[10])}: ${fmt(r[8])}% (${fmt(r[9])} голосов)`:'Кандидат IditeNa: нет данных'}`:''}</div>`).join('')}</div>`
}
function markerIcon(group,selected){
  const metric=metricIndex(),items=group.rows.slice().sort((a,b)=>(a[metric]??Infinity)-(b[metric]??Infinity)),expanded=map.getZoom()>=14;
  if(items.length===1){
    const available=hasMetric(items[0]),value=available?`${fmt(items[0][metric])}%`:'—',color=available?metricColor(items[0][metric]):'#b8c1c4';
    if(expanded)return L.divIcon({className:'uik-value-marker'+(selected?' is-selected':''),html:`<span class="value-pill" style="--value-color:${color}">${value}</span>`,iconSize:[56,30],iconAnchor:[28,15]});
    return L.divIcon({className:'uik-point'+(selected?' is-selected':''),html:`<span style="background:${color}"></span>`,iconSize:[selected?24:20,selected?24:20],iconAnchor:[selected?12:10,selected?12:10]});
  }
  const step=360/items.length;
  const sectors=items.map((row,i)=>`${hasMetric(row)?metricColor(row[metric]):'#b8c1c4'} ${(i*step).toFixed(3)}deg ${((i+1)*step).toFixed(3)}deg`).join(',');
  const values=items.filter(hasMetric).map(r=>Number(r[metric])),range=values.length?`${Math.round(Math.min(...values))}–${Math.round(Math.max(...values))}%`:'нет данных';
  return L.divIcon({className:'cluster-pie'+(selected?' is-selected':''),html:`<span class="pie-disc" style="background:conic-gradient(${sectors})"><b>${items.length}</b></span>${expanded?`<span class="cluster-range">${range}</span>`:''}`,iconSize:[44,44],iconAnchor:[22,22]});
}
function renderPointGroups(items,target,selected){
  for(const group of pointGroups(items)){
    const isSelected=group.rows.some(r=>r[7]===selected),values=group.rows.filter(hasMetric).map(r=>Number(r[metricIndex()]));
    const title=group.rows.length===1?`УИК #${group.rows[0][0]}: ${metricName()} ${values.length?`${fmt(values[0])}%`:'нет данных'}`:`${group.rows.length} УИК: ${metricName()} ${values.length?`от ${fmt(Math.min(...values))} до ${fmt(Math.max(...values))}%`:'нет данных'}`;
    L.marker([group.lat,group.lon],{icon:markerIcon(group,isSelected),keyboard:true,title}).bindPopup(groupPopup(group),{maxHeight:300,minWidth:180}).addTo(target);
  }
}
function renderMarkers(items){markerLayer.clearLayers();if(!requestedUik)renderPointGroups(items,markerLayer)}
function calculate(){
  updatePercentRange();
  const maxDist=+$('distance').value, threshold=+$('threshold').value, metric=metricIndex(), same=$('sameTik').checked;
  const allMode=$('view').value==='all';document.body.classList.toggle('all-uiks-mode',allMode);document.querySelector('.pair-section').hidden=allMode;
  $('metricLegendLabel').textContent=metricName();
  $('distanceLabel').textContent=fmt(maxDist)+' км';$('thresholdLabel').textContent=threshold+' п.п.';
  const cells=new Map(),size=.08;
  const filtered=areaRows(),selectedRows=selectedTiks.size?filtered.filter(row=>selectedTiks.has(row[1])):filtered,minPct=+$('minPct').value,maxPct=+$('maxPct').value;
  renderDistribution(selectedRows);
  const activeRows=selectedRows.filter(row=>hasMetric(row)&&row[metric]>=minPct&&row[metric]<=maxPct);
  if(allMode){pairs=[];layer.clearLayers();shownRows=metric===8&&minPct===0&&maxPct===100?selectedRows:activeRows;renderMarkers(shownRows);$('stats').innerHTML=`<strong>${fmt(shownRows.length)} УИК</strong> на карте из ${fmt(selectedRows.length)} в выбранной территории${metric===8&&minPct===0&&maxPct===100?` · ${fmt(activeRows.length)} с результатом кандидата, остальные серые`:''}`;return}
  const candidates=selectedRows.filter(hasMetric);
  candidates.forEach((r,i)=>{const key=`${Math.floor(r[2]/size)},${Math.floor(r[3]/size)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i)});
  const found=new Map();
  activeRows.forEach(a=>{const ci=Math.floor(a[2]/size),cj=Math.floor(a[3]/size),near=[];
    const latCells=Math.ceil(maxDist/111/size)+1,lonCells=Math.ceil(maxDist/(111*Math.max(.15,Math.cos(a[2]*Math.PI/180)))/size)+1;
    for(let di=-latCells;di<=latCells;di++)for(let dj=-lonCells;dj<=lonCells;dj++)for(const j of cells.get(`${ci+di},${cj+dj}`)||[]){const b=candidates[j];if(a[7]===b[7])continue;if(same&&a[1]!==b[1])continue;if(metric===8&&a[11]!==b[11])continue;const d=km(a,b);if(d<=maxDist)near.push([j,d])}
    near.sort((x,y)=>x[1]-y[1]);for(const [j,d] of near.slice(0,3)){const b=candidates[j],diff=Math.abs(a[metric]-b[metric]);if(diff<threshold)continue;const key=[a[7],b[7]].sort().join('-');found.set(key,{a,b,d,diff})}
  });
  pairs=[...found.values()].sort((x,y)=>y.diff-x.diff);layer.clearLayers();
  for(const p of pairs){const color=p.diff>=30?'#bc273c':p.diff>=20?'#e66d36':'#e4ad39';L.polyline([[p.a[2],p.a[3]],[p.b[2],p.b[3]]],{color,weight:Math.min(5,1.5+p.diff/15),opacity:.75}).bindPopup(popup(p,metric)).addTo(layer)}
  const shown=new Map();for(const p of pairs)for(const r of [p.a,p.b])shown.set(r[7],r);shownRows=[...shown.values()];renderMarkers(shownRows);
  const outsideShown=[...shown.values()].filter(r=>r[metric]<minPct||r[metric]>maxPct).length;
  $('stats').innerHTML=`<strong>${fmt(pairs.length)} пар</strong> выше порога<br>${fmt(shown.size)} УИК на карте${outsideShown?` · ${fmt(outsideShown)} соседей вне диапазона`:''} · ${fmt(activeRows.length)} в диапазоне${metric===8?` с результатом кандидата из ${fmt(selectedRows.length)}`:''} · ${fmt(rows.length)} с координатами из ${fmt(window.regionInfo.total)} протоколов региона${metric===8&&!activeRows.length?'<br>В исходном файле нет результатов кандидата для выбранной территории.':''}`;
  $('pairs').replaceChildren(...pairs.slice(0,30).map(p=>{const card=document.createElement('div');card.className='pair-card';const a=document.createElement('a'),b=document.createElement('a'),diff=document.createElement('strong'),small=document.createElement('small');a.href=uikHref(p.a);a.dataset.uik=p.a[7];a.textContent=`УИК №${p.a[0]}`;b.href=uikHref(p.b);b.dataset.uik=p.b[7];b.textContent=`УИК №${p.b[0]}`;diff.textContent=`${fmt(p.diff)} п.п.`;small.textContent=`${fmt(p.a[metric])}% ↔ ${fmt(p.b[metric])}% · ${fmt(p.d)} км · ${p.a[1]}`;card.append(a,' ↔ ',b,' ',diff,small);return card}));
}
function popup(p,m){const name=metricName(),candidate=m===8?`<br>${escapeHtml(p.a[10])} · округ #${escapeHtml(p.a[11])}`:'';return `<b>${name}: разница ${fmt(p.diff)} п.п.</b>${candidate}<br><a href="${uikHref(p.a)}" data-uik="${p.a[7]}">УИК #${p.a[0]}</a> — ${fmt(p.a[m])}%${m===8?` (${fmt(p.a[9])} голосов)`:''}<br><a href="${uikHref(p.b)}" data-uik="${p.b[7]}">УИК #${p.b[0]}</a> — ${fmt(p.b[m])}%${m===8?` (${fmt(p.b[9])} голосов)`:''}<br>Расстояние ${fmt(p.d)} км`}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function choose(){const item=window.index.find(x=>x.file===$('region').value),request=++regionRequest;window.regionInfo=item;$('stats').textContent='Загрузка региона…';const nextRows=await(await fetch('/data/'+item.file)).json();if(request!==regionRequest)return;rows=nextRows;$('uikSearch').value='';$('uikSearchResults').replaceChildren();renderArea();restoreTiks();fitMapToRows();calculate();renderDetail()}
async function init(){try{[window.index,areaGroups]=await Promise.all([fetch('/index.json').then(r=>r.json()),fetch('/area-groups.json').then(r=>r.json())]);$('region').innerHTML=window.index.map(x=>`<option value="${x.file}">${x.name} (${x.mapped.toLocaleString('ru-RU')})</option>`).join('');applyUrl();await choose();writeUrl('replace')}catch(e){$('stats').textContent='Не удалось загрузить данные. Откройте сайт через локальный сервер или GitHub Pages.';console.error(e)}}
for(const id of ['metric','view','sameTik'])$(id).addEventListener('change',()=>{writeUrl('push');if(rows.length){calculate();renderDetail()}});
for(const id of ['distance','threshold'])$(id).addEventListener('input',()=>{writeUrl('replace');if(rows.length)calculate()});
for(const id of ['minPct','maxPct'])$(id).addEventListener('input',()=>{if(+$('minPct').value>+$('maxPct').value)$(id).value=$(id==='minPct'?'maxPct':'minPct').value;updatePercentRange();writeUrl('replace');if(rows.length)calculate()});
$('resetPct').addEventListener('click',()=>{if($('minPct').value==='0'&&$('maxPct').value==='100')return;$('minPct').value='0';$('maxPct').value='100';updatePercentRange();writeUrl('push');if(rows.length)calculate()});
$('region').addEventListener('change',()=>{selectedTiks.clear();requestedTiks=[];requestedUik=null;requestedArea='';renderArea();writeUrl('push');choose()});
$('area').addEventListener('change',()=>{requestedArea=$('area').value;selectedTiks.clear();requestedTiks=[];requestedUik=null;renderTiks();writeUrl('push');fitMapToRows();calculate();renderDetail()});
$('tikSearch').addEventListener('input',renderTiks);
$('uikSearch').addEventListener('input',searchUiks);
$('uikSearch').addEventListener('keydown',event=>{if(event.key==='Enter'){const first=$('uikSearchResults').querySelector('button');if(first){event.preventDefault();first.click()}}});
$('tikList').addEventListener('change',event=>{const name=event.target.dataset.tik;if(!name)return;event.target.checked?selectedTiks.add(name):selectedTiks.delete(name);requestedTiks=[...selectedTiks];renderTiks();writeUrl('push');fitMapToRows();calculate()});
$('tikClear').addEventListener('click',()=>{selectedTiks.clear();requestedTiks=[];renderTiks();writeUrl('push');fitMapToRows();calculate()});
addEventListener('popstate',()=>{const previous=window.regionInfo?.file;applyUrl();if(previous!==$('region').value)choose();else if(rows.length){renderArea();restoreTiks();fitMapToRows();calculate();renderDetail()}});
document.addEventListener('click',event=>{const link=event.target.closest('a[data-uik]');if(!link)return;event.preventDefault();openUik(link.dataset.uik)});
init();
