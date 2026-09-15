
(async function(){
  const rows=await fetchRows(); updateTimestamp(rows);
  const by=aggregate(rows), arr=Object.values(by).sort((a,b)=>b.interactions-a.interactions);
  const spu=by.SPU||{posts:0,views:0,likes:0,comments:0,shares:0,interactions:0,interactionsPerPost:0};
  const peers=arr.filter(x=>x.code!=="SPU");
  const peerAvgIPP=peers.length?peers.reduce((s,x)=>s+x.interactionsPerPost,0)/peers.length:0;
  const delta=peerAvgIPP?((spu.interactionsPerPost-peerAvgIPP)/peerAvgIPP*100):0;

  document.querySelector("#kpiPosts").textContent=fmt(spu.posts);
  document.querySelector("#kpiViews").textContent=fmt(spu.views);
  document.querySelector("#kpiLikes").textContent=fmt(spu.likes);
  document.querySelector("#kpiComments").textContent=fmt(spu.comments);
  document.querySelector("#peerDelta").textContent=`${delta>=0?"+":""}${delta.toFixed(0)}%`;

  new Chart(document.getElementById("postsChart"),{
    type:"bar",
    data:{labels:arr.map(x=>x.code),datasets:[{data:arr.map(x=>x.posts),backgroundColor:arr.map(x=>x.code==="SPU"?"#ec168c":"#93c5fd"),borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:"#edf2f7"}},x:{grid:{display:false}}}}
  });
  new Chart(document.getElementById("interactionsChart"),{
    type:"bar",
    data:{labels:arr.map(x=>x.code),datasets:[
      {label:"Likes",data:arr.map(x=>x.likes),backgroundColor:"#ec168c",borderRadius:5},
      {label:"Comments + Shares",data:arr.map(x=>x.comments+x.shares),backgroundColor:"#93c5fd",borderRadius:5}
    ]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"}},scales:{y:{beginAtZero:true,grid:{color:"#edf2f7"}},x:{grid:{display:false}}}}
  });

  document.querySelector("#profiles").innerHTML=arr.map(x=>`
    <article class="card profile ${x.code==="SPU"?"spu":""}">
      <h3>${esc(x.code)}</h3><div class="name">${esc(instName(x.code))}</div>
      <div class="stats"><div><b>${fmt(x.posts)}</b><span>Posts</span></div><div><b>${fmt(x.likes)}</b><span>Likes</span></div><div><b>${fmt(x.comments)}</b><span>Comments</span></div></div>
      <div class="quote">${fmt(x.interactionsPerPost.toFixed(1))} interactions/post · ${esc(x.strongestPlatform)} larger by post volume</div>
    </article>`).join("");

  const top=arr[0]||{};
  const bestIPP=[...arr].sort((a,b)=>b.interactionsPerPost-a.interactionsPerPost)[0]||{};
  document.querySelector("#takeaways").innerHTML=`
    <div class="insight pink"><span>SPU position</span><strong>#${Math.max(1,arr.findIndex(x=>x.code==="SPU")+1)}</strong><small>Ranking by total measured interactions.</small></div>
    <div class="insight blue"><span>Top institution</span><strong>${esc(top.code||"-")}</strong><small>${fmt(top.interactions||0)} total interactions.</small></div>
    <div class="insight green"><span>Best interactions/post</span><strong>${esc(bestIPP.code||"-")}</strong><small>${fmt((bestIPP.interactionsPerPost||0).toFixed(1))} interactions per post.</small></div>
    <div class="insight violet"><span>SPU strongest channel</span><strong>${esc(spu.strongestPlatform||"-")}</strong><small>Based on post volume in the collected data.</small></div>`;

  document.querySelector("#topPosts").innerHTML=topPosts(rows,4).map((r,i)=>postCard(r,i+1)).join("");
})();
