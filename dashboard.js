const cfg = window.SPU_SOCIAL_CONFIG || {};

const supabaseClient = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_PUBLISHABLE_KEY
);

const fmt = (n) =>
  new Intl.NumberFormat("en-US").format(Number(n || 0));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));

function renderDashboard(rows) {

  const total = (key) =>
    rows.reduce(
      (sum, row) => sum + Number(row[key] || 0),
      0
    );

  // KPI
  document.querySelector("#kpiPosts").textContent =
    fmt(rows.length);

  document.querySelector("#kpiViews").textContent =
    fmt(total("views"));

  document.querySelector("#kpiLikes").textContent =
    fmt(total("likes"));

  document.querySelector("#kpiComments").textContent =
    fmt(total("comments"));


  // Platform summary
  const grouped = {};

  for (const row of rows) {

    if (!grouped[row.platform]) {
      grouped[row.platform] = [];
    }

    grouped[row.platform].push(row);
  }

  document.querySelector("#platformCards").innerHTML =
    Object.entries(grouped)
      .map(([platform, items]) => {

        const views = items.reduce(
          (sum, row) =>
            sum + Number(row.views || 0),
          0
        );

        const likes = items.reduce(
          (sum, row) =>
            sum + Number(row.likes || 0),
          0
        );

        const comments = items.reduce(
          (sum, row) =>
            sum + Number(row.comments || 0),
          0
        );

        return `
          <article class="platform-card">

            <span>
              ${esc(platform.toUpperCase())}
            </span>

            <strong>
              ${fmt(items.length)} posts
            </strong>

            <div>
              ${fmt(views)} views
            </div>

            <div>
              ${fmt(likes)} likes
            </div>

            <div>
              ${fmt(comments)} comments
            </div>

          </article>
        `;
      })
      .join("");


  // Latest posts
  document.querySelector("#postRows").innerHTML =
    rows.slice(0, 100)
      .map((row) => {

        const source =
          row.institution_code ||
          row.author_name ||
          row.author_handle ||
          "-";

        const caption =
          row.caption || "-";

        const linkStart =
          row.post_url
            ? `<a href="${esc(row.post_url)}"
                  target="_blank"
                  rel="noopener noreferrer">`
            : "";

        const linkEnd =
          row.post_url
            ? "</a>"
            : "";

        return `
          <tr>

            <td>
              ${esc(row.platform)}
            </td>

            <td>
              ${esc(source)}
            </td>

            <td class="caption">
              ${linkStart}
              ${esc(caption)}
              ${linkEnd}
            </td>

            <td class="num">
              ${fmt(row.views)}
            </td>

            <td class="num">
              ${fmt(row.likes)}
            </td>

            <td class="num">
              ${fmt(row.comments)}
            </td>

            <td class="num">
              ${fmt(row.shares)}
            </td>

          </tr>
        `;
      })
      .join("");
}


async function loadDashboard() {

  const status =
    document.querySelector("#lastUpdate");

  status.textContent =
    "กำลังโหลดข้อมูล...";

  const { data, error } =
    await supabaseClient.rpc(
      "get_social_dashboard_posts"
    );

  if (error) {

    console.error(error);

    status.textContent =
      "โหลดข้อมูลไม่สำเร็จ";

    document.querySelector(
      "#platformCards"
    ).innerHTML = `
      <div class="empty">
        ${esc(error.message)}
      </div>
    `;

    return;
  }

  const rows =
    Array.isArray(data)
      ? data
      : [];

  renderDashboard(rows);

  const latestCollected =
    rows
      .map((row) => row.last_collected_at)
      .filter(Boolean)
      .sort()
      .at(-1);

  if (latestCollected) {

    status.textContent =
      "Updated " +
      new Date(latestCollected)
        .toLocaleString(
          "th-TH",
          {
            timeZone:
              "Asia/Bangkok"
          }
        );

  } else {

    status.textContent =
      `${fmt(rows.length)} posts`;
  }
}


loadDashboard();