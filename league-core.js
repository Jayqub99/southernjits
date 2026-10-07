// Shared engine for the league pages (adl-league.html, ael-league.html).
// Each page defines its own data before loading this file:
//   LEAGUE   { code:'AEL', row:4 } — label and Supabase row for results/notes
//   SEASON   name, admin password, timeline, prize, prizeSplit, split, rankLabel
//   GROUPS   [{ id, name, conf, color }] in display order
//   TEAMS    { id: { name, abbr, group, gankster, roster:[...] } } — ours is 'SJS'
//   SCHEDULE [{ week, label, date, matches:[...] }]
const CHAMPS = ["Aatrox","Ahri","Akali","Akshan","Alistar","Ambessa","Amumu","Anivia","Annie","Aphelios","Ashe","Aurelion Sol","Aurora","Azir","Bard","Bel'Veth","Blitzcrank","Brand","Braum","Briar","Caitlyn","Camille","Cassiopeia","Cho'Gath","Corki","Darius","Diana","Dr. Mundo","Draven","Ekko","Elise","Evelynn","Ezreal","Fiddlesticks","Fiora","Fizz","Galio","Gangplank","Garen","Gnar","Gragas","Graves","Gwen","Hecarim","Heimerdinger","Hwei","Illaoi","Irelia","Ivern","Janna","Jarvan IV","Jax","Jayce","Jhin","Jinx","K'Sante","Kai'Sa","Kalista","Karma","Karthus","Kassadin","Katarina","Kayle","Kayn","Kennen","Kha'Zix","Kindred","Kled","Kog'Maw","LeBlanc","Lee Sin","Leona","Lillia","Lissandra","Locke","Lucian","Lulu","Lux","Malphite","Malzahar","Maokai","Master Yi","Mel","Milio","Miss Fortune","Mordekaiser","Morgana","Naafiri","Nami","Nasus","Nautilus","Neeko","Nidalee","Nilah","Nocturne","Nunu & Willump","Olaf","Orianna","Ornn","Pantheon","Poppy","Pyke","Qiyana","Quinn","Rakan","Rammus","Rek'Sai","Rell","Renata Glasc","Renekton","Rengar","Riven","Rumble","Ryze","Samira","Sejuani","Senna","Seraphine","Sett","Shaco","Shen","Shyvana","Singed","Sion","Sivir","Skarner","Smolder","Sona","Soraka","Swain","Sylas","Syndra","Tahm Kench","Taliyah","Talon","Taric","Teemo","Thresh","Tristana","Trundle","Tryndamere","Twisted Fate","Twitch","Udyr","Urgot","Varus","Vayne","Veigar","Vel'Koz","Vex","Vi","Viego","Viktor","Vladimir","Volibear","Warwick","Wukong","Xayah","Xerath","Xin Zhao","Yasuo","Yone","Yorick","Yunara","Yuumi","Zac","Zed","Zeri","Ziggs","Zilean","Zoe","Zyra"].sort();
const ICON_MAP = {"Bel'Veth":"Belveth","Cho'Gath":"Chogath","Dr. Mundo":"DrMundo","Jarvan IV":"JarvanIV","Kai'Sa":"Kaisa","Kha'Zix":"Khazix","Kog'Maw":"KogMaw","K'Sante":"KSante","LeBlanc":"Leblanc","Lee Sin":"LeeSin","Miss Fortune":"MissFortune","Nunu & Willump":"Nunu","Rek'Sai":"RekSai","Renata Glasc":"Renata","Tahm Kench":"TahmKench","Twisted Fate":"TwistedFate","Vel'Koz":"Velkoz","Xin Zhao":"XinZhao","Master Yi":"MasterYi","Wukong":"MonkeyKing"};
let CHAMP_DDV = "16.9.1";
// Art comes from the newest Data Dragon patch so newly released champions
// (e.g. Locke, patch 26.13) have icons; the pinned version is only a fallback.
try{ const _v=localStorage.getItem('sjs_ddv'); if(_v) CHAMP_DDV = _v; }catch(e){}
fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r=>r.json()).then(vs=>{
  const v = Array.isArray(vs) && vs[0]; if(!v || v === CHAMP_DDV) return;
  const old = CHAMP_DDV; CHAMP_DDV = v;
  try{ localStorage.setItem('sjs_ddv', v); }catch(e){}
  document.querySelectorAll(`img[src*="/cdn/${old}/"]`).forEach(img=>{ img.style.display=''; img.src = img.src.replace(`/cdn/${old}/`, `/cdn/${v}/`); });
}).catch(()=>{});
function champIconUrl(n){const k=ICON_MAP[n]||n.replace(/[^a-zA-Z]/g,'');return`https://ddragon.leagueoflegends.com/cdn/${CHAMP_DDV}/img/champion/${k}.png`;}
function champCell(n){if(!n)return'<span style="color:var(--text3);font-size:12px">—</span>';return`<div class="champ-cell"><img class="champ-icon" src="${champIconUrl(n)}" alt="${n}" onerror="this.style.display='none'"><span class="champ-name">${n}</span></div>`;}
function pickCell(champ, player, kda){
  if(!champ) return '<span style="color:var(--text3);font-size:12px">—</span>';
  return `<div class="champ-cell">
    <img class="champ-icon" src="${champIconUrl(champ)}" alt="${champ}" onerror="this.style.display='none'">
    <div style="display:flex;flex-direction:column;gap:1px">
      <span class="champ-name">${esc(champ)}</span>
      <span style="display:flex;gap:6px;align-items:center">
        ${player?`<span class="player-tag">${esc(player)}</span>`:''}
        ${kda?`<span class="kda-tag">${esc(kda)}</span>`:''}
      </span>
    </div>
  </div>`;
}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ─── ENGINE ──────────────────────────────────────────────────────────────────
let results = {};
let adminMode = false;
let currentResultMatch = null;
let scheduleFilter = 'all';

// ─── SHARED DATA (Supabase, synced across everyone who visits the page) ──────
// Each league lives in its own row of the shared scrims table (LEAGUE.row,
// set by the page: ADL = 3, AEL = 4) so past splits' results are kept.
async function loadLeagueData() {
  try {
    const res = await fetch(`/api/getData?row=${LEAGUE.row}`);
    if (!res.ok) throw new Error('Request failed: ' + res.status);
    const data = await res.json();
    results = data.results || {};
    matchNotes = data.matchNotes || {};
  } catch (e) {
    console.warn(`Failed to load ${LEAGUE.code} data from server, starting empty.`, e);
    results = {};
    matchNotes = {};
  }
}
async function saveLeagueData() {
  try {
    const res = await fetch('/api/saveData', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row: LEAGUE.row, data: { results, matchNotes } }),
    });
    if (!res.ok) throw new Error('Request failed: ' + res.status);
  } catch (e) {
    showToast('Save failed — check your connection and try again', 'warn');
    console.error(`Failed to save ${LEAGUE.code} data`, e);
  }
}

// Compute standings for a group
function calcStandings(group) {
  const teamIds = Object.entries(TEAMS).filter(([,t])=>t.group===group).map(([id])=>id);
  const stats = {};
  teamIds.forEach(id => stats[id] = { id, mw:0, ml:0, gw:0, gl:0, gd:0 });
  SCHEDULE.forEach(wk => {
    wk.matches.filter(m=>!m.bye && m.blue && m.blue!=='TBD').forEach(m => {
      const r = results[m.id];
      if (!r) return;
      const blueInGroup = stats[m.blue];
      const redInGroup  = stats[m.red];
      if (!blueInGroup || !redInGroup) return;
      // blueGames/redGames hold the Bo3 series score; fall back to a 1-0 split
      // for older records saved before series scoring was added.
      const blueGames = r.blueGames ?? (r.winner==='blue' ? 1 : 0);
      const redGames  = r.redGames  ?? (r.winner==='red'  ? 1 : 0);
      blueInGroup.gw += blueGames; blueInGroup.gl += redGames;
      redInGroup.gw  += redGames;  redInGroup.gl  += blueGames;
      if (r.winner === 'blue') { blueInGroup.mw++; redInGroup.ml++; }
      else                     { redInGroup.mw++;  blueInGroup.ml++; }
    });
  });
  return Object.values(stats).sort((a,b) => {
    const mwD = b.mw - a.mw; if(mwD) return mwD;
    const gwD = b.gw - a.gw; if(gwD) return gwD;
    const gdA = a.gw - a.gl; const gdB = b.gw - b.gl;
    return gdB - gdA;
  }).map((s,i) => ({ ...s, pos: i+1 }));
}

function groupById(g) { return GROUPS.find(x => x.id === g); }
function groupColor(g) { return groupById(g)?.color || 'var(--accent)'; }
function groupDisplayName(g) { return groupById(g)?.name || g; }
function confName(g) { return groupById(g)?.conf || ''; }

// Shown wherever group-dependent content would be, until the draw happens
function preDrawMsg(what) {
  return `<div style="color:var(--text3);font-size:13px;padding:16px 0">${what} will appear here after the group draw show.</div>`;
}

// ─── RENDER STANDINGS TABLE ───
function renderStandingsGroup(group, containerId, compact=false) {
  const rows = calcStandings(group);
  const gamesPlayed = rows.reduce((s,r)=>s+r.mw+r.ml,0)/2;
  const color = groupColor(group);
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div class="group-header">
      <div>
        <div style="font-family:var(--font-d);font-size:15px;font-weight:700">${groupDisplayName(group)} Group</div>
        ${confName(group) ? `<div style="font-size:11px;color:var(--text3);margin-top:2px">${confName(group)} Conference</div>` : ''}
      </div>
      <span class="group-label-pill" style="background:${color}22;color:${color};border:1px solid ${color}44">${rows.length} teams</span>
    </div>
    <table>
      <thead><tr>
        <th class="r">#</th><th>Team</th><th class="r">W</th><th class="r">L</th>
        ${compact?'':`<th class="r">GW</th><th class="r">GL</th><th class="r">GD</th>`}
        <th class="r">G%</th>
      </tr></thead>
      <tbody>
        ${rows.map((r,i) => {
          const gd = r.gw - r.gl;
          const pct = (r.gw+r.gl)===0 ? '—' : (r.gw/(r.gw+r.gl)*100).toFixed(0)+'%';
          const gdClass = gd>0?'gd-pos':gd<0?'gd-neg':'gd-zero';
          const posClass = i===0?'pos pos-1':i===1?'pos pos-2':'pos';
          const qualify = i<2 ? 'qualify' : i>=rows.length-1 ? 'danger' : '';
          return `<tr class="${qualify}" onclick="showPage('schedule',null);filterSchedule('${group}',document.querySelector('.filt[data-g=${group}]'))">
            <td class="r"><span class="${posClass}">${i+1}</span></td>
            <td class="team-name-cell" onclick="openTeamModal('${r.id}')" title="View roster">${TEAMS[r.id]?.name||r.id}<span class="team-abbr-cell">[${TEAMS[r.id]?.abbr||r.id}]</span></td>
            <td class="r" style="color:var(--win);font-weight:700">${r.mw}</td>
            <td class="r" style="color:var(--loss)">${r.ml}</td>
            ${compact?'':`<td class="r">${r.gw}</td><td class="r">${r.gl}</td><td class="r"><span class="${gdClass}">${gd>=0?'+':''}${gd}</span></td>`}
            <td class="r pct">${pct}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderAllStandings() {
  const c = document.getElementById('standingsContainer');
  if (!GROUPS.length) { c.innerHTML = preDrawMsg('Standings'); return; }
  // One section per conference (or a single unlabelled one if none are set)
  const confs = [...new Set(GROUPS.map(g => g.conf || ''))];
  c.innerHTML = confs.map(cf => `
    <div class="section-header"${cf===confs[0]?' style="margin-top:0"':''}><h2 class="section-title">${cf ? cf+' Conference' : 'Groups'}</h2><div class="section-line"></div></div>
    <div class="grid-2" style="margin-bottom:22px">
      ${GROUPS.filter(g => (g.conf||'') === cf).map(g => `<div class="group-card" id="standings-${g.id}"></div>`).join('')}
    </div>`).join('');
  GROUPS.forEach(g => renderStandingsGroup(g.id, `standings-${g.id}`));
}

// ─── RENDER SCHEDULE ─────────────────────────────────────────────────────────
function matchTeamName(id) {
  if (!id||id==='TBD') return 'TBD';
  return TEAMS[id]?.name || id;
}
function matchGroup(m) {
  if (m.blue==='TBD'||!m.blue) return 'qualifier';
  return TEAMS[m.blue]?.group || TEAMS[m.red]?.group || '';
}

function renderSchedule() {
  const c = document.getElementById('scheduleContainer');
  let html = '';
  SCHEDULE.forEach(wk => {
    html += `<div class="week-header-row">
      <span class="week-num-lbl">${wk.label}</span>
      <span class="week-date-lbl">${wk.date}</span>
      ${wk.extended?`<span class="week-ext-badge">${wk.extended}</span>`:''}
      ${wk.deadline?`<span class="week-deadline-badge">${wk.deadline}</span>`:''}
      ${wk.freeze?`<span class="week-freeze-badge">${wk.freeze}</span>`:''}
    </div>`;
    // group by group
    const byGroup = {};
    wk.matches.forEach(m => {
      const g = m.bye ? TEAMS[m.team]?.group : matchGroup(m);
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(m);
    });
    [...GROUPS.map(g => g.id), 'qualifier'].forEach(g => {
      if (!byGroup[g]) return;
      html += `<div data-week="${wk.week}" data-group="${g}">`;
      if (g!=='qualifier') {
        html += `<div class="group-section-lbl" style="border-left-color:${groupColor(g)};color:${groupColor(g)}">${groupDisplayName(g)} Group</div>`;
      }
      byGroup[g].forEach(m => {
        if (m.bye) {
          html += `<div class="bye-row" data-match-id="${m.id}">BYE — ${matchTeamName(m.team)}</div>`;
          return;
        }
        const r = results[m.id];
        const played = !!r;
        const isTBD = m.blue==='TBD';
        html += renderMatchCard(m, wk.week, g, r, isTBD);
      });
      html += `</div>`;
    });
  });
  c.innerHTML = html || preDrawMsg('The schedule');
  applyScheduleFilter();
}

function renderMatchCard(m, week, group, r, isTBD) {
  const blueWon = r?.winner==='blue';
  const redWon = r?.winner==='red';
  const blueNm = isTBD ? (m.label||'TBD') : matchTeamName(m.blue);
  const redNm  = isTBD ? '' : matchTeamName(m.red);
  const blueClick = (!isTBD && m.blue && TEAMS[m.blue]) ? `event.stopPropagation();showPage('teams',document.querySelector('.nav-btn[data-page=teams]'));setTimeout(()=>openTeamModal('${m.blue}'),50)` : '';
  const redClick  = (!isTBD && m.red  && TEAMS[m.red])  ? `event.stopPropagation();showPage('teams',document.querySelector('.nav-btn[data-page=teams]'));setTimeout(()=>openTeamModal('${m.red}'),50)`  : '';
  const blueEl = blueClick ? `<span class="team-nm team-nm-link" onclick="${blueClick}">${blueNm}</span>` : `<div class="team-nm">${blueNm}</div>`;
  const redEl  = redClick  ? `<span class="team-nm team-nm-link" onclick="${redClick}">${redNm}</span>`   : `<div class="team-nm">${redNm}</div>`;
  const bg = r ? (r.blueGames ?? (blueWon?1:0)) : 0;
  const rg = r ? (r.redGames  ?? (redWon?1:0))  : 0;
  const centerHtml = r
    ? `<div class="match-result ${blueWon?'result-blue':'result-red'}">${bg}–${rg}</div><div class="match-meta">${blueWon?'Blue':'Red'} Wins</div>`
    : `<div class="vs-txt">VS</div>`;
  const footerLinks = isTBD ? '' : `
    ${m.draft?`<a href="https://drafter.lol/draft/${m.draft}" target="_blank" class="btn-sm btn-draft">Draft</a>`:''}
    ${m.tcode?`<button class="btn-sm btn-tcode" onclick="event.stopPropagation();copyCode('${m.tcode}','${m.id}')">tCode</button>`:''}
  `;
  const resultTag = r ? `<span class="result-tag ${blueWon?'bw':'rw'}">${blueWon?'BLUE':'RED'} WINS ${bg}–${rg}</span>` : '';
  const reportBtn = (adminMode && !isTBD)
    ? `<button class="btn-sm btn-report" onclick="event.stopPropagation();openResult('${m.id}')">Report</button>`
    : '';
  return `<div class="match-block ${r?'played':''}" data-match-id="${m.id}" onclick="if(adminMode&&!${!!isTBD})openResult('${m.id}')">
    <div class="match-inner">
      <div class="match-team-a">
        ${blueEl}
        ${isTBD?'':'<div class="side-lbl side-blue">Blue Side</div>'}
      </div>
      <div class="match-center">${centerHtml}</div>
      <div class="match-team-b">
        ${isTBD?'':`${redEl}<div class="side-lbl side-red">Red Side</div>`}
      </div>
    </div>
    <div class="match-footer">
      <div class="match-links">${footerLinks}</div>
      <div style="display:flex;gap:8px;align-items:center">${resultTag}${reportBtn}</div>
    </div>
  </div>`;
}

function applyScheduleFilter() {
  const f = scheduleFilter;
  document.querySelectorAll('#scheduleContainer [data-group]').forEach(el => {
    const g = el.dataset.group;
    const week = el.dataset.week;
    if (!week) return; // section labels etc
    let show = true;
    if (f==='played') {
      // show group section only if it has played matches
      const hasPlayed = [...el.querySelectorAll('[data-match-id]')].some(m => results[m.dataset.matchId]);
      show = hasPlayed;
    } else if (f==='unplayed') {
      const hasUnplayed = [...el.querySelectorAll('[data-match-id]')].some(m => !results[m.dataset.matchId]);
      show = hasUnplayed;
    } else if (f!=='all') {
      show = g===f;
    }
    el.style.display = show?'':'none';
  });
  // hide week headers that have all hidden groups
  document.querySelectorAll('.week-header-row').forEach(h => {
    const next = h.nextElementSibling;
    // find all data-group siblings until next week-header
    let sib = h.nextElementSibling;
    let anyVisible = false;
    while (sib && !sib.classList.contains('week-header-row')) {
      if (sib.dataset && sib.dataset.group && sib.style.display!=='none') anyVisible = true;
      sib = sib.nextElementSibling;
    }
    h.style.display = anyVisible?'':'none';
  });
}

function filterSchedule(g, btn) {
  scheduleFilter = g;
  document.querySelectorAll('.filt').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyScheduleFilter();
}

// Group buttons come from GROUPS; the non-group filters are always present
function renderFilterBars() {
  const groupBtns = (fn) => GROUPS.map(g =>
    `<button class="filt" data-g="${g.id}" onclick="${fn}('${g.id}',this)">${g.name}</button>`).join('');
  document.getElementById('scheduleFilters').innerHTML =
    `<button class="filt active" data-g="all" onclick="filterSchedule('all',this)">All Groups</button>` +
    groupBtns('filterSchedule') +
    `<button class="filt" data-g="played" onclick="filterSchedule('played',this)">Results Only</button>` +
    `<button class="filt" data-g="unplayed" onclick="filterSchedule('unplayed',this)">Upcoming</button>`;
  document.getElementById('teamFilters').innerHTML =
    `<button class="filt active" data-g="all" onclick="filterTeams('all',this)">All Teams</button>` +
    groupBtns('filterTeams');
}

// ─── RENDER TEAMS ────────────────────────────────────────────────────────────
function calcTeamRecord(teamId) {
  let mw=0,ml=0;
  SCHEDULE.forEach(wk=>wk.matches.filter(m=>!m.bye&&(m.blue===teamId||m.red===teamId)).forEach(m=>{
    const r=results[m.id]; if(!r) return;
    if((r.winner==='blue'&&m.blue===teamId)||(r.winner==='red'&&m.red===teamId)) mw++; else ml++;
  }));
  return {mw,ml};
}

function openTeamModal(teamId) {
  const t = TEAMS[teamId];
  if (!t) return;
  const color = groupColor(t.group);
  const {mw,ml} = calcTeamRecord(teamId);

  document.getElementById('teamModalHeader').innerHTML = `
    <div class="team-modal-hex" style="background:${color}22;color:${color};border:2px solid ${color}55">${t.abbr}</div>
    <div class="team-modal-info">
      <div class="team-modal-name">${t.name}</div>
      <div class="team-modal-sub" style="color:${color}">${[groupDisplayName(t.group), confName(t.group), `${mw}W ${ml}L`].filter(Boolean).join(' · ')}</div>
    </div>`;

  const roster = t.roster || [];
  document.getElementById('teamModalBody').innerHTML = `
    <table class="roster-table">
      <thead><tr><th>Role</th><th>Summoner</th><th>${SEASON.rankLabel||'Rank Lock'}</th><th>OP.GG</th></tr></thead>
      <tbody>${roster.map(p=>`
        <tr>
          <td><span class="role-badge role-${p.role}">${p.role}</span></td>
          <td><span class="summoner-id">${p.summoner}</span></td>
          <td><span class="rank-txt">${p.rank||'—'}</span></td>
          <td>${p.opgg?`<a href="${p.opgg}" target="_blank" class="opgg-link">OP.GG ↗</a>`:'<span style="color:var(--text3);font-size:12px">—</span>'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  // Team-level OP.GG multisearch of the five starters
  const starters = roster.filter(p=>p.role!=='Sub');
  const subs = roster.length - starters.length;
  const teamOpgg = buildTeamOpgg(starters);
  document.getElementById('teamModalFooter').innerHTML = `
    ${teamOpgg?`<a href="${teamOpgg}" target="_blank" class="btn-sm btn-draft" style="background:var(--accent-dim);color:var(--accent);border-color:rgba(201,162,39,.4)">View All on OP.GG ↗</a>`:''}
    ${t.gankster?`<a href="${t.gankster}" target="_blank" class="btn-sm btn-draft">Gankster ↗</a>`:''}
    <span style="margin-left:auto;font-size:11px;color:var(--text3)">${starters.length} starters${subs?` · ${subs} sub${subs>1?'s':''}`:''}</span>`;

  document.getElementById('teamModal').classList.add('open');
}

function buildTeamOpgg(roster) {
  const names = roster.map(p=>p.summoner).filter(Boolean);
  if (!names.length) return '';
  const encoded = names.map(s=>encodeURIComponent(s)).join('%2C');
  return `https://op.gg/lol/multisearch/na?summoners=${encoded}`;
}

function closeTeamModal(e) {
  if (e.target === document.getElementById('teamModal')) {
    document.getElementById('teamModal').classList.remove('open');
  }
}

function renderTeams(filter='all') {
  const c = document.getElementById('teamsGrid');
  const entries = Object.entries(TEAMS).filter(([,t])=>filter==='all'||t.group===filter);
  if (!entries.length) { c.innerHTML = preDrawMsg('Opponent teams'); return; }
  c.innerHTML = entries.map(([id,t]) => {
    const {mw,ml} = calcTeamRecord(id);
    const color = groupColor(t.group);
    const hasOpgg = t.roster && t.roster.length > 0;
    return `<div class="team-card" onclick="openTeamModal('${id}')">
      <div class="team-card-top">
        <div class="team-hex" style="background:${color}22;color:${color};border:1px solid ${color}44">${t.abbr}</div>
        <div>
          <div class="team-card-name">${t.name}</div>
          <div class="team-card-sub" style="color:${color}">${[groupDisplayName(t.group), confName(t.group)].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div class="team-record-row">
        <div class="rec-stat"><div class="rec-val" style="color:var(--win)">${mw}</div><div class="rec-lbl">W</div></div>
        <div class="rec-stat"><div class="rec-val" style="color:var(--loss)">${ml}</div><div class="rec-lbl">L</div></div>
        <div class="rec-stat" style="margin-left:auto;display:flex;gap:6px;align-items:center">
          ${hasOpgg?'<span style="font-size:10px;color:var(--accent);font-weight:700;font-family:var(--font-d);letter-spacing:.04em">OP.GG</span>':''}
          ${t.gankster?`<a href="${t.gankster}" target="_blank" class="btn-sm btn-draft" onclick="event.stopPropagation()">Gankster</a>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterTeams(g, btn) {
  document.querySelectorAll('.filt').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderTeams(g);
}

// ─── RENDER DASHBOARD ────────────────────────────────────────────────────────
function renderDashboard() {
  const totalMatches = SCHEDULE.flatMap(w=>w.matches.filter(m=>!m.bye&&m.blue!=='TBD')).length;
  const playedMatches = Object.keys(results).length;
  const el = document.getElementById('dashStats');
  el.innerHTML = `
    <div class="stat-card"><div class="stat-label">Teams</div><div class="stat-value blue">${Object.keys(TEAMS).length || 'TBD'}</div><div class="stat-sub">${GROUPS.length ? GROUPS.length+' groups'+(new Set(GROUPS.map(g=>g.conf).filter(Boolean)).size>1 ? ', '+new Set(GROUPS.map(g=>g.conf).filter(Boolean)).size+' conferences' : '') : 'Set at the group draw'}</div></div>
    <div class="stat-card"><div class="stat-label">Matches Played</div><div class="stat-value win">${playedMatches}</div><div class="stat-sub">${totalMatches ? 'of '+totalMatches+' group stage' : 'Schedule not out yet'}</div></div>
    <div class="stat-card"><div class="stat-label">Prize Pool</div><div class="stat-value gold">${SEASON.prize||'—'}</div><div class="stat-sub">${SEASON.prizeSplit||''}</div></div>
    <div class="stat-card"><div class="stat-label">Season</div><div class="stat-value" style="font-size:22px;padding-top:10px">${SEASON.name}</div><div class="stat-sub">${SEASON.split||''}</div></div>`;

  // Recent results
  const recent = SCHEDULE.flatMap(w=>w.matches.filter(m=>!m.bye&&results[m.id])).slice(-6).reverse();
  const rl = document.getElementById('recentList');
  if (recent.length===0) {
    rl.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:12px 0">No results reported yet.</div>';
  } else {
    rl.innerHTML = recent.map(m => {
      const r=results[m.id];
      const winner = r.winner==='blue' ? TEAMS[m.blue]?.name : TEAMS[m.red]?.name;
      const loser  = r.winner==='blue' ? TEAMS[m.red]?.name  : TEAMS[m.blue]?.name;
      const bg = r.blueGames ?? (r.winner==='blue'?1:0);
      const rg = r.redGames  ?? (r.winner==='red'?1:0);
      const score = r.winner==='blue' ? `${bg}-${rg}` : `${rg}-${bg}`;
      return `<div class="recent-match">
        <div class="recent-teams"><span class="recent-winner">${winner}</span><span class="recent-vs">def.</span>${loser}</div>
        <span class="result-tag ${r.winner==='blue'?'bw':'rw'}">${score}</span>
      </div>`;
    }).join('');
  }

  // Upcoming
  const upcoming = SCHEDULE.flatMap(w=>w.matches.filter(m=>!m.bye&&m.blue!=='TBD'&&!results[m.id]).map(m=>({...m,weekLabel:w.label}))).slice(0,8);
  document.getElementById('upcomingList').innerHTML = !upcoming.length ? preDrawMsg('Upcoming matches') : upcoming.map(m=>`
    <div class="upcoming-item">
      <div class="upcoming-dot"></div>
      <div class="upcoming-teams">${matchTeamName(m.blue)} vs ${matchTeamName(m.red)}</div>
      <div class="upcoming-week">${m.weekLabel}</div>
    </div>`).join('');

  // Top of each group
  const dg = document.getElementById('dashStandings');
  dg.innerHTML = '';
  if (!GROUPS.length) { dg.innerHTML = preDrawMsg('Group leaders'); return; }
  GROUPS.forEach(({id: g}) => {
    const div = document.createElement('div');
    div.id = `dash-standings-${g}`;
    div.className = 'group-card';
    dg.appendChild(div);
    renderStandingsGroup(g, `dash-standings-${g}`, true);
  });
}

// ─── RENDER TIMELINE ─────────────────────────────────────────────────────────
function renderTimeline() {
  const el = document.getElementById('infoTimeline');
  el.innerHTML = SEASON.timeline.map((t,i)=>`
    <div class="tl-row">
      <div class="tl-spine">
        <div class="tl-dot ${t.status}"></div>
        ${i<SEASON.timeline.length-1?'<div class="tl-line"></div>':''}
      </div>
      <div class="tl-body">
        <div class="tl-label">${t.label}</div>
        <div class="tl-date">${t.date}</div>
      </div>
    </div>`).join('');
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────
function toggleAdmin() {
  if (adminMode) { adminLogout(); return; }
  document.getElementById('adminOverlay').classList.add('open');
  document.getElementById('adminPwInput').focus();
}
function closeAdminOverlay() { document.getElementById('adminOverlay').classList.remove('open'); }
function checkAdminPw() {
  const pw = document.getElementById('adminPwInput').value;
  if (pw===SEASON.admin) {
    adminMode=true;
    document.getElementById('adminOverlay').classList.remove('open');
    document.getElementById('adminBar').classList.add('show');
    document.getElementById('adminToggleBtn').classList.add('active');
    document.getElementById('adminToggleBtn').textContent='Admin ✓';
    document.getElementById('adminPwInput').value='';
    renderSchedule(); renderDashboard(); renderMatches();
    showToast('Admin mode enabled');
  } else {
    document.getElementById('adminErr').style.display='block';
    setTimeout(()=>document.getElementById('adminErr').style.display='none',2000);
  }
}
function adminLogout() {
  adminMode=false;
  document.getElementById('adminBar').classList.remove('show');
  document.getElementById('adminToggleBtn').classList.remove('active');
  document.getElementById('adminToggleBtn').textContent='Admin';
  renderSchedule(); renderDashboard(); renderMatches();
}

// ─── RESULT ENTRY ─────────────────────────────────────────────────────────────
let selectedWinner = null;
let selectedScore = null; // { blueGames, redGames }
const SCORE_BTN_IDS = { '2-0':'scoreBtn20', '2-1':'scoreBtn21', '1-2':'scoreBtn12', '0-2':'scoreBtn02' };

function openResult(matchId) {
  currentResultMatch = matchId;
  selectedWinner = null;
  selectedScore = null;
  // find match
  let found;
  SCHEDULE.forEach(w=>w.matches.forEach(m=>{if(m.id===matchId)found=m;}));
  if (!found) return;
  const r = results[matchId];
  document.getElementById('resultTitle').textContent = 'Report Result';
  document.getElementById('resultMatchInfo').innerHTML =
    `<strong>${matchTeamName(found.blue)}</strong> (Blue) vs <strong>${matchTeamName(found.red)}</strong> (Red)<br>
     Match ID: <span style="font-family:monospace;font-size:12px;color:var(--text3)">${matchId}</span>`;
  const clrBtn = document.getElementById('clearResultBtn');
  clrBtn.style.display = r ? 'block':'none';
  Object.values(SCORE_BTN_IDS).forEach(id=>document.getElementById(id).className='winner-btn');
  if (r) {
    selectedWinner = r.winner;
    const bg = r.blueGames ?? (r.winner==='blue'?1:0);
    const rg = r.redGames  ?? (r.winner==='red'?1:0);
    selectedScore = { blueGames:bg, redGames:rg };
    const key = `${bg}-${rg}`;
    const id = SCORE_BTN_IDS[key];
    if (id) document.getElementById(id).className = 'winner-btn '+(r.winner==='blue'?'sel-blue':'sel-red');
  }
  document.getElementById('resultSuccess').style.display='none';
  document.getElementById('resultOverlay').classList.add('open');
}
function closeResultOverlay() { document.getElementById('resultOverlay').classList.remove('open'); currentResultMatch=null; }
function selectScore(side, blueGames, redGames) {
  selectedWinner = side;
  selectedScore = { blueGames, redGames };
  Object.values(SCORE_BTN_IDS).forEach(id=>document.getElementById(id).className='winner-btn');
  const id = SCORE_BTN_IDS[`${blueGames}-${redGames}`];
  document.getElementById(id).className = 'winner-btn '+(side==='blue'?'sel-blue':'sel-red');
}
async function submitResult() {
  if (!selectedWinner || !selectedScore) { showToast('Select a series score first','warn'); return; }
  results[currentResultMatch]={ winner:selectedWinner, blueGames:selectedScore.blueGames, redGames:selectedScore.redGames, ts:Date.now() };
  await saveLeagueData();
  document.getElementById('resultSuccess').style.display='block';
  setTimeout(()=>{
    closeResultOverlay();
    renderSchedule(); renderAllStandings(); renderDashboard(); renderTeams(document.querySelector('#teams .filt.active')?.dataset?.g||'all'); renderMatches();
    showToast('Result saved!');
  },600);
}
async function clearResult() {
  delete results[currentResultMatch];
  await saveLeagueData();
  closeResultOverlay();
  renderSchedule(); renderAllStandings(); renderDashboard(); renderTeams(document.querySelector('#teams .filt.active')?.dataset?.g||'all'); renderMatches();
  showToast('Result cleared','warn');
}

// ─── OUR MATCHES (SJS match notes) ────────────────────────────────────────────
const MN_ROLES = ['Top','Jungle','Middle','Bottom','Support'];
let matchNotes = {};
let currentMatchNoteId = null;


function findSjsMatches() {
  const out = [];
  SCHEDULE.forEach(wk => wk.matches.forEach(m => {
    if (m.bye || !m.blue || m.blue==='TBD') return;
    if (m.blue==='SJS' || m.red==='SJS') out.push({ ...m, weekLabel: wk.label, date: wk.date });
  }));
  return out;
}

function noteGames(note) {
  if (!note) return [];
  if (note.games && note.games.length) return note.games;
  if (note.sjsPicks) return [{ sjsPicks: note.sjsPicks, oppPicks: note.oppPicks, sjsPlayers:{}, oppPlayers:{}, sjsKda:{}, oppKda:{} }];
  return [];
}

function renderGameBlock(game, oppName, idx, total) {
  const resultTag = game.result ? `<span class="result-tag" style="background:${game.result==='Win'?'rgba(46,204,113,.12)':'rgba(231,76,60,.12)'};color:${game.result==='Win'?'var(--win)':'var(--loss)'};border:1px solid ${game.result==='Win'?'rgba(46,204,113,.3)':'rgba(231,76,60,.3)'}">${esc(game.result.toUpperCase())}</span>` : '';
  return `<div style="${idx>0?'border-top:1px solid var(--border);padding-top:14px;margin-top:14px':''}">
    ${total>1?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-family:var(--font-d);font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text2)">Game ${idx+1}</span>${resultTag}</div>`:''}
    <div class="picks-row">
      <div class="picks-col">
        <div class="picks-col-label" style="color:var(--accent)">Southern Jits</div>
        <div class="picks-list">${MN_ROLES.map(role=>pickCell(game.sjsPicks?.[role], game.sjsPlayers?.[role], game.sjsKda?.[role])).join('')}</div>
      </div>
      <div class="picks-col">
        <div class="picks-col-label">${esc(oppName)}</div>
        <div class="picks-list">${MN_ROLES.map(role=>pickCell(game.oppPicks?.[role], game.oppPlayers?.[role], game.oppKda?.[role])).join('')}</div>
      </div>
    </div>
    ${game.notes?`<div style="font-size:12px;color:var(--text3);margin-top:6px">${esc(game.notes)}</div>`:''}
  </div>`;
}

function renderMatches() {
  const c = document.getElementById('matchesContainer');
  const matches = findSjsMatches();
  if (!matches.length) { c.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:16px 0">No scheduled matches found for Southern Jits.</div>'; return; }
  c.innerHTML = matches.map(m => {
    const isBlue = m.blue==='SJS';
    const oppId = isBlue ? m.red : m.blue;
    const oppName = matchTeamName(oppId);
    const r = results[m.id];
    const sjsWon = r && ((r.winner==='blue') === isBlue);
    const sjsGames = r ? (isBlue ? (r.blueGames ?? (sjsWon?1:0)) : (r.redGames ?? (sjsWon?1:0))) : 0;
    const oppGames = r ? (isBlue ? (r.redGames  ?? (sjsWon?0:1)) : (r.blueGames ?? (sjsWon?0:1))) : 0;
    const resultTag = r ? `<span class="result-tag" style="background:${sjsWon?'rgba(46,204,113,.12)':'rgba(231,76,60,.12)'};color:${sjsWon?'var(--win)':'var(--loss)'};border:1px solid ${sjsWon?'rgba(46,204,113,.3)':'rgba(231,76,60,.3)'}">${sjsWon?'WIN':'LOSS'} ${sjsGames}-${oppGames}</span>` : '';
    const note = matchNotes[m.id];
    const games = noteGames(note);
    const adminBtn = adminMode ? `<button class="btn-sm btn-draft" onclick="openMatchNoteOverlay('${m.id}')">${note?'Edit Notes':'+ Add Notes'}</button><button class="btn-sm btn-tcode" onclick="openMnImportOverlay('${m.id}')">&#x1F4C2; Import JSON</button>` : '';
    const picksHtml = games.length ? `
      ${games.map((g,i)=>renderGameBlock(g, oppName, i, games.length)).join('')}
      ${note.vod?`<a href="${note.vod}" target="_blank" class="btn-sm btn-draft" style="display:inline-block;margin-top:12px">▶ Watch VOD</a>`:''}
      ${note.notes?`<div style="font-size:13px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);padding-top:10px;margin-top:10px">${esc(note.notes)}</div>`:''}
    ` : '<div style="color:var(--text3);font-size:12px">No notes logged yet.</div>';
    return `<div class="match-note-card">
      <div class="match-note-head">
        <div>
          <div style="font-family:var(--font-d);font-size:16px;font-weight:700">vs ${esc(oppName)} <span style="color:var(--text3);font-size:12px;font-weight:600">(${isBlue?'Blue':'Red'} Side)</span></div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${m.weekLabel} · ${m.date}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">${resultTag}${adminBtn}</div>
      </div>
      ${picksHtml}
    </div>`;
  }).join('');
}

function roleSelectRow(role, side) {
  return `<div style="display:flex;align-items:center;gap:8px">
    <span class="role-badge role-${role}" style="width:62px;text-align:center;flex-shrink:0">${role}</span>
    <select id="mn-${side}-${role}" style="flex:1.4"><option value="">— Select —</option>${CHAMPS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
    <input type="text" id="mn-${side}-kda-${role}" placeholder="K/D/A" style="flex:0.7;padding:10px 10px;font-size:13px;font-weight:600">
  </div>`;
}

let currentMnGameIdx = 0;

function openMatchNoteOverlay(matchId, gameIdx) {
  currentMatchNoteId = matchId;
  currentMnGameIdx = gameIdx || 0;
  let found, weekLabel;
  SCHEDULE.forEach(wk => wk.matches.forEach(m => { if (m.id===matchId) { found=m; weekLabel=wk.label; } }));
  if (!found) return;
  const isBlue = found.blue==='SJS';
  const oppId = isBlue ? found.red : found.blue;
  document.getElementById('matchNoteTitle').textContent = `Match Notes — vs ${matchTeamName(oppId)} (${weekLabel})`;
  const note = matchNotes[matchId];
  const games = noteGames(note);

  const tabs = document.getElementById('mnGameTabs');
  if (games.length > 1) {
    tabs.style.display = 'flex';
    tabs.innerHTML = games.map((g,i)=>`<button class="btn-sm ${i===currentMnGameIdx?'btn-report':'btn-tcode'}" onclick="event.preventDefault();switchMnGame(${i})">Game ${i+1}</button>`).join('');
  } else {
    tabs.style.display = 'none';
    tabs.innerHTML = '';
  }

  document.getElementById('mnSjsPicks').innerHTML = MN_ROLES.map(role=>roleSelectRow(role,'sjs')).join('');
  document.getElementById('mnOppPicks').innerHTML = MN_ROLES.map(role=>roleSelectRow(role,'opp')).join('');
  fillMnGameFields(games[currentMnGameIdx] || { sjsPicks:{}, oppPicks:{}, sjsKda:{}, oppKda:{} });

  document.getElementById('mnVod').value = note?.vod || '';
  document.getElementById('mnNotes').value = note?.notes || '';
  document.getElementById('mnDeleteBtn').style.display = matchNotes[matchId] ? 'block' : 'none';
  document.getElementById('matchNoteOverlay').classList.add('open');
}

function fillMnGameFields(g) {
  MN_ROLES.forEach(role => {
    document.getElementById(`mn-sjs-${role}`).value = g.sjsPicks?.[role] || '';
    document.getElementById(`mn-opp-${role}`).value = g.oppPicks?.[role] || '';
    document.getElementById(`mn-sjs-kda-${role}`).value = g.sjsKda?.[role] || '';
    document.getElementById(`mn-opp-kda-${role}`).value = g.oppKda?.[role] || '';
  });
}

function switchMnGame(idx) {
  // Save in-progress edits on the current game before switching tabs
  commitMnGameFields();
  currentMnGameIdx = idx;
  const games = noteGames(matchNotes[currentMatchNoteId]);
  document.querySelectorAll('#mnGameTabs button').forEach((b,i)=>b.className='btn-sm '+(i===idx?'btn-report':'btn-tcode'));
  fillMnGameFields(games[idx] || { sjsPicks:{}, oppPicks:{}, sjsKda:{}, oppKda:{} });
}

// Reads the form fields back into the in-memory games array for the currently-open match
// (without persisting to localStorage) so tab-switching doesn't lose unsaved edits.
function commitMnGameFields() {
  if (!currentMatchNoteId) return;
  const existing = matchNotes[currentMatchNoteId];
  const games = noteGames(existing);
  const g = games[currentMnGameIdx] || { sjsPicks:{}, oppPicks:{}, sjsPlayers:{}, oppPlayers:{}, sjsKda:{}, oppKda:{} };
  const sjsPicks={}, oppPicks={}, sjsKda={}, oppKda={};
  MN_ROLES.forEach(role => {
    sjsPicks[role] = document.getElementById(`mn-sjs-${role}`).value;
    oppPicks[role] = document.getElementById(`mn-opp-${role}`).value;
    sjsKda[role]   = document.getElementById(`mn-sjs-kda-${role}`).value.trim();
    oppKda[role]   = document.getElementById(`mn-opp-kda-${role}`).value.trim();
  });
  games[currentMnGameIdx] = { ...g, sjsPicks, oppPicks, sjsKda, oppKda };
  matchNotes[currentMatchNoteId] = { ...(existing||{}), games };
}

function closeMatchNoteOverlay() { document.getElementById('matchNoteOverlay').classList.remove('open'); currentMatchNoteId = null; }

async function saveMatchNote() {
  if (!currentMatchNoteId) return;
  commitMnGameFields();
  const current = matchNotes[currentMatchNoteId];
  matchNotes[currentMatchNoteId] = {
    ...current,
    vod: document.getElementById('mnVod').value.trim(),
    notes: document.getElementById('mnNotes').value.trim(),
    ts: Date.now(),
  };
  await saveLeagueData();
  closeMatchNoteOverlay();
  renderMatches();
  showToast('Match notes saved!');
}
async function deleteMatchNote() {
  if (!currentMatchNoteId) return;
  delete matchNotes[currentMatchNoteId];
  await saveLeagueData();
  closeMatchNoteOverlay();
  renderMatches();
  showToast('Match notes deleted', 'warn');
}

// ─── MATCH NOTE JSON IMPORT (from sjs_capture.py output) ──────────────────────
let mnImportMatchId = null;
const MN_ROLE_KEY = { top:'Top', jng:'Jungle', mid:'Middle', adc:'Bottom', sup:'Support' };

function openMnImportOverlay(matchId) {
  mnImportMatchId = matchId;
  document.getElementById('mn-import-textarea').value = '';
  document.getElementById('mn-import-filename').textContent = 'No file selected';
  document.getElementById('mn-import-file').value = '';
  document.getElementById('mn-import-feedback').style.display = 'none';
  document.getElementById('mnImportOverlay').classList.add('open');
}
function closeMnImportOverlay() { document.getElementById('mnImportOverlay').classList.remove('open'); mnImportMatchId = null; }

function handleMnImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('mn-import-filename').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => { document.getElementById('mn-import-textarea').value = e.target.result; };
  reader.readAsText(file);
}

function mnShowImportFeedback(type, msg) {
  const fb = document.getElementById('mn-import-feedback');
  const styles = {
    ok:    'background:rgba(39,174,96,.1);border:1px solid rgba(39,174,96,.3);color:var(--win)',
    error: 'background:rgba(231,76,60,.1);border:1px solid rgba(231,76,60,.3);color:var(--loss)',
  };
  fb.style.cssText = styles[type] + ';display:block;font-size:12px;padding:10px 14px;border-radius:6px;margin-bottom:14px;line-height:1.5';
  fb.innerHTML = msg;
}

async function confirmMnImport() {
  if (!mnImportMatchId) return;
  const raw = document.getElementById('mn-import-textarea').value.trim();
  if (!raw) { mnShowImportFeedback('error', 'Please paste JSON or upload a file.'); return; }

  let data;
  try { data = JSON.parse(raw); }
  catch(e) { mnShowImportFeedback('error', 'Invalid JSON: ' + e.message); return; }

  const rawGames = Array.isArray(data) ? data : [data];
  if (!rawGames.length) { mnShowImportFeedback('error', 'No game records found in this file.'); return; }

  const games = rawGames.map(g => {
    const sjsPicks={}, oppPicks={}, sjsPlayers={}, oppPlayers={}, sjsKda={}, oppKda={};
    Object.entries(MN_ROLE_KEY).forEach(([key, role]) => {
      sjsPicks[role]   = g[key] || '';
      oppPicks[role]   = g['e'+key] || '';
      sjsPlayers[role] = g.players?.[key] || '';
      oppPlayers[role] = g.eplayers?.[key] || '';
      sjsKda[role]     = g.kda?.[key] || '';
      oppKda[role]     = g.ekda?.[key] || '';
    });
    return { sjsPicks, oppPicks, sjsPlayers, oppPlayers, sjsKda, oppKda, result: g.result || '', notes: g.notes || '' };
  });

  const existing = matchNotes[mnImportMatchId] || {};
  matchNotes[mnImportMatchId] = {
    games,
    vod: existing.vod || '',
    notes: existing.notes || '',
    ts: Date.now(),
  };
  await saveLeagueData();
  closeMnImportOverlay();
  renderMatches();
  showToast(`Imported ${games.length} game${games.length>1?'s':''}!`);
}

// ─── NAVIGATION ──────────────────────────────────────────────────────────────
function showPage(name, btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  if (btn) { btn.classList.add('active'); return; }
  document.querySelectorAll('.nav-btn').forEach(b=>{ if(b.getAttribute('onclick')?.includes(`'${name}'`)) b.classList.add('active'); });
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────
function copyCode(code) {
  navigator.clipboard.writeText(code).then(()=>showToast('Tournament code copied!'));
}
function showToast(msg, type='win') {
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.borderColor=type==='warn'?'var(--warn)':'var(--win)';
  t.style.color=type==='warn'?'var(--warn)':'var(--win)';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove('show'),2400);
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
async function boot() {
  await loadLeagueData();
  renderFilterBars();
  renderDashboard();
  renderAllStandings();
  renderSchedule();
  renderTeams();
  renderTimeline();
  renderMatches();
  document.getElementById('seasonBadge').textContent = SEASON.name;
}
boot();
