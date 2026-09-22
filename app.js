const $=id=>document.getElementById(id);
const map=L.map('map',{preferCanvas:true}).setView([55.75,37.62],9);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
const layer=L.layerGroup().addTo(map);
let rows=[],pairs=[];
const km=(a,b)=>{const r=Math.PI/180, x=(b[2]-a[2])*r,y=(b[3]-a[3])*r;const h=Math.sin(x/2)**2+Math.cos(a[2]*r)*Math.cos(b[2]*r)*Math.sin(y/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const fmt=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:1});
function calculate(){
  const maxDist=+$('distance').value, threshold=+$('threshold').value, metric=$('metric').value==='er'?5:4, same=$('sameTik').checked;
  $('distanceLabel').textContent=fmt(maxDist)+' км';$('thresholdLabel').textContent=threshold+' п.п.';
  const cells=new Map(),size=.08;
  rows.forEach((r,i)=>{const key=`${Math.floor(r[2]/size)},${Math.floor(r[3]/size)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i)});
  const found=new Map();
  rows.forEach((a,i)=>{const ci=Math.floor(a[2]/size),cj=Math.floor(a[3]/size),near=[];
    const latCells=Math.ceil(maxDist/111/size)+1,lonCells=Math.ceil(maxDist/(111*Math.max(.15,Math.cos(a[2]*Math.PI/180)))/size)+1;
    for(let di=-latCells;di<=latCells;di++)for(let dj=-lonCells;dj<=lonCells;dj++)for(const j of cells.get(`${ci+di},${cj+dj}`)||[]){if(i===j)continue;const b=rows[j];if(same&&a[1]!==b[1])continue;const d=km(a,b);if(d<=maxDist)near.push([j,d])}
    near.sort((x,y)=>x[1]-y[1]);for(const [j,d] of near.slice(0,3)){const b=rows[j],diff=Math.abs(a[metric]-b[metric]);if(diff<threshold)continue;const key=[i,j].sort((x,y)=>x-y).join('-');found.set(key,{a,b,d,diff})}
  });
  pairs=[...found.values()].sort((x,y)=>y.diff-x.diff);layer.clearLayers();
  for(const p of pairs){const color=p.diff>=30?'#bc273c':p.diff>=20?'#e66d36':'#e4ad39';L.polyline([[p.a[2],p.a[3]],[p.b[2],p.b[3]]],{color,weight:Math.min(5,1.5+p.diff/15),opacity:.75}).bindPopup(popup(p,metric)).addTo(layer)}
  const shown=new Set();for(const p of pairs){for(const r of [p.a,p.b]){const k=r[7];if(shown.has(k))continue;shown.add(k);L.circleMarker([r[2],r[3]],{radius:4,color:'#243a43',weight:1,fillColor:'#fff',fillOpacity:1}).bindPopup(`УИК №${r[0]} · ${r[1]}<br>Явка ${fmt(r[4])}% · ЕР ${fmt(r[5])}%`).addTo(layer)}}
  $('stats').innerHTML=`<strong>${fmt(pairs.length)} пар</strong> выше порога<br>${fmt(shown.size)} УИК на карте · ${fmt(rows.length)} с координатами из ${fmt(window.regionInfo.total)} протоколов региона`;
  $('pairs').replaceChildren(...pairs.slice(0,30).map(p=>{const b=document.createElement('button');b.innerHTML=`УИК №${p.a[0]} ↔ №${p.b[0]} <strong>${fmt(p.diff)} п.п.</strong><small>${fmt(p.d)} км · ${p.a[1]}</small>`;b.onclick=()=>{map.fitBounds([[p.a[2],p.a[3]],[p.b[2],p.b[3]]],{padding:[70,70],maxZoom:15});L.popup().setLatLng([(p.a[2]+p.b[2])/2,(p.a[3]+p.b[3])/2]).setContent(popup(p,metric)).openOn(map)};return b}));
}
function popup(p,m){const name=m===5?'ЕР по списку':'Явка';return `<b>${name}: разница ${fmt(p.diff)} п.п.</b><br>УИК №${p.a[0]} — ${fmt(p.a[m])}%<br>УИК №${p.b[0]} — ${fmt(p.b[m])}%<br>Расстояние ${fmt(p.d)} км · ${p.a[1]}`}
async function choose(){const item=window.index.find(x=>x.file===$('region').value);window.regionInfo=item;$('stats').textContent='Загрузка региона…';rows=await(await fetch(item.file)).json();if(rows.length){const lat=rows.map(r=>r[2]).sort((a,b)=>a-b),lon=rows.map(r=>r[3]).sort((a,b)=>a-b),lo=Math.floor(rows.length*.01),hi=Math.ceil(rows.length*.99)-1;map.fitBounds([[lat[lo],lon[lo]],[lat[hi],lon[hi]]],{padding:[35,35]})}calculate()}
async function init(){try{window.index=await(await fetch('index.json')).json();$('region').innerHTML=window.index.map(x=>`<option value="${x.file}">${x.name} (${x.mapped.toLocaleString('ru-RU')})</option>`).join('');$('region').value=window.index.find(x=>x.name==='город Санкт-Петербург')?.file||window.index[0].file;await choose()}catch(e){$('stats').textContent='Не удалось загрузить данные. Откройте сайт через локальный сервер или GitHub Pages.';console.error(e)}}
for(const id of ['metric','distance','threshold','sameTik'])$(id).addEventListener('input',()=>rows.length&&calculate());$('region').addEventListener('change',choose);init();
