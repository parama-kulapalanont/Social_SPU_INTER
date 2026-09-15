
function renderInstitutions(rows){
  __postRegistry={}; __postCounter=0;

  const by=aggregate(rows), arr=Object.values(by).sort((a,b)=>b.interactions-a.interactions);
  const total = k => arr.reduce((s,x)=>s+Number(x[k]||0),0);

  document.querySelector("#instCount").textContent=fmt(arr.length);
  document.querySelector("#totalPosts").textContent=fmt(total("posts"));
  document.querySelector("#totalLikes").textContent=fmt(total("likes"));
  document.querySelector("#totalComments").textContent=fmt(total("comments"));
  document.querySelector("#sourceCount").textContent=fmt(countVisibleSources(rows));

  document.querySelector("#profiles").innerHTML=arr.length?arr.map((x,i)=>{
    const insight = x.code==="SPU"
      ? `SPU อยู่ในอันดับ #${i+1} จาก Total interactions ในชุดข้อมูลที่เลือก และ ${x.strongestPlatform} เป็น Platform ที่มี Posts มากกว่า`
      : `${x.code} อยู่ในอันดับ #${i+1} และ ${x.strongestPlatform} เป็น Platform ที่มี Posts มากกว่า`;
    return `<article class="card profile ${x.code==="SPU"?"spu":""}">
      <h3>${esc(x.code)} ${x.code==="SPU"?'<span class="badge">SPU</span>':""}</h3>
      <div class="name">${esc(instName(x.code))}</div>
      <div class="stats">
        <div><b>${fmt(x.posts)}</b><span>Posts</span></div>
        <div><b>${fmt(x.likes)}</b><span>Likes</span></div>
        <div><b>${fmt(x.comments)}</b><span>Comments</span></div>
      </div>
      <div>
        <span class="badge ${x.strongestPlatform==="Instagram"?"ig":"fb"}">${esc(x.strongestPlatform)}</span>
        <span style="float:right;font-size:11px;color:#64748b">${fmt(x.interactionsPerPost.toFixed(1))} interactions/post</span>
      </div>
      <div class="quote">${esc(insight)}</div>
    </article>`;
  }).join(""):`<div class="card empty">ไม่พบข้อมูลตาม Filter ที่เลือก</div>`;

  document.querySelector("#heatmap").innerHTML=arr.map(x=>`
    <tr class="${x.code==="SPU"?"spu-row":""}">
      <td>${esc(x.code)}</td><td>${fmt(x.posts)}</td><td>${fmt(x.likes)}</td><td>${fmt(x.comments)}</td><td>${fmt(x.interactions)}</td><td>${fmt(x.interactionsPerPost.toFixed(1))}</td>
    </tr>`).join("");

  document.querySelector("#takeaways").innerHTML=arr.length?arr.map((x,i)=>`
    <div class="rank-row ${x.code==="SPU"?"spu":""}">
      <div class="rank-num">${i+1}</div>
      <div><b>${esc(x.code)}</b><div style="font-size:11px;color:#64748b;margin-top:2px">${esc(instName(x.code))}</div></div>
      <div style="text-align:right;font-size:11px">${fmt(x.interactions)} interactions</div>
    </div>`).join(""):`<div class="empty">ไม่พบข้อมูล</div>`;

  const intensity=[...arr].sort((a,b)=>b.interactionsPerPost-a.interactionsPerPost).slice(0,5);
  document.querySelector("#signals").innerHTML=intensity.length?intensity.map((x,i)=>`
    <div class="rank-row">
      <div class="rank-num">${i+1}</div>
      <div><b>${esc(x.code)}</b><div style="font-size:11px;color:#64748b">${esc(x.strongestPlatform)} · Platform ที่มี Posts มากกว่า</div></div>
      <div style="text-align:right"><b>${fmt(x.interactionsPerPost.toFixed(1))}</b><br><small>interactions/post</small></div>
    </div>`).join(""):`<div class="empty">ไม่พบข้อมูล</div>`;
}

(async function(){
  try{
    const rows=await fetchRows();
    updateTimestamp(rows);
    initFilters(rows, renderInstitutions, {mode:"single"});
  }catch(error){
    console.error(error);
    document.querySelector("#filterSummary").textContent="โหลดข้อมูลไม่สำเร็จ: "+error.message;
  }
})();
