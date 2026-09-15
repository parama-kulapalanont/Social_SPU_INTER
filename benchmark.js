
(async function(){
  const rows=await fetchRows(); updateTimestamp(rows);
  const by=aggregate(rows), arr=Object.values(by).sort((a,b)=>b.interactions-a.interactions);
  const spu=by.SPU || {posts:0,views:0,likes:0,comments:0,shares:0,interactions:0,interactionsPerPost:0};
  const peers=arr.filter(x=>x.code!=="SPU");
  const peerAvg = k => peers.length?peers.reduce((s,x)=>s+Number(x[k]||0),0)/peers.length:0;
  const totalInt=arr.reduce((s,x)=>s+x.interactions,0);

  document.querySelector("#kpiPosts").textContent=fmt(spu.posts);
  document.querySelector("#kpiViews").textContent=fmt(spu.views);
  document.querySelector("#kpiLikes").textContent=fmt(spu.likes);
  document.querySelector("#kpiComments").textContent=fmt(spu.comments);
  document.querySelector("#kpiRank").textContent = `#${Math.max(1,arr.findIndex(x=>x.code==="SPU")+1)}`;

  const nextBest=peers[0]||{code:"-",interactions:0};
  const deltaVsNext=nextBest.interactions?((spu.interactions-nextBest.interactions)/nextBest.interactions*100):0;
  const avgInt=peerAvg("interactions");
  const deltaVsAvg=avgInt?((spu.interactions-avgInt)/avgInt*100):0;
  const avgIPP=peerAvg("interactionsPerPost");
  const deltaIPP=avgIPP?((spu.interactionsPerPost-avgIPP)/avgIPP*100):0;
  const share=totalInt?spu.interactions/totalInt*100:0;

  document.querySelector("#howDiffers").innerHTML = `
    <div class="insight pink"><span>SPU vs next best</span><strong>${deltaVsNext>=0?"+":""}${deltaVsNext.toFixed(0)}%</strong><small>Total interactions compared with ${esc(nextBest.code)}.</small></div>
    <div class="insight blue"><span>SPU vs peer average</span><strong>${deltaVsAvg>=0?"+":""}${deltaVsAvg.toFixed(0)}%</strong><small>Difference in total interactions versus peer average.</small></div>
    <div class="insight green"><span>Interactions / post</span><strong>${fmt(spu.interactionsPerPost.toFixed(1))}</strong><small>${deltaIPP>=0?"+":""}${deltaIPP.toFixed(0)}% versus peer average.</small></div>
    <div class="insight violet"><span>Share of interactions</span><strong>${share.toFixed(1)}%</strong><small>SPU share of all measured likes, comments and shares.</small></div>`;

  const max=Math.max(...arr.map(x=>x.interactions),1);
  document.querySelector("#ranking").innerHTML=arr.map((x,i)=>`
    <div class="rank-row ${x.code==="SPU"?"spu":""}">
      <div class="rank-num">${i+1}</div>
      <div><b>${esc(x.code)}</b><div class="barline"><i style="width:${Math.max(3,x.interactions/max*100)}%"></i></div></div>
      <div style="text-align:right"><b>${fmt(x.interactions)}</b><br><small>interactions</small></div>
    </div>`).join("");

  document.querySelector("#rankingTable").innerHTML=arr.map((x,i)=>`
    <tr class="${x.code==="SPU"?"spu-row":""}">
      <td>${i+1}. ${esc(x.code)}</td><td>${fmt(x.posts)}</td><td>${fmt(x.likes)}</td><td>${fmt(x.comments)}</td><td>${fmt(x.shares)}</td><td>${fmt(x.interactions)}</td>
    </tr>`).join("");

  new Chart(document.getElementById("benchmarkChart"),{
    type:"bar",
    data:{labels:arr.map(x=>x.code),datasets:[{label:"Total interactions",data:arr.map(x=>x.interactions),backgroundColor:arr.map(x=>x.code==="SPU"?"#ec168c":"#93c5fd"),borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"#edf2f7"}},x:{grid:{display:false}}}}
  });

  document.querySelector("#topPosts").innerHTML=topPosts(rows.filter(r=>r.institution_code==="SPU"),2).map(postCard).join("")+
    topPosts(rows.filter(r=>r.institution_code!=="SPU"),2).map((r,i)=>postCard(r,i+3)).join("");
})();
