
let benchmarkChartInstance=null;

function renderBenchmark(rows){
  benchmarkChartInstance?.destroy?.();
  __postRegistry={}; __postCounter=0;

  const by=aggregate(rows), arr=Object.values(by).sort((a,b)=>b.interactions-a.interactions);
  const spu=by.SPU||{posts:0,views:0,likes:0,comments:0,shares:0,interactions:0,interactionsPerPost:0};
  const peers=arr.filter(x=>x.code!=="SPU");
  const peerAvg = k => peers.length?peers.reduce((s,x)=>s+Number(x[k]||0),0)/peers.length:0;
  const totalInt=arr.reduce((s,x)=>s+x.interactions,0);

  document.querySelector("#kpiPosts").textContent=fmt(spu.posts);
  document.querySelector("#kpiViews").textContent=fmt(spu.views);
  document.querySelector("#kpiLikes").textContent=fmt(spu.likes);
  document.querySelector("#kpiComments").textContent=fmt(spu.comments);
  document.querySelector("#kpiRank").textContent = arr.findIndex(x=>x.code==="SPU")>=0?`#${arr.findIndex(x=>x.code==="SPU")+1}`:"—";

  const nextBest=peers[0]||{code:"-",interactions:0};
  const deltaVsNext=nextBest.interactions?((spu.interactions-nextBest.interactions)/nextBest.interactions*100):0;
  const avgInt=peerAvg("interactions");
  const deltaVsAvg=avgInt?((spu.interactions-avgInt)/avgInt*100):0;
  const avgIPP=peerAvg("interactionsPerPost");
  const deltaIPP=avgIPP?((spu.interactionsPerPost-avgIPP)/avgIPP*100):0;
  const share=totalInt?spu.interactions/totalInt*100:0;

  document.querySelector("#howDiffers").innerHTML = `
    <div class="insight pink"><span>SPU เทียบอันดับรองลงมา</span><strong>${peers.length?`${deltaVsNext>=0?"+":""}${deltaVsNext.toFixed(0)}%`:"—"}</strong><small>Total interactions เทียบกับ ${esc(nextBest.code)}.</small></div>
    <div class="insight blue"><span>SPU เทียบค่าเฉลี่ยคู่เทียบ</span><strong>${peers.length?`${deltaVsAvg>=0?"+":""}${deltaVsAvg.toFixed(0)}%`:"—"}</strong><small>ความแตกต่างของ Total interactions เทียบค่าเฉลี่ยสถาบันอื่น</small></div>
    <div class="insight green"><span>Interactions ต่อ Post</span><strong>${fmt(spu.interactionsPerPost.toFixed(1))}</strong><small>${peers.length?`${deltaIPP>=0?"+":""}${deltaIPP.toFixed(0)}% เทียบค่าเฉลี่ยคู่เทียบ`:"ไม่มีคู่เทียบใน Filter นี้"}</small></div>
    <div class="insight violet"><span>สัดส่วน Interactions ของ SPU</span><strong>${share.toFixed(1)}%</strong><small>สัดส่วน Likes + Comments + Shares ของ SPU ในชุดเปรียบเทียบนี้</small></div>`;

  const max=Math.max(...arr.map(x=>x.interactions),1);
  document.querySelector("#ranking").innerHTML=arr.length?arr.map((x,i)=>`
    <div class="rank-row ${x.code==="SPU"?"spu":""}">
      <div class="rank-num">${i+1}</div>
      <div><b>${esc(x.code)}</b><div class="barline"><i style="width:${Math.max(3,x.interactions/max*100)}%"></i></div></div>
      <div style="text-align:right"><b>${fmt(x.interactions)}</b><br><small>interactions</small></div>
    </div>`).join(""):`<div class="empty">ไม่พบข้อมูล</div>`;

  document.querySelector("#rankingTable").innerHTML=arr.map((x,i)=>`
    <tr class="${x.code==="SPU"?"spu-row":""}">
      <td>${i+1}. ${esc(x.code)}</td><td>${fmt(x.posts)}</td><td>${fmt(x.likes)}</td><td>${fmt(x.comments)}</td><td>${fmt(x.shares)}</td><td>${fmt(x.interactions)}</td>
    </tr>`).join("");

  benchmarkChartInstance = new Chart(document.getElementById("benchmarkChart"),{
    type:"bar",
    data:{labels:arr.map(x=>x.code),datasets:[{label:"Total interactions",data:arr.map(x=>x.interactions),backgroundColor:arr.map(x=>x.code==="SPU"?"#ec168c":"#93c5fd"),borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"#edf2f7"}},x:{grid:{display:false}}}}
  });

  const spuPosts = topPosts(rows.filter(r=>r.institution_code==="SPU"),2);
  const peerPosts = topPosts(rows.filter(r=>r.institution_code!=="SPU"),2);
  const cards = [...spuPosts,...peerPosts];
  document.querySelector("#topPosts").innerHTML=cards.length
    ? cards.map((r,i)=>postCard(r,i+1)).join("")
    : `<div class="card empty">ไม่พบ Post ตาม Filter ที่เลือก</div>`;
  bindPostCards();
}

(async function(){
  try{
    const rows=await fetchRows();
    updateTimestamp(rows);
    initFilters(rows, renderBenchmark, {mode:"comparison"});
  }catch(error){
    console.error(error);
    document.querySelector("#filterSummary").textContent="โหลดข้อมูลไม่สำเร็จ: "+error.message;
  }
})();
