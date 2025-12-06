(function () {
  // -----------------------------
  // Storage / State
  // -----------------------------
  const STORAGE_KEYS = {
    bosses: 'bosses',
    members: 'members',
    hunts: 'hunts',
    ledger: 'ledger',
    auth: 'points_auth',
    passcode: 'points_passcode',
    seeded: 'seeded_v1',
    attendance: 'attendance',
    recorderIds: 'recorder_ids',
    dashboardCounters: 'dashboard_counters',
    events: 'events',
    lastRangeIds: 'last_range_ids',
    lastRangeMarker: 'last_range_marker',
  };
  const POINTS_ADMIN_USER = 'admin';
  const POINTS_ADMIN_PASS = 'admin8899';

  const state = {
    bosses: [],
    members: [],
    hunts: [],
    ledger: [],
    attendance: [],
    auth: { loggedIn: false, user: '' },
    selectedBossId: null,
    viewFilters: { hideToday: false, hideAll: false, startDate: '', endDate: '' },
    recorderIds: [],
    dashboardCounters: { huntsAccum: 0 },
    wheelOptions: [],
    events: ['VEPRA','BOSS-RUSH','DRAGONBEST-INVA','ORFEN-INVA','CATACOM'],
  };

  // -----------------------------
  // Utils
  // -----------------------------
  const uid = (p = 'id') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const collatorTh = new Intl.Collator('th', { sensitivity: 'base', numeric: true });
  let charts = { kills: null, points: null };
  let spinWheelState = { angle: 0, spinning: false };
  let barValueLabelPlugin = {
    id: 'barValueLabels',
    afterDatasetsDraw(chart, args, pluginOptions) {
      const ctx = chart.ctx;
      const opts = Object.assign({ color: '#fff', font: { size: 11 }, formatter: v => v, padding: 2 }, pluginOptions || {});
      ctx.save();
      ctx.fillStyle = opts.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = `${opts.font.weight || ''} ${opts.font.size || 11}px ${opts.font.family || 'system-ui'}`;
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar, index) => {
          const val = ds.data[index];
          const label = opts.formatter ? opts.formatter(val) : String(val);
          const pos = bar.tooltipPosition();
          ctx.fillText(label, pos.x, pos.y - (opts.padding || 2));
        });
      });
      ctx.restore();
    }
  };
  if (typeof window !== 'undefined' && window.Chart) { window.Chart.register(barValueLabelPlugin); }
  const SERVER_ENDPOINT = '/.netlify/functions/state';
  async function loadServerState() {
    try {
      const res = await fetch(SERVER_ENDPOINT, { method: 'GET' });
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch {
      return null;
    }
  }
  async function saveServerState() {
    try {
      const isAdmin = (state.auth.loggedIn && state.auth.user === POINTS_ADMIN_USER);
      const payload = {
        bosses: state.bosses,
        members: state.members,
        hunts: state.hunts,
        attendance: state.attendance,
        recorderIds: state.recorderIds,
        dashboardCounters: state.dashboardCounters,
        events: state.events,
      };
      if (isAdmin) payload.ledger = state.ledger;
      await fetch(SERVER_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Admin': isAdmin ? '1' : '0' }, body: JSON.stringify(payload) });
    } catch {}
  }

  const saveAll = () => {
    localStorage.setItem(STORAGE_KEYS.bosses, JSON.stringify(state.bosses));
    localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(state.members));
    localStorage.setItem(STORAGE_KEYS.hunts, JSON.stringify(state.hunts));
    localStorage.setItem(STORAGE_KEYS.ledger, JSON.stringify(state.ledger));
    localStorage.setItem(STORAGE_KEYS.attendance, JSON.stringify(state.attendance));
    localStorage.setItem(STORAGE_KEYS.recorderIds, JSON.stringify(state.recorderIds));
    localStorage.setItem(STORAGE_KEYS.dashboardCounters, JSON.stringify(state.dashboardCounters));
    localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(state.events));
    saveServerState();
  };

  const loadAll = () => {
    state.bosses = JSON.parse(localStorage.getItem(STORAGE_KEYS.bosses) || '[]');
    state.members = JSON.parse(localStorage.getItem(STORAGE_KEYS.members) || '[]');
    state.hunts = JSON.parse(localStorage.getItem(STORAGE_KEYS.hunts) || '[]');
    state.ledger = JSON.parse(localStorage.getItem(STORAGE_KEYS.ledger) || '[]');
    state.attendance = JSON.parse(localStorage.getItem(STORAGE_KEYS.attendance) || '[]');
    state.recorderIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.recorderIds) || '[]');
    state.dashboardCounters = JSON.parse(localStorage.getItem(STORAGE_KEYS.dashboardCounters) || '{"huntsAccum":0}');
    state.events = JSON.parse(localStorage.getItem(STORAGE_KEYS.events) || '["VEPRA","BOSS-RUSH","DRAGONBEST-INVA","ORFEN-INVA","CATACOM"]');
    // เติมค่าเริ่มต้นให้ข้อมูลเก่าที่ไม่มีฟิลด์บัพรายบุคคล
    state.auth.loggedIn = localStorage.getItem(STORAGE_KEYS.auth) === '1';
    state.auth.user = localStorage.getItem('points_user') || '';
    if (state.auth.user !== POINTS_ADMIN_USER) { state.auth.loggedIn = false; }
    state.members = state.members.map(m => ({
      ...m,
      buffPercent: m.buffPercent ?? 0,
      buffStartDate: m.buffStartDate ?? '',
      buffEndDate: m.buffEndDate ?? '',
    }));
  };

  function seedInitialDataIfNeeded() {
    const seeded = localStorage.getItem(STORAGE_KEYS.seeded);
    if (seeded) return;

    const bossesSeed = [
      { name: 'ORFEN', points: 150 },
      { name: 'CORE', points: 50 },
      { name: 'MEDUSA', points: 20 },
      { name: 'QUEEN_ANT', points: 30 },
      { name: 'Glaki', points: 100 },
      { name: 'UKANBA', points: 100 },
      { name: 'MOOF', points: 100 },
      { name: 'Landor', points: 50 },
      { name: 'Hisilrome', points: 50 },
      { name: 'REPIRO', points: 30 },
    ].map(b => ({ id: uid('boss'), ...b }));

    const membersSeed = [
      '2Bladex','91Tintin','AMTz1','Arumie','Astroboy','Capitalistt','Choks','Chunk',
      'DLJSAK','DBCome','ElonMusk','GGWP','Greenie','HeineR','iLegendOfADEN','Imagine',
      'IXMVPI','Jason','Kazuzu','KilmuZ','Leafa','Luminous','Lunarella','Nora',
      'Orihime','Raja','Repd','Rexguza','Rise','Sky789','Slayers','Sozol','Zenkaii',
      'บาบายาก้า','พนอ','อาหวัง71','ไข่ตุ๋น','梁大婶','欧巴','IceQueen','JackPot300k'
    ].map(name => ({
      id: uid('mem'),
      name,
      buffPercent: 0,
      buffStartDate: '',
      buffEndDate: ''
    }));

    state.bosses = bossesSeed;
    state.members = membersSeed;
    state.hunts = [];

    saveAll();
    localStorage.setItem(STORAGE_KEYS.seeded, '1');
  }

  // -----------------------------
  // Helpers (lookup + buff)
  // -----------------------------
  function getMemberById(id) {
    return state.members.find(m => m.id === id) || null;
  }
  function getBossById(id) {
    return state.bosses.find(b => b.id === id) || null;
  }
  function isDateInRange(dateStr, start, end) {
    if (!dateStr) return false;
    if (start && dateStr < start) return false;
    if (end && dateStr > end) return false;
    return true;
  }
  function getMemberBuffMultiplier(memberId, dateStr) {
    const m = getMemberById(memberId);
    if (!m) return 1;
    const p = parseFloat(m.buffPercent || 0);
    if (!p || p <= 0) return 1;
    const active = isDateInRange(dateStr, m.buffStartDate || '', m.buffEndDate || '');
    return active ? 1 + p / 100 : 1;
  }
  function getTotalBuffMultiplier(memberId, dateStr) {
    // เฉพาะบัพรายบุคคล
    return getMemberBuffMultiplier(memberId, dateStr);
  }

  // -----------------------------
  // Tabs
  // -----------------------------
  function initTabs() {
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-tab');

        document.querySelectorAll('.tab').forEach(sec => sec.classList.remove('active'));
        document.querySelector(`#tab-${target}`).classList.add('active');

        if (target === 'summary') {
          renderSummaryTables();
          const b = document.getElementById('applyRangeToClanBtn');
          if (b) b.style.display = (state.auth.loggedIn && state.auth.user === POINTS_ADMIN_USER) ? '' : 'none';
        }
        if (target === 'points') {
          renderSimplePointsUI();
        }
        if (target === 'attendance') {
          renderAttendanceSummary();
        }
        if (target === 'dashboard') {
          renderDashboardCharts();
          initDashboardTab();
        }
        if (target === 'spin') {
          initSpinWheelTab();
        }
      });
    });
  }

  // -----------------------------
  // Boss Management
  // -----------------------------
  function renderBossManageTable(filter = '') {
    const tbody = document.querySelector('#bossManageTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();

    state.bosses
      .filter(b => b.name.toLowerCase().includes(kw))
      .sort((a, b) => collatorTh.compare(a.name, b.name))
      .forEach(b => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        nameTd.textContent = b.name;

        const pointsTd = document.createElement('td');
        pointsTd.textContent = b.points;

        const actionsTd = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.textContent = 'ลบ';
        delBtn.className = 'danger';
        delBtn.addEventListener('click', () => {
          if (!confirm(`ลบบอส "${b.name}" ?`)) return;
          state.bosses = state.bosses.filter(x => x.id !== b.id);
          saveAll();
          renderBossManageTable(filter);
          renderBossHuntList('');
          updateDashboardStats(); // อัพเดทสถิติเมื่อลบบอส
          if (state.selectedBossId === b.id) {
            state.selectedBossId = null;
            // อัพเดท UI ใหม่
            const bossNameEl = document.querySelector('.boss-name');
            const bossPointsEl = document.querySelector('.boss-points');
            if (bossNameEl) bossNameEl.textContent = 'ยังไม่ได้เลือกบอส';
            if (bossPointsEl) bossPointsEl.textContent = '-';
            // อัพเดทป้ายเก่า
            const lbl = document.getElementById('selectedBossName');
            if (lbl) lbl.textContent = '-';
          }
        });
        actionsTd.appendChild(delBtn);

        tr.appendChild(nameTd);
        tr.appendChild(pointsTd);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
  }

  function renderBossHuntList(filter = '') {
    const listEl = document.getElementById('bossHuntList');
    const noMsgEl = document.getElementById('noBossesMsg');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();

    const filteredBosses = state.bosses
      .filter(b => b.name.toLowerCase().includes(kw))
      .sort((a, b) => collatorTh.compare(a.name, b.name));

    // แสดง/ซ่อนข้อความเมื่อไม่มีบอส
    if (noMsgEl) {
      noMsgEl.style.display = filteredBosses.length === 0 ? 'block' : 'none';
    }
    
    if (listEl.parentElement) {
      listEl.parentElement.style.display = filteredBosses.length === 0 ? 'none' : 'block';
    }

    filteredBosses.forEach(b => {
      const li = document.createElement('li');
      const left = document.createElement('span');
      const right = document.createElement('span');
      left.textContent = b.name;
      right.textContent = `${b.points} คะแนน`;
      li.appendChild(left);
      li.appendChild(right);

      // เพิ่ม class selected ถ้าเป็นบอสที่เลือก
      if (state.selectedBossId === b.id) {
        li.classList.add('selected');
      }

      li.addEventListener('click', () => {
        // ลบ selected จากรายการเก่า
        listEl.querySelectorAll('li').forEach(item => item.classList.remove('selected'));
        // เพิ่ม selected ให้รายการใหม่
        li.classList.add('selected');
        
        state.selectedBossId = b.id;
        
        // อัพเดทการแสดงผลบอสที่เลือก
        const bossNameEl = document.querySelector('.boss-name');
        const bossPointsEl = document.querySelector('.boss-points');
        if (bossNameEl) bossNameEl.textContent = b.name;
        if (bossPointsEl) bossPointsEl.textContent = `${b.points} คะแนน/ตัว`;
        
        // อัพเดทป้ายเก่า (backward compatibility)
        const lbl = document.getElementById('selectedBossName');
        if (lbl) lbl.textContent = `${b.name} (${b.points} คะแนน/ตัว)`;
      });

      listEl.appendChild(li);
    });

    // อัพเดทจำนวนบอสที่แสดง
    const bossListCountEl = document.getElementById('bossListCount');
    if (bossListCountEl) {
      bossListCountEl.textContent = `${filteredBosses.length} บอส`;
    }
  }

  function initBossManage() {
    const addBtn = document.getElementById('addBossBtn');
    const nameEl = document.getElementById('newBossName');
    const ptsEl = document.getElementById('newBossPoints');
    const msgEl = document.getElementById('addBossMsg');

    if (addBtn && nameEl && ptsEl) {
      addBtn.addEventListener('click', () => {
        const name = (nameEl.value || '').trim();
        const pts = parseInt(ptsEl.value || '0', 10);
        if (!name) { if (msgEl) msgEl.textContent = 'กรุณากรอกชื่อบอส'; return; }
        if (isNaN(pts) || pts <= 0) { if (msgEl) msgEl.textContent = 'กรุณากรอกคะแนนให้ถูกต้อง'; return; }

        state.bosses.push({ id: uid('boss'), name, points: pts });
        saveAll();
        if (msgEl) msgEl.textContent = 'เพิ่มบอสเรียบร้อย';
        nameEl.value = '';
        ptsEl.value = '';
        renderBossManageTable('');
        renderBossHuntList('');
        updateDashboardStats(); // อัพเดทสถิติเมื่อเพิ่มบอส
      });
    }

    const searchEl = document.getElementById('bossManageSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        renderBossManageTable(e.target.value || '');
      });
    }

    renderBossManageTable('');
  }

  // -----------------------------
  // Member Management
  // -----------------------------
  function renderMemberSelectList(filter = '') {
    const container = document.getElementById('memberSelectList');
    if (!container) return;
    container.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();

    state.members
      .filter(m => m.name.toLowerCase().includes(kw))
      .sort((a,b) => collatorTh.compare(a.name, b.name))
      .forEach(m => {
        const row = document.createElement('div');
        row.className = 'member-item';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.dataset.memberId = m.id;
        chk.id = `mem_${m.id}`; // ผูกกับ label

        const label = document.createElement('label');
        label.textContent = m.name;
        label.htmlFor = chk.id; // คลิกชื่อ = คลิกเช็คบ็อกซ์

        row.appendChild(chk);
        row.appendChild(label);
        container.appendChild(row);
      });

    // ใช้ handler เดียว ป้องกันการแนบหลายครั้ง
    container.onchange = (e) => {
      if (e.target && e.target.type === 'checkbox') {
        const memId = e.target.dataset.memberId;
        const mem = getMemberById(memId);
        const selectedBox = document.getElementById('selectedMembersWithCounts');
        const existing = selectedBox.querySelector(`.sel-item[data-member-id="${memId}"]`);

        if (e.target.checked) {
          if (existing) return;
          const item = document.createElement('div');
          item.className = 'sel-item';
          item.dataset.memberId = memId;
          item.innerHTML = `
            <strong>${mem ? mem.name : '(ไม่พบ)'}</strong>
            <div style="margin-top:4px;">
              จำนวน: <input type="number" min="1" step="1" value="1" class="sel-count" style="width:90px;" />
              <button class="removeSel" style="margin-left:8px;">เอาออก</button>
            </div>
          `;
          selectedBox.appendChild(item);

          item.querySelector('.removeSel').addEventListener('click', () => {
            const chk = container.querySelector(`input[type="checkbox"][data-member-id="${memId}"]`);
            if (chk) chk.checked = false;
            item.remove();
          });
        } else {
          if (existing) existing.remove();
        }
      }
    };
    
    // เพิ่ม: คลิกทั้งแถวเพื่อสลับเช็คบ็อกซ์
    container.onclick = (e) => {
      const item = e.target.closest('.member-item');
      if (!item) return;
      // หากคลิกที่ checkbox หรือ label โดยตรง ไม่ต้องทำซ้ำ
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'label') return;

      const cb = item.querySelector('input[type="checkbox"]');
      if (!cb) return;
      cb.checked = !cb.checked;
      // ยิง change event เพื่อให้ logic เดิมทำงานต่อ (เพิ่ม/ลบใน selectedMembersWithCounts)
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }

  function renderMemberManageTable(filter = '') {
    const tbody = document.querySelector('#memberManageTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();

    state.members
      .filter(m => m.name.toLowerCase().includes(kw))
      .sort((a, b) => collatorTh.compare(a.name, b.name))
      .forEach(m => {
        const tr = document.createElement('tr');

        const nameTd = document.createElement('td');
        const buffPercentTd = document.createElement('td');
        const buffStartTd = document.createElement('td');
        const buffEndTd = document.createElement('td');
        const actionsTd = document.createElement('td');

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = m.name;

        const buffPercentInput = document.createElement('input');
        buffPercentInput.type = 'number';
        buffPercentInput.min = '0';
        buffPercentInput.step = '5';
        buffPercentInput.value = m.buffPercent ?? 0;

        const buffStartInput = document.createElement('input');
        buffStartInput.type = 'date';
        buffStartInput.value = m.buffStartDate || '';

        const buffEndInput = document.createElement('input');
        buffEndInput.type = 'date';
        buffEndInput.value = m.buffEndDate || '';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'บันทึก';
        saveBtn.className = 'primary';
        saveBtn.addEventListener('click', () => {
          m.name = nameInput.value.trim() || m.name;
          const p = parseFloat(buffPercentInput.value || '0');
          m.buffPercent = isNaN(p) || p < 0 ? 0 : p;
          m.buffStartDate = buffStartInput.value || '';
          m.buffEndDate = buffEndInput.value || '';

          saveAll();
          renderMemberManageTable(filter);
          renderMemberSelectList('');
          renderSummaryTables();
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = 'ลบ';
        delBtn.className = 'danger';
        delBtn.addEventListener('click', () => {
          if (!confirm(`ลบสมาชิก "${m.name}" ?`)) return;
          state.members = state.members.filter(x => x.id !== m.id);
          saveAll();
          renderMemberManageTable(filter);
          renderMemberSelectList('');
          renderSummaryTables();
          updateDashboardStats(); // อัพเดทสถิติเมื่อลบสมาชิก
        });

        nameTd.appendChild(nameInput);
        buffPercentTd.appendChild(buffPercentInput);
        buffStartTd.appendChild(buffStartInput);
        buffEndTd.appendChild(buffEndInput);
        actionsTd.appendChild(saveBtn);
        actionsTd.appendChild(delBtn);

        tr.appendChild(nameTd);
        tr.appendChild(buffPercentTd);
        tr.appendChild(buffStartTd);
        tr.appendChild(buffEndTd);
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
      });
  }

  function initMemberManage() {
    const addBtn = document.getElementById('addMemberBtn');
    const nameEl = document.getElementById('newMemberName');
    const msgEl = document.getElementById('addMemberMsg');

    if (addBtn && nameEl) {
      addBtn.addEventListener('click', () => {
        const name = (nameEl.value || '').trim();
        if (!name) { if (msgEl) msgEl.textContent = 'กรุณากรอกชื่อสมาชิก'; return; }
        state.members.push({
          id: uid('mem'),
          name,
          buffPercent: 0,
          buffStartDate: '',
          buffEndDate: ''
        });
        saveAll();
        if (msgEl) msgEl.textContent = 'เพิ่มสมาชิกเรียบร้อย';
        nameEl.value = '';
        renderMemberManageTable('');
        renderMemberSelectList('');
        renderSummaryTables();
        updateDashboardStats(); // อัพเดทสถิติเมื่อเพิ่มสมาชิก
      });
    }

    const searchEl = document.getElementById('memberManageSearch');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        renderMemberManageTable(e.target.value || '');
      });
    }

    renderMemberManageTable('');
  }

  // -----------------------------
  // Hunt Tab
  // -----------------------------
  function renderHuntLogTable() {
    const tbody = document.querySelector('#huntLogTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rows = [];
    const startDate = state.viewFilters?.startDate || '';
    const endDate = state.viewFilters?.endDate || '';
    state.hunts.forEach(h => {
      if (state.viewFilters?.hideAll) return;
      if (state.viewFilters?.hideToday && h.date === todayStr()) return;
      if (startDate && h.date < startDate) return;
      if (endDate && h.date > endDate) return;

      const boss = getBossById(h.bossId);
      h.entries.forEach(en => {
        const mem = getMemberById(en.memberId);
        const pointsPerKill = boss ? boss.points : 0;
        const totalBase = pointsPerKill * (en.count || 0);
        const mult = getTotalBuffMultiplier(en.memberId, h.date);
        const totalBuffed = Math.round(totalBase * mult);
        rows.push({
          date: h.date,
          bossName: boss ? boss.name : '(ถูกลบ)',
          memberName: mem ? mem.name : '(ถูกลบ)',
          count: en.count || 0,
          ppk: pointsPerKill,
          total: totalBuffed,
          huntId: h.id,
          memberId: en.memberId,
        });
      });
    });

    rows.sort((a,b) => b.date.localeCompare(a.date));

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.date}</td>
        <td>${r.bossName}</td>
        <td>${r.memberName}</td>
        <td>${r.count}</td>
        <td>${r.ppk}</td>
        <td>${r.total}</td>
        <td>
          <button data-action="edit" data-hunt-id="${r.huntId}" data-member-id="${r.memberId}">แก้ไข</button>
          <button class="danger" data-action="del" data-hunt-id="${r.huntId}" data-member-id="${r.memberId}">ลบ</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // handler เดียว
    tbody.onclick = (e) => {
      const btnEdit = e.target.closest('button[data-action="edit"]');
      if (btnEdit) {
        const huntId = btnEdit.getAttribute('data-hunt-id');
        const memberId = btnEdit.getAttribute('data-member-id');
        const hunt = state.hunts.find(h => h.id === huntId);
        if (!hunt) return;
        const en = hunt.entries.find(x => x.memberId === memberId);
        if (!en) return;
        const newCnt = parseInt(prompt('แก้ไขจำนวน:', en.count), 10);
        if (!isNaN(newCnt) && newCnt > 0) {
          en.count = newCnt;
          saveAll();
          renderHuntLogTable();
          renderSummaryTables();
          updateDashboardStats();
        }
        return;
      }
      const btnDel = e.target.closest('button[data-action="del"]');
      if (!btnDel) return;
      const huntId = btnDel.getAttribute('data-hunt-id');
      const memberId = btnDel.getAttribute('data-member-id');
      const hunt = state.hunts.find(h => h.id === huntId);
      if (!hunt) return;
      if (!confirm('ลบรายการของสมาชิกนี้?')) return;
      hunt.entries = hunt.entries.filter(en => en.memberId !== memberId);
      if (hunt.entries.length === 0) {
        state.hunts = state.hunts.filter(h => h.id !== huntId);
      }
      saveAll();
      renderHuntLogTable();
      renderSummaryTables();
      updateDashboardStats();
    };
  }

  // ฟังก์ชันอัพเดทสถิติ Dashboard
  function updateDashboardStats() {
    const totalBosses = state.bosses.length;
    const totalMembers = state.members.length;
    const huntsAccum = state.dashboardCounters?.huntsAccum || 0;
    const ledgerTotal = state.ledger.reduce((s, l) => s + (l.points || 0), 0);

    const totalBossesEl = document.getElementById('totalBossesCount');
    const totalMembersEl = document.getElementById('totalMembersCount');
    const todayHuntsEl = document.getElementById('todayHuntsCount');
    const todayPointsEl = document.getElementById('todayPointsCount');

    if (totalBossesEl) totalBossesEl.textContent = totalBosses;
    if (totalMembersEl) totalMembersEl.textContent = totalMembers;
    if (todayHuntsEl) todayHuntsEl.textContent = huntsAccum;
    if (todayPointsEl) todayPointsEl.textContent = ledgerTotal.toLocaleString();

    // อัพเดทจำนวนบอสในรายการ
    const bossListCountEl = document.getElementById('bossListCount');
    if (bossListCountEl) {
      const visibleBosses = document.querySelectorAll('#bossHuntList li').length;
      bossListCountEl.textContent = `${visibleBosses} บอส`;
    }
  }

  function initHuntTab() {
    const dateEl = document.getElementById('huntDate');
    if (dateEl) dateEl.value = todayStr();
    initRecorderManage();

    // อัพเดทสถิติเมื่อเริ่มต้น
    updateDashboardStats();

    const bossSearch = document.getElementById('bossHuntSearch');
    if (bossSearch) bossSearch.addEventListener('input', (e) => {
      renderBossHuntList(e.target.value || '');
      updateDashboardStats(); // อัพเดทจำนวนบอสที่แสดง
    });

    // ปุ่มรีเฟรชรายการบอส
    const refreshBossBtn = document.getElementById('refreshBossListBtn');
    if (refreshBossBtn) refreshBossBtn.addEventListener('click', () => {
      renderBossHuntList();
      updateDashboardStats();
      const msg = document.getElementById('huntSaveMsg');
      if (msg) {
        msg.textContent = 'รีเฟรชรายการบอสแล้ว';
        setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
      }
    });

    const memSearch = document.getElementById('memberSelectSearch');
    if (memSearch) memSearch.addEventListener('input', (e) => {
      renderMemberSelectList(e.target.value || '');
    });

    const resetAccumBtn = document.getElementById('resetHuntsAccumBtn');
    if (resetAccumBtn) {
      resetAccumBtn.addEventListener('click', () => {
        state.dashboardCounters.huntsAccum = 0;
        saveAll();
        updateDashboardStats();
        const msg = document.getElementById('huntSaveMsg');
        if (msg) {
          msg.textContent = 'รีเซทจำนวนล่าสะสมแล้ว';
          setTimeout(() => { if (msg) msg.textContent = ''; }, 1500);
        }
      });
    }

    // ฟังก์ชันบันทึกการล่า (ใช้ร่วมกันได้)
    const saveHuntData = (msgElementId = 'huntSaveMsg', clearAfterSave = false) => {
      const msg = document.getElementById(msgElementId);
      const date = document.getElementById('huntDate').value || todayStr();
      const bossId = state.selectedBossId;
      if (!bossId) { 
        if (msg) msg.textContent = 'กรุณาเลือกบอสก่อน'; 
        return false; 
      }

      const selectedBox = document.getElementById('selectedMembersWithCounts');
      const entries = Array.from(selectedBox.querySelectorAll('.sel-item')).map(el => {
        const memberId = el.dataset.memberId;
        const count = parseInt(el.querySelector('.sel-count').value || '0', 10);
        return { memberId, count: Math.max(1, count) };
      });

      if (entries.length === 0) { 
        if (msg) msg.textContent = 'กรุณาเลือกสมาชิกอย่างน้อย 1 คน'; 
        return false; 
      }

      state.hunts.push({
        id: uid('hunt'),
        date,
        bossId,
        entries
      });
      state.dashboardCounters.huntsAccum = (state.dashboardCounters?.huntsAccum || 0) + 1;
      saveAll();
      if (msg) msg.textContent = 'บันทึกเรียบร้อย';
      renderHuntLogTable();
      renderSummaryTables();
      updateDashboardStats(); // อัพเดทสถิติหลังบันทึก

      awardRecorderBonusForDate(date);

      if (clearAfterSave) {
        selectedBox.innerHTML = '';
        document.querySelectorAll('#memberSelectList input[type="checkbox"]').forEach(chk => { chk.checked = false; });
        state.selectedBossId = null;

        const bossNameEl = document.querySelector('.boss-name');
        const bossPointsEl = document.querySelector('.boss-points');
        if (bossNameEl) bossNameEl.textContent = 'ยังไม่ได้เลือกบอส';
        if (bossPointsEl) bossPointsEl.textContent = '-';

        document.querySelectorAll('#bossHuntList li').forEach(li => li.classList.remove('selected'));

        const oldLabel = document.getElementById('selectedBossName');
        if (oldLabel) oldLabel.textContent = '-';

        const dateInput = document.getElementById('huntDate');
        if (dateInput) dateInput.value = date;
      }

      return true;
    };

  function awardRecorderBonusForDate(date) {
      return;
  }

    // ปุ่มบันทึกหลัก
    const saveBtn = document.getElementById('saveHuntBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveHuntData('huntSaveMsg', false));
    }

    // ปุ่มบันทึกสำรอง
    const saveBtn2 = document.getElementById('saveHuntBtn2');
    if (saveBtn2) {
      saveBtn2.addEventListener('click', () => saveHuntData('huntSaveMsg2', false));
    }

    // ปุ่มบันทึกและเริ่มใหม่
    const saveAndNewBtn = document.getElementById('saveAndNewBtn');
    if (saveAndNewBtn) {
      saveAndNewBtn.addEventListener('click', () => {
        if (saveHuntData('huntSaveMsg2', true)) {
          const msg = document.getElementById('huntSaveMsg2');
          if (msg) msg.textContent = 'บันทึกเรียบร้อย - พร้อมเริ่มใหม่';
        }
      });
    }

    // ปุ่มเลือกทุกคน
    const quickAddAllBtn = document.getElementById('quickAddAllBtn');
    if (quickAddAllBtn) {
      quickAddAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#memberSelectList input[type="checkbox"]');
        checkboxes.forEach(chk => {
          if (!chk.checked) {
            chk.checked = true;
            chk.dispatchEvent(new Event('change'));
          }
        });
        const msg = document.getElementById('huntSaveMsg');
        if (msg) msg.textContent = 'เลือกสมาชิกทั้งหมดแล้ว';
      });
    }

    // ปุ่มล้างการเลือก
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#memberSelectList input[type="checkbox"]');
        checkboxes.forEach(chk => {
          if (chk.checked) {
            chk.checked = false;
            chk.dispatchEvent(new Event('change'));
          }
        });
        const selectedBox = document.getElementById('selectedMembersWithCounts');
        selectedBox.innerHTML = '';
        const msg = document.getElementById('huntSaveMsg');
        if (msg) msg.textContent = 'ล้างการเลือกแล้ว';
      });
    }

    // ปุ่มเลือกทั้งหมด (ที่แสดงในรายการ)
    const selectAllVisibleBtn = document.getElementById('selectAllVisibleBtn');
    if (selectAllVisibleBtn) {
      selectAllVisibleBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#memberSelectList input[type="checkbox"]:not([style*="display: none"])');
        checkboxes.forEach(chk => {
          if (!chk.checked) {
            chk.checked = true;
            chk.dispatchEvent(new Event('change'));
          }
        });
      });
    }

    // ปุ่มยกเลิกทั้งหมด
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('#memberSelectList input[type="checkbox"]');
        checkboxes.forEach(chk => {
          if (chk.checked) {
            chk.checked = false;
            chk.dispatchEvent(new Event('change'));
          }
        });
        const selectedBox = document.getElementById('selectedMembersWithCounts');
        selectedBox.innerHTML = '';
      });
    }

    // ปุ่มใช้จำนวนกับทุกคน
    const applyBulkCountBtn = document.getElementById('applyBulkCountBtn');
    if (applyBulkCountBtn) {
      applyBulkCountBtn.addEventListener('click', () => {
        const bulkCount = parseInt(document.getElementById('bulkCountInput').value || '1', 10);
        const countInputs = document.querySelectorAll('#selectedMembersWithCounts .sel-count');
        countInputs.forEach(input => {
          input.value = Math.max(1, bulkCount);
        });
        const msg = document.getElementById('huntSaveMsg');
        if (msg) msg.textContent = `ตั้งจำนวน ${bulkCount} ให้ทุกคนแล้ว`;
      });
    }

    const clearTodayBtn = document.getElementById('clearHuntsTodayBtn');
    if (clearTodayBtn) {
      clearTodayBtn.addEventListener('click', () => {
        state.viewFilters.hideToday = true;
        const msg = document.getElementById('huntSaveMsg');
        if (msg) msg.textContent = 'ซ่อนรายการวันนี้แล้ว (ข้อมูลยังอยู่)';
        renderHuntLogTable();
      });
    }

    const clearAllRealBtn = document.getElementById('clearHuntsAllRealBtn');
    if (clearAllRealBtn) {
      clearAllRealBtn.addEventListener('click', () => {
        if (!confirm('ลบ “การบันทึกทั้งหมด” จริงหรือไม่? บอสและสมาชิกยังอยู่')) return;
        const before = state.hunts.length;
        state.hunts = []; // ล้างเฉพาะการบันทึก
        saveAll();
        renderHuntLogTable();
        renderSummaryTables();
        const msg = document.getElementById('huntSaveMsg');
        if (msg) msg.textContent = `ล้างการบันทึกทั้งหมดแล้ว (${before} รอบ)`;
      });
    }

    const clearAllBtn = document.getElementById('resetHuntsViewBtn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        state.viewFilters.hideToday = false;
        state.viewFilters.hideAll = false;
        const msg = document.getElementById('huntSaveMsg');
        if (msg) msg.textContent = 'แสดงทุกรายการตามเดิม';
        renderHuntLogTable();
      });
    }

    const filterStartEl = document.getElementById('filterStartDate');
    const filterEndEl = document.getElementById('filterEndDate');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if (applyFilterBtn) {
      applyFilterBtn.addEventListener('click', () => {
        state.viewFilters.startDate = filterStartEl ? filterStartEl.value : '';
        state.viewFilters.endDate = filterEndEl ? filterEndEl.value : '';
        renderHuntLogTable();
      });
    }

    renderBossHuntList('');
    renderMemberSelectList('');
    renderHuntLogTable();
  }

  // -----------------------------
  // Summary & Export
  // -----------------------------

  // -----------------------------
  // Simple Points (ledger-only)
  // -----------------------------
  function togglePointsAuthUI() {
    const loginBox = document.getElementById('pointsLoginBox');
    const contentBox = document.getElementById('pointsContent');
    if (loginBox) loginBox.style.display = state.auth.loggedIn ? 'none' : '';
    if (contentBox) contentBox.style.display = state.auth.loggedIn ? '' : 'none';
    const applyBtn = document.getElementById('applyRangeToClanBtn');
    if (applyBtn) applyBtn.style.display = (state.auth.loggedIn && state.auth.user === POINTS_ADMIN_USER) ? '' : 'none';
    const undoBtn = document.getElementById('undoRangeToClanBtn');
    if (undoBtn) undoBtn.style.display = (state.auth.loggedIn && state.auth.user === POINTS_ADMIN_USER) ? '' : 'none';
  }

  function renderSimplePointsUI() {
    const memSel = document.getElementById('pointsMemberSelectAdjust');
    if (memSel) { memSel.innerHTML = state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join(''); }
    const memClearSel = document.getElementById('pointsMemberSelectClear');
    if (memClearSel) { memClearSel.innerHTML = state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join(''); }
    const attMemSel = document.getElementById('attendanceMemberSelect');
    if (attMemSel) { attMemSel.innerHTML = state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join(''); }
    renderPointsBalance();
  }

  function appendPointsLog(type, text) {
    const box = document.getElementById('pointsTerminalLog');
    if (!box) return;
    const ts = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `entry ${type}`;
    div.textContent = `[${ts}] ${text}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function renderPointsBalance() {
    const rows = state.members.map(m => {
      const total = state.ledger.filter(l => l.memberId === m.id).reduce((s, l) => s + (l.points || 0), 0);
      return { name: m.name, total };
    }).sort((a,b) => collatorTh.compare(a.name, b.name));
    const container = document.getElementById('pointsBalanceContainer');
    if (!container) return;
    container.innerHTML = '';
    // Dashboard mini removed per request
    for (let i = 0; i < rows.length; i += 10) {
      const tbl = document.createElement('table');
      tbl.className = 'table points-table';
      tbl.innerHTML = `<thead><tr><th>Member</th><th>Points</th></tr></thead><tbody></tbody>`;
      const tb = tbl.querySelector('tbody');
      rows.slice(i, i + 10).forEach(r => {
        const cls = r.total > 0 ? 'pos' : (r.total < 0 ? 'neg' : 'zero');
        const val = Number(r.total).toLocaleString();
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.name}</td><td class="value ${cls}">${val}</td>`;
        tb.appendChild(tr);
      });
      container.appendChild(tbl);
    }
  }

  function initAttendanceControls() {
    const attDate = document.getElementById('attendanceDate');
    if (attDate) attDate.value = todayStr();
    renderAttendanceEventSelect();
    initEventManageUI();
    const showEM = document.getElementById('showEventManageBtn');
    const hideEM = document.getElementById('hideEventManageBtn');
    const boxEM = document.getElementById('eventManageContent');
    if (showEM && hideEM && boxEM) {
      showEM.onclick = () => { boxEM.style.display = ''; showEM.style.display = 'none'; hideEM.style.display = ''; };
      hideEM.onclick = () => { boxEM.style.display = 'none'; hideEM.style.display = 'none'; showEM.style.display = ''; };
    }
    const attSearch = document.getElementById('attendanceMemberSearch');
    if (attSearch) attSearch.addEventListener('input', (e) => { renderAttendanceMemberSelectList(e.target.value || ''); });
    const selAllBtn = document.getElementById('attendanceSelectAllVisibleBtn');
    if (selAllBtn) selAllBtn.onclick = () => {
      const list = document.getElementById('attendanceMemberSelectList');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
    };
    const deselBtn = document.getElementById('attendanceDeselectAllBtn');
    if (deselBtn) deselBtn.onclick = () => {
      const list = document.getElementById('attendanceMemberSelectList');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
    };
    const clrBtn = document.getElementById('attendanceClearSelectionBtn');
    if (clrBtn) clrBtn.onclick = () => {
      const list = document.getElementById('attendanceMemberSelectList');
      const selBox = document.getElementById('attendanceSelectedMembers');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      selBox.innerHTML = '';
    };
    renderAttendanceMemberSelectList('');
    const attBtn = document.getElementById('markAttendanceBtn');
    if (attBtn) attBtn.onclick = () => {
      const ev = document.getElementById('attendanceEventSelect')?.value || '';
      const date = document.getElementById('attendanceDate')?.value || todayStr();
      if (!ev) return;
      const selBox = document.getElementById('attendanceSelectedMembers');
      const members = Array.from(selBox.querySelectorAll('.sel-item')).map(el => el.dataset.memberId).filter(Boolean);
      if (members.length === 0) return;
      const ok = confirm(`ยืนยันบันทึกการเข้าร่วม\nกิจกรรม: ${ev}\nวันที่: ${date}\nจำนวนสมาชิก: ${members.length} คน`);
      if (!ok) return;
      members.forEach(memId => { state.attendance.push({ id: uid('att'), memberId: memId, event: ev, date }); });
      saveAll();
      appendPointsLog('attendance', `MARK ${ev} for ${members.length} member(s) (${date})`);
      const msg = document.getElementById('attendanceSaveMsg');
      if (msg) { msg.textContent = 'บันทึกเรียบร้อย'; setTimeout(() => { msg.textContent = ''; }, 2000); }
      renderAttendanceSummary();
    };

    const attNewBtn = document.getElementById('markAttendanceAndNewBtn');
    if (attNewBtn) attNewBtn.onclick = () => {
      const ev = document.getElementById('attendanceEventSelect')?.value || '';
      const date = document.getElementById('attendanceDate')?.value || todayStr();
      if (!ev) return;
      const selBox = document.getElementById('attendanceSelectedMembers');
      const members = Array.from(selBox.querySelectorAll('.sel-item')).map(el => el.dataset.memberId).filter(Boolean);
      if (members.length === 0) return;
      const ok = confirm(`ยืนยันบันทึกการเข้าร่วม และล้างรายชื่อ\nกิจกรรม: ${ev}\nวันที่: ${date}\nจำนวนสมาชิก: ${members.length} คน`);
      if (!ok) return;
      members.forEach(memId => { state.attendance.push({ id: uid('att'), memberId: memId, event: ev, date }); });
      saveAll();
      appendPointsLog('attendance', `MARK ${ev} for ${members.length} member(s) (${date})`);
      const list = document.getElementById('attendanceMemberSelectList');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      selBox.innerHTML = '';
      const msg = document.getElementById('attendanceSaveMsg');
      if (msg) { msg.textContent = 'บันทึกและล้างรายชื่อ'; setTimeout(() => { msg.textContent = ''; }, 2000); }
      renderAttendanceSummary();
    };

    const calcBtn = document.getElementById('calcAttendanceSummaryBtn');
    if (calcBtn) calcBtn.onclick = () => { renderAttendanceSummary(); };
    const restoreBtn = document.getElementById('restoreEventsBtn');
    if (restoreBtn) restoreBtn.onclick = () => {
      let backupJson = null; try { backupJson = localStorage.getItem('events_backup') || ''; } catch {}
      if (!backupJson) return;
      let arr; try { arr = JSON.parse(backupJson); } catch { arr = null; }
      if (!Array.isArray(arr) || arr.length === 0) return;
      state.events = arr;
      saveAll();
      try { localStorage.removeItem('events_backup'); } catch {}
      renderAttendanceEventSelect();
      renderEventList();
      renderAttendanceSummary();
      appendPointsLog('attendance', 'RESTORE events from backup');
    };
    renderAttendanceSummary();
  }

  function renderAttendanceEventSelect() {
    const sel = document.getElementById('attendanceEventSelect');
    if (!sel) return;
    sel.innerHTML = state.events.map(ev => `<option value="${ev}">${ev}</option>`).join('');
  }

  function initEventManageUI() {
    const addBtn = document.getElementById('addEventBtn');
    const input = document.getElementById('newEventInput');
    const resetBtn = document.getElementById('resetEventsBtn');
    if (addBtn) {
      addBtn.onclick = () => {
        const name = (input?.value || '').trim();
        if (!name) return;
        if (state.events.includes(name)) return;
        state.events.push(name);
        saveAll();
        if (input) input.value = '';
        renderAttendanceEventSelect();
        renderEventList();
        renderAttendanceSummary();
      };
    }
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (!confirm('ยืนยันรีเซทกิจกรรมกลับค่าเริ่มต้น?')) return;
        try { localStorage.setItem('events_backup', JSON.stringify(state.events)); } catch {}
        state.events = ['VEPRA','BOSS-RUSH','DRAGONBEST-INVA','ORFEN-INVA','CATACOM'];
        saveAll();
        renderAttendanceEventSelect();
        renderEventList();
        renderAttendanceSummary();
        appendPointsLog('attendance', 'RESET events to default');
      };
    }
    renderEventList();
  }

  // Restore events from backup (attendance top actions)
  (function initRestoreEvents() {
    const restoreBtn = document.getElementById('restoreEventsBtn');
    if (restoreBtn) restoreBtn.onclick = () => {
      let backupJson = null; try { backupJson = localStorage.getItem('events_backup') || ''; } catch {}
      if (!backupJson) return;
      let arr; try { arr = JSON.parse(backupJson); } catch { arr = null; }
      if (!Array.isArray(arr) || arr.length === 0) return;
      state.events = arr;
      saveAll();
      try { localStorage.removeItem('events_backup'); } catch {}
      renderAttendanceEventSelect();
      renderEventList();
      renderAttendanceSummary();
      appendPointsLog('attendance', 'RESTORE events from backup');
    };
  })();

  function renderEventList() {
    const listEl = document.getElementById('eventList');
    if (!listEl) return;
    listEl.innerHTML = '';
    state.events.forEach(ev => {
      const row = document.createElement('div');
      row.className = 'member-item';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = ev;
      nameSpan.style.marginRight = '8px';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = ev;
      nameInput.style.display = 'none';
      nameInput.style.marginRight = '8px';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'แก้ไข';
      editBtn.className = 'btn-mini';
      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'บันทึก';
      saveBtn.className = 'btn-primary btn-mini';
      saveBtn.style.display = 'none';
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'ยกเลิก';
      cancelBtn.className = 'btn-mini';
      cancelBtn.style.display = 'none';

      const delBtn = document.createElement('button');
      delBtn.textContent = 'ลบ';
      delBtn.className = 'danger btn-mini';

      editBtn.onclick = () => {
        nameSpan.style.display = 'none';
        nameInput.style.display = '';
        saveBtn.style.display = '';
        cancelBtn.style.display = '';
        editBtn.style.display = 'none';
      };
      cancelBtn.onclick = () => {
        nameInput.value = ev;
        nameSpan.style.display = '';
        nameInput.style.display = 'none';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        editBtn.style.display = '';
      };
      saveBtn.onclick = () => {
        const newName = (nameInput.value || '').trim();
        if (!newName) return;
        if (newName === ev) { cancelBtn.onclick(); return; }
        if (state.events.includes(newName)) return;
        state.events = state.events.map(e => e === ev ? newName : e);
        state.attendance = state.attendance.map(a => (a.event === ev ? { ...a, event: newName } : a));
        saveAll();
        renderAttendanceEventSelect();
        renderEventList();
        renderAttendanceSummary();
      };
      delBtn.onclick = () => {
        if (!confirm(`ลบกิจกรรม "${ev}" ?`)) return;
        state.events = state.events.filter(e => e !== ev);
        saveAll();
        renderAttendanceEventSelect();
        renderEventList();
        renderAttendanceSummary();
      };

      row.appendChild(nameSpan);
      row.appendChild(nameInput);
      row.appendChild(editBtn);
      row.appendChild(saveBtn);
      row.appendChild(cancelBtn);
      row.appendChild(delBtn);
      listEl.appendChild(row);
    });
  }

  function initRecorderManage() {
    const search = document.getElementById('recorderSearch');
    if (search) search.addEventListener('input', (e) => { renderRecorderSelectList(e.target.value || ''); });
    const showBtn = document.getElementById('showRecorderPanelBtn');
    const hideBtn = document.getElementById('hideRecorderPanelBtn');
    const panel = document.getElementById('recorderManagePanel');
    if (showBtn && hideBtn && panel) {
      showBtn.onclick = () => { panel.style.display = ''; hideBtn.style.display = ''; showBtn.style.display = 'none'; };
      hideBtn.onclick = () => { panel.style.display = 'none'; hideBtn.style.display = 'none'; showBtn.style.display = ''; };
    }
    const selAllBtn = document.getElementById('recorderSelectAllVisibleBtn');
    if (selAllBtn) selAllBtn.onclick = () => {
      const list = document.getElementById('recorderSelectList');
      const preview = document.getElementById('recorderSelectedPreview');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (!cb.checked && preview.querySelectorAll('.sel-item').length < 3) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    };
    const deselBtn = document.getElementById('recorderDeselectAllBtn');
    if (deselBtn) deselBtn.onclick = () => {
      const list = document.getElementById('recorderSelectList');
      const preview = document.getElementById('recorderSelectedPreview');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
      if (preview) preview.innerHTML = '';
    };
    const clrBtn = document.getElementById('recorderClearSelectionBtn');
    if (clrBtn) clrBtn.onclick = () => {
      const list = document.getElementById('recorderSelectList');
      const preview = document.getElementById('recorderSelectedPreview');
      list.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      if (preview) preview.innerHTML = '';
    };
    renderRecorderSelectList('');
    renderRecorderSavedList();
    renderRecorderSavedInline();
    const saveBtn = document.getElementById('saveRecorderListBtn');
    if (saveBtn) saveBtn.onclick = () => {
      const msg = document.getElementById('saveRecorderMsg');
      const preview = document.getElementById('recorderSelectedPreview');
      const ids = Array.from(preview.querySelectorAll('.sel-item')).map(el => el.dataset.memberId).filter(Boolean);
      if (ids.length === 0) { if (msg) { msg.textContent = 'กรุณาเลือกอย่างน้อย 1 คน'; setTimeout(()=>{ msg.textContent=''; },2000); } return; }
      if (ids.length > 3) { if (msg) { msg.textContent = 'เลือกได้สูงสุด 3 คน'; setTimeout(()=>{ msg.textContent=''; },2000); } return; }
      state.recorderIds = ids;
      saveAll();
      renderRecorderSavedList();
      renderRecorderSavedInline();
      if (showBtn && hideBtn && panel) { panel.style.display = 'none'; hideBtn.style.display = 'none'; showBtn.style.display = ''; }
      if (msg) { msg.textContent = 'บันทึกรายชื่อแล้ว'; setTimeout(()=>{ msg.textContent=''; },2000); }
    };
  }

  function renderRecorderSelectList(filter = '') {
    const container = document.getElementById('recorderSelectList');
    if (!container) return;
    container.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();
    state.members
      .filter(m => m.name.toLowerCase().includes(kw))
      .sort((a,b) => collatorTh.compare(a.name, b.name))
      .forEach(m => {
        const row = document.createElement('div');
        row.className = 'member-item';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.dataset.memberId = m.id;
        chk.id = `rec_${m.id}`;
        const label = document.createElement('label');
        label.textContent = m.name;
        label.htmlFor = chk.id;
        row.appendChild(chk);
        row.appendChild(label);
        container.appendChild(row);
      });
    container.onchange = (e) => {
      if (e.target && e.target.type === 'checkbox') {
        const memId = e.target.dataset.memberId;
        const mem = getMemberById(memId);
        const preview = document.getElementById('recorderSelectedPreview');
        const existing = preview.querySelector(`.sel-item[data-member-id="${memId}"]`);
        if (e.target.checked) {
          if (existing) return;
          if (preview.querySelectorAll('.sel-item').length >= 3) {
            e.target.checked = false;
            const msg = document.getElementById('saveRecorderMsg');
            if (msg) { msg.textContent = 'เลือกได้สูงสุด 3 คน'; setTimeout(()=>{ msg.textContent=''; },2000); }
            return;
          }
          const item = document.createElement('div');
          item.className = 'sel-item';
          item.dataset.memberId = memId;
          item.innerHTML = `<strong>${mem ? mem.name : ''}</strong> <button class="removeSel" style="margin-left:8px;">เอาออก</button>`;
          preview.appendChild(item);
          item.querySelector('.removeSel').addEventListener('click', () => {
            const chk = container.querySelector(`input[type="checkbox"][data-member-id="${memId}"]`);
            if (chk) chk.checked = false;
            item.remove();
          });
        } else {
          if (existing) existing.remove();
        }
      }
    };
    container.onclick = (e) => {
      const item = e.target.closest('.member-item');
      if (!item) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'label') return;
      const cb = item.querySelector('input[type="checkbox"]');
      if (!cb) return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }

  function renderRecorderSavedList() {
    const box = document.getElementById('recorderSavedList');
    if (!box) return;
    box.innerHTML = '';
    const ids = Array.isArray(state.recorderIds) ? state.recorderIds.slice(0,3) : [];
    ids.forEach(id => {
      const m = getMemberById(id);
      const item = document.createElement('div');
      item.className = 'sel-item';
      item.dataset.memberId = id;
      item.innerHTML = `<strong>${m ? m.name : ''}</strong> <button class="removeSel" style="margin-left:8px;">เอาออก</button>`;
      box.appendChild(item);
      item.querySelector('.removeSel').addEventListener('click', () => {
        state.recorderIds = ids.filter(x => x !== id);
        saveAll();
        renderRecorderSavedList();
        renderRecorderSavedInline();
      });
    });
    if (ids.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'note-text';
      hint.textContent = 'ยังไม่มีรายชื่อผู้บันทึกที่บันทึกไว้';
      box.appendChild(hint);
    }
  }

  function renderRecorderSavedInline() {
    const box = document.getElementById('recorderSavedInline');
    if (!box) return;
    box.innerHTML = '';
    const ids = Array.isArray(state.recorderIds) ? state.recorderIds.slice(0,3) : [];
    ids.forEach(id => {
      const m = getMemberById(id);
      const span = document.createElement('span');
      span.className = 'badge';
      span.textContent = m ? m.name : '';
      box.appendChild(span);
    });
    if (ids.length === 0) {
      const hint = document.createElement('span');
      hint.className = 'note-text';
      hint.textContent = 'ยังไม่ได้ตั้งรายชื่อ';
      box.appendChild(hint);
    }
  }
  function renderAttendanceMemberSelectList(filter = '') {
    const container = document.getElementById('attendanceMemberSelectList');
    if (!container) return;
    container.innerHTML = '';
    const kw = (filter || '').trim().toLowerCase();
    state.members
      .filter(m => m.name.toLowerCase().includes(kw))
      .sort((a,b) => collatorTh.compare(a.name, b.name))
      .forEach(m => {
        const row = document.createElement('div');
        row.className = 'member-item';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.dataset.memberId = m.id;
        chk.id = `attmem_${m.id}`;
        const label = document.createElement('label');
        label.textContent = m.name;
        label.htmlFor = chk.id;
        row.appendChild(chk);
        row.appendChild(label);
        container.appendChild(row);
      });
    container.onchange = (e) => {
      if (e.target && e.target.type === 'checkbox') {
        const memId = e.target.dataset.memberId;
        const mem = getMemberById(memId);
        const selectedBox = document.getElementById('attendanceSelectedMembers');
        const existing = selectedBox.querySelector(`.sel-item[data-member-id="${memId}"]`);
        if (e.target.checked) {
          if (existing) return;
          const item = document.createElement('div');
          item.className = 'sel-item';
          item.dataset.memberId = memId;
          item.innerHTML = `<strong>${mem ? mem.name : ''}</strong> <button class="removeSel" style="margin-left:8px;">เอาออก</button>`;
          selectedBox.appendChild(item);
          item.querySelector('.removeSel').addEventListener('click', () => {
            const chk = container.querySelector(`input[type="checkbox"][data-member-id="${memId}"]`);
            if (chk) chk.checked = false;
            item.remove();
          });
        } else {
          if (existing) existing.remove();
        }
      }
    };
    container.onclick = (e) => {
      const item = e.target.closest('.member-item');
      if (!item) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'label') return;
      const cb = item.querySelector('input[type="checkbox"]');
      if (!cb) return;
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }

  function initPointsTab() {
    const loginBtn = document.getElementById('pointsLoginBtn');
    if (loginBtn) loginBtn.onclick = () => {
      const user = (document.getElementById('pointsLoginUser')?.value || '').trim();
      const pass = (document.getElementById('pointsLoginPass')?.value || '').trim();
      const msg = document.getElementById('pointsLoginMsg');
      if (!user) { if (msg) msg.textContent = 'กรุณาใส่ผู้ใช้'; return; }
      if (!pass) { if (msg) msg.textContent = 'กรุณาใส่รหัสผ่าน'; return; }
      if (user !== POINTS_ADMIN_USER || pass !== POINTS_ADMIN_PASS) { if (msg) msg.textContent = 'ผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'; return; }
      localStorage.setItem(STORAGE_KEYS.auth, '1');
      localStorage.setItem('points_user', POINTS_ADMIN_USER);
      state.auth.loggedIn = true; state.auth.user = POINTS_ADMIN_USER;
      togglePointsAuthUI();
      renderSimplePointsUI();
      const b = document.getElementById('applyRangeToClanBtn');
      if (b) b.style.display = '';
      if (msg) msg.textContent = '';
    };

    const logoutBtn = document.getElementById('pointsLogoutBtn');
    if (logoutBtn) logoutBtn.onclick = () => {
      localStorage.removeItem(STORAGE_KEYS.auth);
      localStorage.removeItem('points_user');
      state.auth.loggedIn = false; state.auth.user = '';
      togglePointsAuthUI();
    };

    const addBtn = document.getElementById('addPointsBtn');
    const dedBtn = document.getElementById('deductPointsBtn');
    const clrBtn = document.getElementById('clearPointsBtn');
    const clrByMemberBtn = document.getElementById('clearPointsByMemberBtn');
    const clrByDateBtn = document.getElementById('clearPointsByDateBtn');
    if (addBtn) addBtn.onclick = () => {
      if (!state.auth.loggedIn) return;
      const memId = document.getElementById('pointsMemberSelectAdjust')?.value || '';
      const amt = parseInt(document.getElementById('pointsAdjustAmount')?.value || '0', 10);
      const note = (document.getElementById('pointsAdjustNote')?.value || '').trim();
      if (!memId || amt <= 0) return;
      state.ledger.push({ id: uid('txn'), date: todayStr(), type: 'adjust_add', memberId: memId, points: amt, note });
      saveAll();
      const mem = getMemberById(memId); appendPointsLog('add', `ADD ${amt} to ${mem ? mem.name : memId}${note ? ' — ' + note : ''}`);
      renderPointsBalance();
    };
    if (dedBtn) dedBtn.onclick = () => {
      if (!state.auth.loggedIn) return;
      const memId = document.getElementById('pointsMemberSelectAdjust')?.value || '';
      const amt = parseInt(document.getElementById('pointsAdjustAmount')?.value || '0', 10);
      const note = (document.getElementById('pointsAdjustNote')?.value || '').trim();
      if (!memId || amt <= 0) return;
      state.ledger.push({ id: uid('txn'), date: todayStr(), type: 'adjust_deduct', memberId: memId, points: -amt, note });
      saveAll();
      const mem = getMemberById(memId); appendPointsLog('deduct', `DEDUCT ${amt} from ${mem ? mem.name : memId}${note ? ' — ' + note : ''}`);
      renderPointsBalance();
    };
    if (clrBtn) clrBtn.onclick = () => {
      if (!state.auth.loggedIn) return;
      if (!confirm('ยืนยันล้างคะแนนทั้งหมด?')) return;
      state.ledger = [];
      saveAll();
      appendPointsLog('clear', 'CLEAR all clan points');
      renderPointsBalance();
    };
    if (clrByMemberBtn) clrByMemberBtn.onclick = () => {
      if (!state.auth.loggedIn) return;
      const memId = document.getElementById('pointsMemberSelectClear')?.value || '';
      if (!memId) return;
      if (!confirm('ยืนยันล้างคะแนนเฉพาะสมาชิกนี้?')) return;
      const mem = getMemberById(memId);
      state.ledger = state.ledger.filter(l => l.memberId !== memId);
      saveAll();
      appendPointsLog('clearMember', `CLEAR member: ${mem ? mem.name : memId}`);
      renderPointsBalance();
    };
    if (clrByDateBtn) clrByDateBtn.onclick = () => {
      if (!state.auth.loggedIn) return;
      const start = document.getElementById('clearStartDate')?.value || '';
      const end = document.getElementById('clearEndDate')?.value || '';
      if (!start && !end) return;
      if (!confirm('ยืนยันล้างคะแนนตามช่วงวันที่ที่เลือก?')) return;
      state.ledger = state.ledger.filter(l => !isDateInRange(l.date || '', start, end));
      saveAll();
      appendPointsLog('clearDate', `CLEAR by date: ${start || '-'} to ${end || '-'}`);
      renderPointsBalance();
    };

    const exportPointsBtn = document.getElementById('exportClanPointsJsonBtn');
    const importPointsBtn = document.getElementById('importClanPointsJsonBtn');
    const importPointsInput = document.getElementById('importClanPointsJsonInput');
    if (exportPointsBtn) exportPointsBtn.onclick = () => exportClanPointsJson();
    if (importPointsBtn && importPointsInput) {
      importPointsBtn.onclick = () => importPointsInput.click();
      importPointsInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImportClanPointsJsonFile(file);
        importPointsInput.value = '';
      });
    }

    togglePointsAuthUI();
    if (state.auth.loggedIn) renderSimplePointsUI();
  }

  function initAttendanceTab() {
    initAttendanceControls();
    renderAttendanceSummary();
  }

  function renderAttendanceSummary() {
    const start = document.getElementById('attStartDate')?.value || '';
    const end = document.getElementById('attEndDate')?.value || '';
    const tbody = document.querySelector('#attendanceMemberTotalsTable tbody');
    const thead = document.querySelector('#attendanceMemberTotalsTable thead');
    if (!tbody) return;
    tbody.innerHTML = '';
    const EVENTS = state.events && state.events.length ? state.events : ['VEPRA','BOSS-RUSH','DRAGONBEST-INVA','ORFEN-INVA','CATACOM'];
    if (thead) {
      thead.innerHTML = '';
      const trh = document.createElement('tr');
      trh.innerHTML = `<th>สมาชิก</th>` + EVENTS.map(e => `<th>${e}</th>`).join('') + `<th>รวม</th>`;
      thead.appendChild(trh);
    }
    const rows = state.members.map(m => ({
      memberId: m.id,
      name: m.name,
      counts: EVENTS.reduce((acc,e)=>{acc[e]=0; return acc;}, {})
    }));

    state.attendance
      .filter(a => isDateInRange(a.date || '', start, end))
      .forEach(a => {
        const row = rows.find(r => r.memberId === a.memberId);
        if (!row) return;
        if (EVENTS.includes(a.event)) row.counts[a.event] += 1;
      });

    rows.sort((a,b) => collatorTh.compare(a.name, b.name)).forEach(r => {
      const total = EVENTS.reduce((s,e)=> s + (r.counts[e]||0), 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.name}</td>`+
        EVENTS.map(e => `<td>${r.counts[e] || 0}</td>`).join('')+
        `<td>${total}</td>`;
      tbody.appendChild(tr);
    });
  }


  function computeTotals() {
    const perMember = new Map();          // memberId -> {kills, points}
    const pivot = new Map();              // bossId -> memberId -> count
    const pointsByBossBuffed = new Map(); // bossId -> total points (buffed)

    state.hunts.forEach(h => {
      const boss = getBossById(h.bossId);
      const ppk = boss ? boss.points : 0;

      if (!pivot.has(h.bossId)) pivot.set(h.bossId, new Map());
      if (!pointsByBossBuffed.has(h.bossId)) pointsByBossBuffed.set(h.bossId, 0);

      h.entries.forEach(en => {
        const cnt = en.count || 0;
        const mult = getTotalBuffMultiplier(en.memberId, h.date);

        // per member totals
        const cur = perMember.get(en.memberId) || { kills: 0, points: 0 };
        cur.kills += cnt;
        cur.points += Math.round(cnt * ppk * mult);
        perMember.set(en.memberId, cur);

        // pivot count
        const mp = pivot.get(h.bossId);
        const cur2 = mp.get(en.memberId) || 0;
        mp.set(en.memberId, cur2 + cnt);

        // per boss buffed points
        const curBossPts = pointsByBossBuffed.get(h.bossId) || 0;
        pointsByBossBuffed.set(h.bossId, curBossPts + Math.round(cnt * ppk * mult));
      });
    });

    const killsByDateMember = new Map(); // date -> Map(memberId -> kills)
    state.hunts.forEach(h => {
      const mp = killsByDateMember.get(h.date) || new Map();
      h.entries.forEach(en => {
        const cnt = en.count || 0;
        mp.set(en.memberId, (mp.get(en.memberId) || 0) + cnt);
      });
      killsByDateMember.set(h.date, mp);
    });
    const maxKillsByDate = new Map();
    killsByDateMember.forEach((mp, date) => {
      let max = 0;
      mp.forEach(v => { if (v > max) max = v; });
      maxKillsByDate.set(date, max);
    });
    const topKillersByDate = new Map(); // date -> Set(memberId)
    killsByDateMember.forEach((mp, date) => {
      const max = maxKillsByDate.get(date) || 0;
      const set = new Set();
      mp.forEach((v, memId) => { if (v === max && max > 0) set.add(memId); });
      topKillersByDate.set(date, set);
    });

    // สร้างแผนที่คะแนนต่อวัน เพื่อหา Top points ของวัน
    const pointsByDateMember = new Map(); // date -> Map(memberId -> points)
    state.hunts.forEach(h => {
      const boss = getBossById(h.bossId);
      const ppk = boss ? boss.points : 0;
      const mp = pointsByDateMember.get(h.date) || new Map();
      h.entries.forEach(en => {
        const cnt = en.count || 0;
        const mult = getTotalBuffMultiplier(en.memberId, h.date);
        const pts = Math.round(cnt * ppk * mult);
        mp.set(en.memberId, (mp.get(en.memberId) || 0) + pts);
      });
      pointsByDateMember.set(h.date, mp);
    });
    const maxPointsByDate = new Map();
    pointsByDateMember.forEach((mp, date) => {
      let max = 0;
      mp.forEach(v => { if (v > max) max = v; });
      maxPointsByDate.set(date, max);
    });
    const topPointsByDate = new Map(); // date -> Set(memberId)
    pointsByDateMember.forEach((mp, date) => {
      const max = maxPointsByDate.get(date) || 0;
      const set = new Set();
      mp.forEach((v, memId) => { if (v === max && max > 0) set.add(memId); });
      topPointsByDate.set(date, set);
    });

    const recorderIds = Array.isArray(state.recorderIds) ? state.recorderIds.slice(0,3) : [];
    killsByDateMember.forEach((mp, date) => {
      const topKills = maxKillsByDate.get(date) || 0;
      if (topKills <= 0) return;
      const topSet = topKillersByDate.get(date) || new Set();
      const ptsMap = pointsByDateMember.get(date) || new Map();
      const recTops = recorderIds.filter(id => topSet.has(id));
      if (recTops.length === 0) return; // apply override only if a recorder is among daily top killers
      let desiredPts = 0;
      recTops.forEach(id => { const v = ptsMap.get(id) || 0; if (v > desiredPts) desiredPts = v; });
      recorderIds.forEach(rid => {
        const actualKills = mp.get(rid) || 0;
        const actualPts = ptsMap.get(rid) || 0;
        const dk = topKills - actualKills;
        const dp = desiredPts - actualPts;
        if (dk !== 0 || dp !== 0) {
          const cur = perMember.get(rid) || { kills: 0, points: 0 };
          cur.kills += dk;
          cur.points += dp;
          perMember.set(rid, cur);
        }
      });
    });

    return { perMember, pivot, pointsByBossBuffed };
  }

  function renderDashboardCharts() {
    const { perMember } = computeTotals();
    const rowsAll = state.members.map(m => {
      const s = perMember.get(m.id) || { kills: 0, points: 0 };
      const ledgerPts = state.ledger.filter(l => l.memberId === m.id).reduce((sum, l) => sum + (l.points || 0), 0);
      return { name: m.name, kills: s.kills, points: ledgerPts };
    }).sort((a,b) => collatorTh.compare(a.name, b.name));
    const labelsKills = rowsAll.map(r => r.name);
    const killsData = rowsAll.map(r => r.kills);
    const labelsPoints = rowsAll.map(r => r.name);
    const pointsData = rowsAll.map(r => r.points);
    const topKills = [...rowsAll].sort((a,b) => b.kills - a.kills).slice(0, 3);
    const topPoints = [...rowsAll].sort((a,b) => b.points - a.points).slice(0, 3);
    const ctxKills = document.getElementById('memberKillsChart');
    const ctxPoints = document.getElementById('memberPointsChart');
    if (!ctxKills || !ctxPoints || !window.Chart) return;
    if (charts.kills) charts.kills.destroy();
    if (charts.points) charts.points.destroy();
    const perBar = 50;
    const wKills = Math.max((labelsKills.length || 1) * perBar, ctxKills.parentElement ? ctxKills.parentElement.clientWidth : 600);
    const wPoints = Math.max((labelsPoints.length || 1) * perBar, ctxPoints.parentElement ? ctxPoints.parentElement.clientWidth : 600);
    ctxKills.style.width = wKills + 'px';
    ctxPoints.style.width = wPoints + 'px';
    charts.kills = new Chart(ctxKills, {
      type: 'bar',
      data: { labels: labelsKills, datasets: [{ label: 'Kills', data: killsData, backgroundColor: '#38bdf8' }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#e5e7eb', font: { size: 12 } } }, y: { ticks: { color: '#9ca3af' } } }, plugins: { barValueLabels: { formatter: v => Number(v).toLocaleString() } } }
    });
    charts.points = new Chart(ctxPoints, {
      type: 'bar',
      data: { labels: labelsPoints, datasets: [{ label: 'Total Points', data: pointsData, backgroundColor: '#22c55e' }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#e5e7eb', font: { size: 12 } } }, y: { ticks: { color: '#9ca3af', callback: v => Number(v).toLocaleString() } } }, plugins: { barValueLabels: { formatter: v => Number(v).toLocaleString() } } }
    });
    const killsRankEl = document.getElementById('killsTopRank');
    const pointsRankEl = document.getElementById('pointsTopRank');
    if (killsRankEl) {
      killsRankEl.innerHTML = `<div class="rank-header">Top by kills</div><ol class="rank-list">${topKills.map((r,i) => `<li><span class=\"rank-num\">${i+1}</span><span class=\"rank-name\">${r.name}</span><span class=\"rank-value\">${r.kills}</span></li>`).join('')}</ol>`;
    }
    if (pointsRankEl) {
      pointsRankEl.innerHTML = `<div class="rank-header">Top by points</div><ol class="rank-list">${topPoints.map((r,i) => `<li><span class=\"rank-num\">${i+1}</span><span class=\"rank-name\">${r.name}</span><span class=\"rank-value\">${Number(r.points).toLocaleString()}</span></li>`).join('')}</ol>`;
    }
  }

  function initDashboardTab() {
    const resetBtn = document.getElementById('resetHuntsAccumBtnDashboard');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.dashboardCounters.huntsAccum = 0;
        saveAll();
        updateDashboardStats();
        renderDashboardCharts();
      });
    }
  }

  function cellTh(text) {
    const th = document.createElement('th'); th.textContent = text; return th;
  }
  function cellTd(text) {
    const td = document.createElement('td'); td.textContent = text; return td;
  }

  function renderSummaryTables() {
    const { perMember, pivot, pointsByBossBuffed } = computeTotals();

    // Totals per member — แบ่งคอลัมน์ละ 25 แถว
    const perMemberContainer = document.querySelector('#totalsPerMemberContainer');
    if (perMemberContainer) {
      perMemberContainer.innerHTML = '';
      const rows = state.members.map(m => {
        const s = perMember.get(m.id) || { kills: 0, points: 0 };
        return { name: m.name, kills: s.kills, points: s.points };
      }).sort((a,b) => collatorTh.compare(a.name, b.name));

      for (let i = 0; i < rows.length; i += 25) {
        const tbl = document.createElement('table');
        tbl.className = 'table';
        tbl.innerHTML = `<thead><tr><th>สมาชิก</th><th>จำนวนที่ล่ารวม</th><th>คะแนนรวม</th></tr></thead><tbody></tbody>`;
        const tb = tbl.querySelector('tbody');
        rows.slice(i, i + 25).forEach(r => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${r.name}</td><td>${r.kills}</td><td>${r.points}</td>`;
          tb.appendChild(tr);
        });
        // แสดงรวมทั้งหมดเฉพาะในตารางสุดท้าย
        if (i + 25 >= rows.length) {
          let grandKills = 0, grandPoints = 0;
          state.members.forEach(m => {
            const s = perMember.get(m.id) || { kills: 0, points: 0 };
            grandKills += s.kills;
            grandPoints += s.points;
          });
          const trTotal = document.createElement('tr');
          trTotal.className = 'summary-total-row';
          trTotal.innerHTML = `<td>รวมทั้งหมด</td><td>${grandKills}</td><td>${grandPoints}</td>`;
          tb.appendChild(trTotal);
        }
        perMemberContainer.appendChild(tbl);
      }
    }

    // Pivot Boss x Member — หัวและข้อมูลเรียงตรงกัน
    const pivotTableHead = document.querySelector('#pivotBossMemberTable thead');
    const pivotTableBody = document.querySelector('#pivotBossMemberTable tbody');
    if (pivotTableHead && pivotTableBody) {
      pivotTableHead.innerHTML = '';
      pivotTableBody.innerHTML = '';
      const membersSorted = state.members.slice().sort((a,b) => collatorTh.compare(a.name, b.name));
      const hdrTr = document.createElement('tr');
      hdrTr.appendChild(cellTh('บอส'));
      membersSorted.forEach(m => hdrTr.appendChild(cellTh(m.name)));
      // ไม่มีคอลัมน์รวมทางขวา
      pivotTableHead.appendChild(hdrTr);
    
      const bossesSorted = state.bosses.slice().sort((a,b) => collatorTh.compare(a.name, b.name));
      bossesSorted.forEach(boss => {
        const tr = document.createElement('tr');
        tr.appendChild(cellTd(boss.name));
        const mp = pivot.get(boss.id) || new Map();
    
        // แสดงเฉพาะจำนวนต่อสมาชิก ไม่ใส่คอลัมน์รวมทางขวา
        membersSorted.forEach(m => {
          const count = mp.get(m.id) || 0;
          tr.appendChild(cellTd(count));
        });
    
        pivotTableBody.appendChild(tr);
      });
    
      // เพิ่มแถวสรุปล่างสุด: รวมจำนวนต่อสมาชิก
      const totalKillsRow = document.createElement('tr');
      totalKillsRow.className = 'summary-total-row';
      totalKillsRow.appendChild(cellTd('รวมจำนวน'));
      membersSorted.forEach(m => {
        let memberTotal = 0;
        bossesSorted.forEach(boss => {
          const mp = pivot.get(boss.id) || new Map();
          memberTotal += (mp.get(m.id) || 0);
        });
        totalKillsRow.appendChild(cellTd(memberTotal));
      });
      pivotTableBody.appendChild(totalKillsRow);
    
      // เพิ่มแถวสรุปล่างสุด: รวมคะแนนต่อสมาชิก
      const totalPointsRow = document.createElement('tr');
      totalPointsRow.className = 'summary-total-row';
      totalPointsRow.appendChild(cellTd('รวมคะแนน'));
      membersSorted.forEach(m => {
        const s = perMember.get(m.id) || { kills: 0, points: 0 };
        totalPointsRow.appendChild(cellTd(s.points));
      });
      pivotTableBody.appendChild(totalPointsRow);
    }

    // export preview table (Hunt Log)
    const exportBody = document.querySelector('#exportLogTable tbody');
    if (exportBody) {
      exportBody.innerHTML = '';
      const logRows = [];
      state.hunts.forEach(h => {
        const boss = getBossById(h.bossId);
        const ppk = boss ? boss.points : 0;
        h.entries.forEach(en => {
          const mem = getMemberById(en.memberId);
          const mult = getTotalBuffMultiplier(en.memberId, h.date);
          logRows.push({
            date: h.date,
            boss: boss ? boss.name : '(ถูกลบ)',
            member: mem ? mem.name : '(ถูกลบ)',
            count: en.count || 0,
            ppk,
            total: Math.round((en.count || 0) * ppk * mult),
          });
        });
      });
      logRows.sort((a,b) => b.date.localeCompare(a.date));
      logRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.date}</td><td>${r.boss}</td><td>${r.member}</td><td>${r.count}</td><td>${r.ppk}</td><td>${r.total}</td>`;
        exportBody.appendChild(tr);
      });
    }
  }

  function exportExcel() {
    try {
      const wb = XLSX.utils.book_new();
      const optDailySheets = document.getElementById('optDailySheets')?.checked ?? true;
      const optDailyPivot = document.getElementById('optDailyPivot')?.checked ?? true;
      const optBossTotals = document.getElementById('optBossTotals')?.checked ?? true;
      const optAutoFilter = document.getElementById('optAutoFilter')?.checked ?? true;
  
      // Sheet 1: Hunt Log — คะแนนรวมคิดบัพรายบุคคล
      const logData = [['Date','Boss','Member','Count','Points/kill','Total Points']];
      state.hunts.forEach(h => {
        const boss = getBossById(h.bossId);
        const ppk = boss ? boss.points : 0;
        h.entries.forEach(en => {
          const mem = getMemberById(en.memberId);
          const mult = getTotalBuffMultiplier(en.memberId, h.date);
          logData.push([
            h.date,
            boss ? boss.name : '(ถูกลบ)',
            mem ? mem.name : '(ถูกลบ)',
            en.count || 0,
            ppk,
            Math.round((en.count || 0) * ppk * mult),
          ]);
        });
      });
      const wsLog = XLSX.utils.aoa_to_sheet(logData);
      wsLog['!cols'] = [{wch:12},{wch:18},{wch:18},{wch:10},{wch:12},{wch:14}];
      if (optAutoFilter) wsLog['!autofilter'] = { ref: `A1:F${logData.length}` };
      XLSX.utils.book_append_sheet(wb, wsLog, 'Hunt Log');
  
      // Sheet 2: Pivot (บอส x สมาชิก) — ไม่มีคอลัมน์รวมทางขวา, ใช้แถวสรุปล่างสุด
      const membersSorted = state.members.slice().sort((a, b) => collatorTh.compare(a.name, b.name));
      const pivotHdr = ['Boss', ...membersSorted.map(m => m.name)];
      const pivotData = [pivotHdr];
      const { pivot, perMember, pointsByBossBuffed } = computeTotals();
      const bossesSorted = state.bosses.slice().sort((a, b) => collatorTh.compare(a.name, b.name));
      bossesSorted.forEach(boss => {
        const mp = pivot.get(boss.id) || new Map();
        const row = [boss.name];
      membersSorted.forEach(m => {
        const count = mp.get(m.id) || 0;
        row.push(count);
      });
      pivotData.push(row);
      });
  
      // แถวสรุปท้ายตาราง: รวมจำนวนต่อสมาชิก (แนวนอน)
      const totalKillsRow = ['รวมจำนวน'];
      membersSorted.forEach(m => {
        let memberTotal = 0;
        bossesSorted.forEach(boss => {
          const mp = pivot.get(boss.id) || new Map();
          memberTotal += (mp.get(m.id) || 0);
        });
        totalKillsRow.push(memberTotal);
      });
      pivotData.push(totalKillsRow);
  
      // แถวสรุปท้ายตาราง: รวมคะแนนต่อสมาชิก (แนวนอน)
      const totalPointsRow = ['รวมคะแนน'];
      membersSorted.forEach(m => {
        const s = perMember.get(m.id) || { kills: 0, points: 0 };
        totalPointsRow.push(s.points);
      });
      pivotData.push(totalPointsRow);
  
      const wsPivot = XLSX.utils.aoa_to_sheet(pivotData);
      wsPivot['!cols'] = [{wch:12}, ...membersSorted.map(() => ({wch:10}))];
      if (optAutoFilter) wsPivot['!autofilter'] = { ref: `A1:${String.fromCharCode(65 + membersSorted.length)}${pivotData.length}` };
      XLSX.utils.book_append_sheet(wb, wsPivot, 'Boss x Member');
  
      // Sheet 3: Totals per Member — เพิ่มแถวรวมทั้งหมดล่างสุด
      const totalsData = [['สมาชิก','จำนวนที่ล่ารวม','คะแนนรวม']];
      let grandKills = 0, grandPoints = 0;
      membersSorted.forEach(m => {
        const s = perMember.get(m.id) || { kills: 0, points: 0 };
        grandKills += s.kills;
        grandPoints += s.points;
        totalsData.push([m.name, s.kills, s.points]);
      });
      totalsData.push(['รวมทั้งหมด', grandKills, grandPoints]);
  
      const wsTotals = XLSX.utils.aoa_to_sheet(totalsData);
      wsTotals['!cols'] = [{wch:18},{wch:14},{wch:14}];
      if (optAutoFilter) wsTotals['!autofilter'] = { ref: `A1:C${totalsData.length}` };
      XLSX.utils.book_append_sheet(wb, wsTotals, 'Totals');

      if (optBossTotals) {
        const bossTotalsData = [['บอส','จำนวนรวม','คะแนนรวม']];
        bossesSorted.forEach(boss => {
          const mp2 = pivot.get(boss.id) || new Map();
          let totalKills = 0; mp2.forEach(v => totalKills += v);
          const totalPts = pointsByBossBuffed.get(boss.id) || 0;
          bossTotalsData.push([boss.name, totalKills, totalPts]);
        });
        const wsBoss = XLSX.utils.aoa_to_sheet(bossTotalsData);
        wsBoss['!cols'] = [{wch:18},{wch:12},{wch:14}];
        if (optAutoFilter) wsBoss['!autofilter'] = { ref: `A1:C${bossTotalsData.length}` };
        XLSX.utils.book_append_sheet(wb, wsBoss, 'Boss Totals');
      }
      
      // เพิ่มชีต Pivot รายวัน (บอส x สมาชิก) — ใช้ชื่อตัวแปรใหม่เพื่อหลีกเลี่ยงชนกัน
      const uniqueDates = Array.from(new Set(state.hunts.map(h => h.date))).sort();
      if (optDailyPivot && uniqueDates.length > 0) {
        const membersSortedDaily = state.members.slice().sort((a, b) => collatorTh.compare(a.name, b.name));
        const bossesSortedDaily = state.bosses.slice().sort((a, b) => collatorTh.compare(a.name, b.name));

        uniqueDates.forEach(date => {
          const pivotDate = new Map();              // bossId -> (memberId -> count)
          const perMemberPointsDate = new Map();    // memberId -> points (buffed) ในวันนั้น

          state.hunts
            .filter(h => h.date === date)
            .forEach(h => {
              const boss = getBossById(h.bossId);
              const ppk = boss ? boss.points : 0;
              if (!pivotDate.has(h.bossId)) pivotDate.set(h.bossId, new Map());

              h.entries.forEach(en => {
                const cnt = en.count || 0;

                // นับจำนวน
                const mp = pivotDate.get(h.bossId);
                mp.set(en.memberId, (mp.get(en.memberId) || 0) + cnt);

                // คิดคะแนน (รวมบัพ) ต่อสมาชิก
                const mult = getTotalBuffMultiplier(en.memberId, h.date);
                const pts = Math.round(cnt * ppk * mult);
                perMemberPointsDate.set(en.memberId, (perMemberPointsDate.get(en.memberId) || 0) + pts);
              });
            });

          // จัดทำตาราง Pivot สำหรับวันนั้น
          const pivotHdrDate = ['บอส', ...membersSortedDaily.map(m => m.name)];
          const pivotDataDate = [pivotHdrDate];

          bossesSortedDaily.forEach(boss => {
            const row = [boss.name];
            const mp = pivotDate.get(boss.id) || new Map();
            membersSortedDaily.forEach(m => {
              row.push(mp.get(m.id) || 0);
            });
            pivotDataDate.push(row);
          });

          // สรุป: รวมจำนวนต่อสมาชิก
          const totalKillsRowDate = ['รวมจำนวน'];
          membersSortedDaily.forEach(m => {
            let memberTotal = 0;
            bossesSortedDaily.forEach(boss => {
              const mp = pivotDate.get(boss.id) || new Map();
              memberTotal += (mp.get(m.id) || 0);
            });
            totalKillsRowDate.push(memberTotal);
          });
          pivotDataDate.push(totalKillsRowDate);

          // สรุป: รวมคะแนน (คิดบัพ) ต่อสมาชิก
          const totalPointsRowDate = ['รวมคะแนน'];
          membersSortedDaily.forEach(m => {
            totalPointsRowDate.push(perMemberPointsDate.get(m.id) || 0);
          });
          pivotDataDate.push(totalPointsRowDate);

          const wsPivotDate = XLSX.utils.aoa_to_sheet(pivotDataDate);
          const safeName = `Pivot ${String(date)}`.slice(0, 31).replace(/[:\/?*\[\]]/g, '-');
          XLSX.utils.book_append_sheet(wb, wsPivotDate, safeName);
        });
      }
      
      // เพิ่ม: สร้างชีตแยกตามวันที่
      const huntsByDate = new Map();
      state.hunts.forEach(h => {
        const rows = huntsByDate.get(h.date) || [['วันที่','บอส','สมาชิก','จำนวน','คะแนน/ตัว','คะแนนรวม']];
        const boss = getBossById(h.bossId);
        const ppk = boss ? boss.points : 0;
        h.entries.forEach(en => {
          const mem = getMemberById(en.memberId);
          const mult = getTotalBuffMultiplier(en.memberId, h.date);
          rows.push([
            h.date,
            boss ? boss.name : '(ถูกลบ)',
            mem ? mem.name : '(ถูกลบ)',
            en.count || 0,
            ppk,
            Math.round((en.count || 0) * ppk * mult),
          ]);
        });
        huntsByDate.set(h.date, rows);
      });
      if (optDailySheets) huntsByDate.forEach((rows, date) => {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        // ชื่อชีตต้องสั้นและไม่มีอักขระต้องห้ามใน Excel
        const safeName = String(date).slice(0, 31).replace(/[:\/?*\[\]]/g, '-');
        XLSX.utils.book_append_sheet(wb, ws, safeName);
      });
  
      const latest = state.hunts.reduce((acc, h) => {
        const ts = Number(String(h.id || '').split('_')[1]) || 0;
        return (!acc || ts > acc.ts) ? { h, ts } : acc;
      }, null);
      const lastBossName = latest ? (getBossById(latest.h.bossId)?.name || 'report') : 'report';
      const dateStr = latest ? latest.h.date : todayStr();
      const dt = new Date(latest ? latest.ts : Date.now());
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      const safeBoss = String(lastBossName).trim().replace(/[^\wก-๙ \-]/g, '').replace(/\s+/g, '_');
      const fileName = `${safeBoss}_${dateStr}_${hh}-${mm}.xlsx`;
      XLSX.writeFile(wb, fileName);
      document.getElementById('exportMsg').textContent = 'ส่งออก Excel เรียบร้อย';
    } catch (e) {
      console.error(e);
      document.getElementById('exportMsg').textContent = 'ส่งออก Excel ไม่สำเร็จ';
    }
  }

  function exportCsv() {
    const rows = [['Date','Boss','Member','Count','Points/kill','Total Points']];
    state.hunts.forEach(h => {
      const boss = getBossById(h.bossId);
      const ppk = boss ? boss.points : 0;
      h.entries.forEach(en => {
        const mem = getMemberById(en.memberId);
        const mult = getTotalBuffMultiplier(en.memberId, h.date);
        rows.push([
          h.date,
          boss ? boss.name : '(ถูกลบ)',
          mem ? mem.name : '(ถูกลบ)',
          en.count || 0,
          ppk,
          Math.round((en.count || 0) * ppk * mult),
        ]);
      });
    });

    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boss_hunt_report.csv';
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('exportMsg').textContent = 'Exported CSV successfully';
  }

  function exportJson() {
    const latest = state.hunts.reduce((acc, h) => {
      const ts = Number(String(h.id || '').split('_')[1]) || 0;
      return (!acc || ts > acc.ts) ? { h, ts } : acc;
    }, null);
    const lastBossName = latest ? (getBossById(latest.h.bossId)?.name || 'report') : 'report';
    const lastDate = latest ? latest.h.date : todayStr();
    const dt = new Date(latest ? latest.ts : Date.now());
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const safeBoss = String(lastBossName).trim().replace(/[^\wก-๙ \-]/g, '').replace(/\s+/g, '_');
    const generatedAt = new Date().toISOString();

    const data = {
      meta: { lastBossName, lastDate, lastTime: `${hh}:${mm}`, generatedAt },
      bosses: state.bosses,
      members: state.members,
      hunts: state.hunts,
      ledger: state.ledger,
      attendance: state.attendance,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeBoss}_${lastDate}_${hh}-${mm}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    const msg = document.getElementById('exportMsg');
    if (msg) msg.textContent = 'Exported JSON successfully';
  }

  function handleImportJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.bosses || !data.members || !data.hunts) {
          throw new Error('Invalid JSON file');
        }
        state.bosses = data.bosses;
        state.members = data.members;
        state.hunts = data.hunts;
        state.attendance = Array.isArray(data.attendance) ? data.attendance : [];
        saveAll();
        renderBossManageTable('');
        renderMemberManageTable('');
        renderBossHuntList('');
        renderMemberSelectList('');
        renderHuntLogTable();
        renderSummaryTables();
        renderAttendanceSummary();
        const msg = document.getElementById('exportMsg');
        if (msg) msg.textContent = 'Imported JSON successfully';
      } catch (e) {
        console.error(e);
        const msg = document.getElementById('exportMsg');
        if (msg) msg.textContent = 'Import JSON failed';
      }
    };
    reader.readAsText(file);
  }

  function exportClanPointsJson() {
    if (!state.auth.loggedIn || state.auth.user !== POINTS_ADMIN_USER) {
      const m = document.getElementById('pointsLoginMsg');
      if (m) m.textContent = 'กรุณาเข้าสู่ระบบ (admin) ที่แท็บคะแนนแคลน';
      return;
    }
    const generatedAt = new Date().toISOString();
    const data = { meta: { generatedAt }, ledger: state.ledger };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const timePart = `${p2(now.getHours())}-${p2(now.getMinutes())}-${p2(now.getSeconds())}`;
    const datePart = todayStr();
    a.download = `Points_Update_${timePart}_${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    appendPointsLog('export', `EXPORT clan points JSON — ${state.ledger.length} records`);
  }

  function handleImportClanPointsJsonFile(file) {
    if (!state.auth.loggedIn || state.auth.user !== POINTS_ADMIN_USER) {
      const m = document.getElementById('pointsLoginMsg');
      if (m) m.textContent = 'กรุณาเข้าสู่ระบบ (admin) ที่แท็บคะแนนแคลน';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text);
        const ledger = Array.isArray(data) ? data : (Array.isArray(data.ledger) ? data.ledger : null);
        if (!ledger) throw new Error('invalid');
        state.ledger = ledger;
        saveAll();
        renderPointsBalance();
        appendPointsLog('import', `IMPORT clan points JSON — overwrite ${ledger.length} records`);
      } catch (e) {
        console.error(e);
        appendPointsLog('error', 'นำเข้า JSON คะแนนแคลน ไม่สำเร็จ');
      }
    };
    reader.readAsText(file);
  }

  // Summary & Export helpers
  function parseCsvRow(line) {
    const out = [];
    let i = 0, inQ = false, f = '';
    while (i < line.length) {
      const c = line[i++];
      if (inQ) {
        if (c === '"') {
          if (line[i] === '"') { f += '"'; i++; }
          else { inQ = false; }
        } else { f += c; }
      } else {
        if (c === '"') { inQ = true; }
        else if (c === ',') { out.push(f.trim()); f = ''; }
        else { f += c; }
      }
    }
    out.push(f.trim());
    return out;
  }
  
  function handleImportCsvFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '').replace(/\r\n/g, '\n').trim();
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length <= 1) throw new Error('ไฟล์ว่างหรือไม่มีข้อมูล');
  
        const header = parseCsvRow(lines[0]).map(h => h.trim());
        // รองรับหัวค่อมแบบไทยตาม exportCsv(): วันที่, บอส, สมาชิก, จำนวน, คะแนน/ตัว, คะแนนรวม
        const idx = {
          date: header.findIndex(h => ['วันที่', 'date'].includes(h.toLowerCase())),
          boss: header.findIndex(h => ['บอส', 'boss'].includes(h.toLowerCase())),
          member: header.findIndex(h => ['สมาชิก', 'member'].includes(h.toLowerCase())),
          count: header.findIndex(h => ['จำนวน', 'count'].includes(h.toLowerCase())),
          ppk: header.findIndex(h => ['คะแนน/ตัว', 'ppk', 'points_per_kill'].includes(h.toLowerCase())),
        };
        if (idx.date < 0 || idx.boss < 0 || idx.member < 0 || idx.count < 0) {
          throw new Error('รูปแบบหัวตาราง CSV ไม่ตรงกับที่ระบบส่งออก');
        }
  
        const getBossByName = (name) => state.bosses.find(b => b.name === name) || null;
        const getMemberByName = (name) => state.members.find(m => m.name === name) || null;
  
        const groups = new Map(); // key: `${date}|${bossId}` => {id, date, bossId, entries: []}
        let rowsImported = 0;
  
        for (let i = 1; i < lines.length; i++) {
          const row = parseCsvRow(lines[i]);
          if (!row || row.length === 0) continue;
  
          const date = (row[idx.date] || '').slice(0, 10);
          const bossName = row[idx.boss] || '';
          const memberName = row[idx.member] || '';
          const count = parseInt(row[idx.count] || '0', 10) || 0;
          const ppk = idx.ppk >= 0 ? parseFloat(row[idx.ppk] || '0') || 0 : 0;
  
          if (!date || !bossName || !memberName || count <= 0) continue;
  
          // บอส: หา/สร้าง
          let boss = getBossByName(bossName);
          if (!boss) {
            boss = { id: uid('boss'), name: bossName, points: ppk || 0 };
            state.bosses.push(boss);
          } else if (ppk && boss.points !== ppk) {
            // ถ้าคะแนน/ตัวใน CSV ต่างจากระบบ ปรับให้ตรง CSV เพื่อให้ผลรวมที่นับต่อไม่เพี้ยน
            boss.points = ppk;
          }
  
          // สมาชิก: หา/สร้าง
          let mem = getMemberByName(memberName);
          if (!mem) {
            mem = { id: uid('mem'), name: memberName, buffPercent: 0, buffStartDate: '', buffEndDate: '' };
            state.members.push(mem);
          }
  
          const key = `${date}|${boss.id}`;
          if (!groups.has(key)) {
            groups.set(key, { id: uid('hunt'), date, bossId: boss.id, entries: [] });
          }
          const hunt = groups.get(key);
          const existing = hunt.entries.find(en => en.memberId === mem.id);
          if (existing) existing.count += count;
          else hunt.entries.push({ memberId: mem.id, count });
  
          rowsImported++;
        }
  
        // เพิ่มเข้าฐาน hunts
        groups.forEach(hunt => state.hunts.push(hunt));
        saveAll();
  
        // รีเรนเดอร์
        renderBossHuntList('');
        renderMemberSelectList('');
        renderHuntLogTable();
        renderSummaryTables();
  
        const msg = document.getElementById('exportMsg');
        if (msg) msg.textContent = `นำเข้า CSV เรียบร้อย: ${rowsImported} แถว, ${groups.size} บันทึก`;
      } catch (e) {
        console.error(e);
        const msg = document.getElementById('exportMsg');
        if (msg) msg.textContent = 'นำเข้า CSV ไม่สำเร็จ';
      }
    };
    reader.readAsText(file);
  }
  
  function computeRangeSums(start, end) {
    let kills = 0, points = 0;
    state.hunts.forEach(h => {
      if (start && h.date < start) return;
      if (end && h.date > end) return;
      const boss = getBossById(h.bossId);
      const ppk = boss ? boss.points : 0;
      h.entries.forEach(en => {
        const mult = getTotalBuffMultiplier(en.memberId, h.date);
        const cnt = en.count || 0;
        kills += cnt;
        points += Math.round(cnt * ppk * mult);
      });
    });
    return { kills, points };
  }
  function getWeekRangeToday() {
    const d = new Date();
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const startD = new Date(d);
    startD.setDate(d.getDate() - diff);
    const endD = new Date(startD);
    endD.setDate(startD.getDate() + 6);
    const fmt = x => x.toISOString().slice(0,10);
    return { start: fmt(startD), end: fmt(endD) };
  }
  function initSummaryExport() {
    const excelBtn = document.getElementById('exportExcelBtn');
    const csvBtn = document.getElementById('exportCsvBtn');
    if (excelBtn) excelBtn.addEventListener('click', exportExcel);
    if (csvBtn) csvBtn.addEventListener('click', exportCsv);
  
    const jsonBtn = document.getElementById('exportJsonBtn');
    const importJsonBtn = document.getElementById('importJsonBtn');
    const importJsonInput = document.getElementById('importJsonInput');
    if (jsonBtn) jsonBtn.addEventListener('click', exportJson);
    if (importJsonBtn && importJsonInput) {
      importJsonBtn.addEventListener('click', () => importJsonInput.click());
      importJsonInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImportJsonFile(file);
        importJsonInput.value = '';
      });
    }
  
    const importCsvBtn = document.getElementById('importCsvBtn');
    const importCsvInput = document.getElementById('importCsvInput');
    if (importCsvBtn && importCsvInput) {
      importCsvBtn.addEventListener('click', () => importCsvInput.click());
      importCsvInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImportCsvFile(file);
        importCsvInput.value = '';
      });
    }

    const calcBtn = document.getElementById('calcRangeSummaryBtn');
    if (calcBtn) {
      calcBtn.addEventListener('click', () => {
        const start = document.getElementById('sumStartDate')?.value || '';
        const end = document.getElementById('sumEndDate')?.value || '';
        let totalKills = 0;
        let totalPoints = 0;
        const perBoss = new Map();
        const perMember = new Map();
        state.hunts.forEach(h => {
          if (start && h.date < start) return;
          if (end && h.date > end) return;
          const boss = getBossById(h.bossId);
          const ppk = boss ? boss.points : 0;
          h.entries.forEach(en => {
            const cnt = en.count || 0;
            const mult = getTotalBuffMultiplier(en.memberId, h.date);
            const pts = Math.round(cnt * ppk * mult);
            const mem = getMemberById(en.memberId);
            totalKills += cnt;
            totalPoints += pts;
            const acc = perBoss.get(h.bossId) || { name: boss ? boss.name : '(ถูกลบ)', kills: 0, points: 0 };
            acc.kills += cnt;
            acc.points += pts;
            perBoss.set(h.bossId, acc);
            const accM = perMember.get(en.memberId) || { name: mem ? mem.name : '(ถูกลบ)', kills: 0, points: 0 };
            accM.kills += cnt;
            accM.points += pts;
            perMember.set(en.memberId, accM);
          });
        });

        const killsByDateMember = new Map();
        state.hunts.forEach(h => {
          if (start && h.date < start) return;
          if (end && h.date > end) return;
          const mp = killsByDateMember.get(h.date) || new Map();
          h.entries.forEach(en => {
            const cnt = en.count || 0;
            mp.set(en.memberId, (mp.get(en.memberId) || 0) + cnt);
          });
          killsByDateMember.set(h.date, mp);
        });
        const maxKillsByDate = new Map();
        killsByDateMember.forEach((mp, date) => {
          let max = 0;
          mp.forEach(v => { if (v > max) max = v; });
          maxKillsByDate.set(date, max);
        });
        const topKillersByDate = new Map();
        killsByDateMember.forEach((mp, date) => {
          const max = maxKillsByDate.get(date) || 0;
          const set = new Set();
          mp.forEach((v, memId) => { if (v === max && max > 0) set.add(memId); });
          topKillersByDate.set(date, set);
        });

        const pointsByDateMember = new Map();
        state.hunts.forEach(h => {
          if (start && h.date < start) return;
          if (end && h.date > end) return;
          const boss = getBossById(h.bossId);
          const ppk = boss ? boss.points : 0;
          const mp = pointsByDateMember.get(h.date) || new Map();
          h.entries.forEach(en => {
            const cnt = en.count || 0;
            const mult = getTotalBuffMultiplier(en.memberId, h.date);
            const pts = Math.round(cnt * ppk * mult);
            mp.set(en.memberId, (mp.get(en.memberId) || 0) + pts);
          });
          pointsByDateMember.set(h.date, mp);
        });
        const maxPointsByDate = new Map();
        pointsByDateMember.forEach((mp, date) => {
          let max = 0;
          mp.forEach(v => { if (v > max) max = v; });
          maxPointsByDate.set(date, max);
        });
        const topPointsByDate = new Map();
        pointsByDateMember.forEach((mp, date) => {
          const max = maxPointsByDate.get(date) || 0;
          const set = new Set();
          mp.forEach((v, memId) => { if (v === max && max > 0) set.add(memId); });
          topPointsByDate.set(date, set);
        });
        const recorderIds = Array.isArray(state.recorderIds) ? state.recorderIds.slice(0,3) : [];
        killsByDateMember.forEach((mp, date) => {
          const topKills = maxKillsByDate.get(date) || 0;
          if (topKills <= 0) return;
          const topSet = topKillersByDate.get(date) || new Set();
          const ptsMap = pointsByDateMember.get(date) || new Map();
          let desiredPts = 0;
          topSet.forEach(id => { const v = ptsMap.get(id) || 0; if (v > desiredPts) desiredPts = v; });
          recorderIds.forEach(rid => {
            const actualKills = mp.get(rid) || 0;
            const actualPts = ptsMap.get(rid) || 0;
            const dk = topKills - actualKills;
            const dp = desiredPts - actualPts;
            if (dk !== 0 || dp !== 0) {
              totalKills += dk;
              totalPoints += dp;
              const mem = getMemberById(rid);
              const accM = perMember.get(rid) || { name: mem ? mem.name : '(ถูกลบ)', kills: 0, points: 0 };
              accM.kills += dk;
              accM.points += dp;
              perMember.set(rid, accM);
            }
          });
        });

        const killsEl = document.getElementById('rangeTotalKills');
        const ptsEl = document.getElementById('rangeTotalPoints');
        if (killsEl) killsEl.textContent = String(totalKills);
        if (ptsEl) ptsEl.textContent = totalPoints.toLocaleString();

        const memTbl = document.getElementById('rangeMemberTotalsTable');
        if (memTbl) {
          const tbody2 = memTbl.querySelector('tbody');
          if (tbody2) {
            tbody2.innerHTML = '';
            const rows2 = Array.from(perMember.values()).sort((a,b) => collatorTh.compare(a.name, b.name));
            rows2.forEach(r => {
              const tr = document.createElement('tr');
              tr.innerHTML = `<td>${r.name}</td><td>${r.kills}</td><td>${r.points}</td>`;
              tbody2.appendChild(tr);
            });
          }
        }

        const attTbl = document.getElementById('summaryAttendanceTable');
        if (attTbl) {
          const tbodyA = attTbl.querySelector('tbody');
          const theadA = attTbl.querySelector('thead');
          if (tbodyA) {
            tbodyA.innerHTML = '';
            const EVENTS = state.events && state.events.length ? state.events : ['VEPRA','BOSS-RUSH','DRAGONBEST-INVA','ORFEN-INVA','CATACOM'];
            if (theadA) {
              theadA.innerHTML = '';
              const trh = document.createElement('tr');
              trh.innerHTML = `<th>สมาชิก</th>` + EVENTS.map(e => `<th>${e}</th>`).join('') + `<th>รวม</th>`;
              theadA.appendChild(trh);
            }
            const rowsA = state.members.map(m => ({
              name: m.name,
              id: m.id,
              counts: EVENTS.reduce((acc,e)=>{acc[e]=0; return acc;}, {})
            }));
            state.attendance
              .filter(a => isDateInRange(a.date || '', start, end))
              .forEach(a => {
                const r = rowsA.find(x => x.id === a.memberId);
                if (!r) return;
                if (EVENTS.includes(a.event)) r.counts[a.event] += 1;
              });
            rowsA.sort((a,b) => collatorTh.compare(a.name, b.name)).forEach(r => {
              const total = EVENTS.reduce((s,e)=> s + (r.counts[e]||0), 0);
              const tr = document.createElement('tr');
              tr.innerHTML = `<td>${r.name}</td>` + EVENTS.map(e => `<td>${r.counts[e]||0}</td>`).join('') + `<td>${total}</td>`;
              tbodyA.appendChild(tr);
            });
          }
        }
      });
    }

    const applyBtn = document.getElementById('applyRangeToClanBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (!state.auth.loggedIn || state.auth.user !== POINTS_ADMIN_USER) {
          const m = document.getElementById('exportMsg');
          if (m) m.textContent = 'กรุณาเข้าสู่ระบบ (admin) ที่แท็บคะแนนแคลน';
          return;
        }
        const start = document.getElementById('sumStartDate')?.value || '';
        const end = document.getElementById('sumEndDate')?.value || '';
        const perMemberPoints = new Map();
        state.hunts.forEach(h => {
          if (start && h.date < start) return;
          if (end && h.date > end) return;
          const boss = getBossById(h.bossId);
          const ppk = boss ? boss.points : 0;
          h.entries.forEach(en => {
            const cnt = en.count || 0;
            const mult = getTotalBuffMultiplier(en.memberId, h.date);
            const pts = Math.round(cnt * ppk * mult);
            const cur = perMemberPoints.get(en.memberId) || 0;
            perMemberPoints.set(en.memberId, cur + pts);
          });
        });
        const targetCount = Array.from(perMemberPoints.values()).filter(v => v > 0).length;
        const startLabel = start || 'ทั้งหมด';
        const endLabel = end || 'ทั้งหมด';
        const ok = confirm(`ยืนยันอัพเดทคะแนนเข้าแคลน\nช่วง: ${startLabel} ถึง ${endLabel}\nสมาชิกที่จะได้รับคะแนน: ${targetCount} คน`);
        if (!ok) return;
        const addedIds = [];
        perMemberPoints.forEach((pts, memId) => {
          if (pts > 0) {
            const id = uid('txn');
            state.ledger.push({ id, date: todayStr(), type: 'range_update', memberId: memId, points: pts, note: `update from ${start || 'all'} to ${end || 'all'}` });
            addedIds.push(id);
          }
        });
        saveAll();
        try {
          localStorage.setItem(STORAGE_KEYS.lastRangeIds, JSON.stringify(addedIds));
          localStorage.setItem(STORAGE_KEYS.lastRangeMarker, JSON.stringify({ start, end, ts: Date.now() }));
        } catch {}
        const m = document.getElementById('exportMsg');
        if (m) m.textContent = 'อัพเดทคะแนนเข้าแคลนเรียบร้อย';
        appendPointsLog('range', `APPLY range to clan: ${start || 'all'} to ${end || 'all'} — ${perMemberPoints.size} members`);
        renderPointsBalance();
      });
      applyBtn.style.display = (state.auth.loggedIn && state.auth.user === POINTS_ADMIN_USER) ? '' : 'none';
    }

    renderSummaryTables();
  }

  function initSpinWheelTab() {
    const input = document.getElementById('spinOptionInput');
    const addBtn = document.getElementById('addSpinOptionBtn');
    const clearBtn = document.getElementById('clearSpinOptionsBtn');
    const spinBtn = document.getElementById('spinWheelBtn');
    const searchInput = document.getElementById('spinMemberSearch');
    const selectAllBtn = document.getElementById('spinSelectAllVisibleBtn');
    const deselectAllBtn = document.getElementById('spinDeselectAllBtn');
    const addSelectedBtn = document.getElementById('spinAddSelectedToWheelBtn');
    renderSpinOptionsList();
    renderSpinWheel();
    renderSpinMemberSelectList('');
    if (addBtn && input) {
      addBtn.onclick = () => {
        const v = (input.value || '').trim();
        if (!v) return;
        const exists = state.wheelOptions.some(name => name.toLowerCase() === v.toLowerCase());
        if (!exists) state.wheelOptions.push(v);
        input.value = '';
        renderSpinOptionsList();
        renderSpinWheel();
      };
    }
    if (clearBtn) {
      clearBtn.onclick = () => {
        state.wheelOptions = [];
        renderSpinOptionsList();
        renderSpinWheel();
      };
    }
    if (spinBtn) {
      spinBtn.onclick = () => {
        spinWheel();
      };
    }
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const q = (searchInput.value || '').trim();
        renderSpinMemberSelectList(q);
      });
    }
    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        document.querySelectorAll('#spinMemberSelectList input[type="checkbox"]').forEach(chk => { chk.checked = true; });
      };
    }
    if (deselectAllBtn) {
      deselectAllBtn.onclick = () => {
        document.querySelectorAll('#spinMemberSelectList input[type="checkbox"]').forEach(chk => { chk.checked = false; });
      };
    }
    if (addSelectedBtn) {
      addSelectedBtn.onclick = () => {
        const ids = Array.from(document.querySelectorAll('#spinMemberSelectList input[type="checkbox"]'))
          .filter(chk => chk.checked)
          .map(chk => chk.value);
        const names = ids.map(id => {
          const m = getMemberById(id);
          return m ? m.name : '';
        }).filter(Boolean);
        names.forEach(n => {
          const exists = state.wheelOptions.some(x => x.toLowerCase() === n.toLowerCase());
          if (!exists) state.wheelOptions.push(n);
        });
        renderSpinOptionsList();
        renderSpinWheel();
      };
    }
  }

  function renderSpinOptionsList() {
    const box = document.getElementById('spinOptionsList');
    if (!box) return;
    box.innerHTML = '';
    const opts = state.wheelOptions.slice();
    if (!opts.length) {
      const div = document.createElement('div');
      div.className = 'msg';
      div.textContent = 'ยังไม่มีตัวเลือก';
      box.appendChild(div);
      return;
    }
    opts.forEach((name, idx) => {
      const row = document.createElement('div');
      row.className = 'spin-option';
      row.innerHTML = `<div class="name">${name}</div><div class="actions"><button class="btn-danger btn-mini" data-idx="${idx}">ลบ</button></div>`;
      box.appendChild(row);
    });
    box.querySelectorAll('button[data-idx]').forEach(btn => {
      btn.addEventListener('click', e => {
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        if (isNaN(i)) return;
        state.wheelOptions.splice(i, 1);
        renderSpinOptionsList();
        renderSpinWheel();
      });
    });
  }

  function renderSpinMemberSelectList(filterText) {
    const box = document.getElementById('spinMemberSelectList');
    if (!box) return;
    const q = (filterText || '').toLowerCase();
    const rows = state.members
      .filter(m => !q || (m.name || '').toLowerCase().includes(q))
      .sort((a,b) => collatorTh.compare(a.name, b.name));
    box.innerHTML = '';
    rows.forEach(m => {
      const div = document.createElement('div');
      div.className = 'member-item';
      const id = `spin_mem_${m.id}`;
      div.innerHTML = `<input type="checkbox" id="${id}" value="${m.id}" /><label for="${id}">${m.name}</label>`;
      div.addEventListener('click', (e) => {
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        if (tag === 'input') return;
        if (tag === 'label') e.preventDefault();
        const chk = div.querySelector('input[type="checkbox"]');
        if (chk) chk.checked = !chk.checked;
      });
      box.appendChild(div);
    });
  }

  function renderSpinWheel() {
    const canvas = document.getElementById('spinWheelCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(spinWheelState.angle);
    const opts = state.wheelOptions.slice();
    const n = Math.max(opts.length, 1);
    const r = Math.min(w, h) / 2 - 6;
    const a = (Math.PI * 2) / n;
    const colors = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#a78bfa','#06b6d4','#fb7185','#fde047','#34d399','#60a5fa','#c084fc','#22d3ee'];
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, i * a, (i + 1) * a);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      const label = opts[i] || '-';
      ctx.save();
      ctx.rotate(i * a + a / 2);
      ctx.fillStyle = '#111';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, r * 0.65, 5);
      ctx.restore();
    }
    ctx.restore();
    const pctx = canvas.getContext('2d');
    pctx.save();
    pctx.translate(w / 2, h / 2);
    pctx.beginPath();
    pctx.moveTo(0, -r - 2);
    pctx.lineTo(8, -r + 12);
    pctx.lineTo(-8, -r + 12);
    pctx.closePath();
    pctx.fillStyle = '#111';
    pctx.fill();
    pctx.restore();
  }

  function spinWheel() {
    if (spinWheelState.spinning) return;
    const opts = state.wheelOptions.slice();
    const canvas = document.getElementById('spinWheelCanvas');
    const resultEl = document.getElementById('spinResultText');
    const overlay = document.getElementById('spinWinnerOverlay');
    if (!canvas) return;
    if (opts.length === 0) return;
    const n = opts.length;
    const targetIdx = Math.floor(Math.random() * n);
    const a = (Math.PI * 2) / n;
    const targetAngle = (Math.PI * 1.5) - (targetIdx * a + a / 2);
    const current = spinWheelState.angle % (Math.PI * 2);
    let delta = targetAngle - current;
    if (delta < 0) delta += Math.PI * 2;
    const spins = Math.PI * 2 * 5;
    const final = spinWheelState.angle + spins + delta;
    const dur = 2500;
    const start = performance.now();
    const startAngle = spinWheelState.angle;
    spinWheelState.spinning = true;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      spinWheelState.angle = startAngle + (final - startAngle) * eased;
      renderSpinWheel();
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        spinWheelState.spinning = false;
        const name = opts[targetIdx] || '';
        if (resultEl) resultEl.textContent = name ? `ผลลัพธ์: ${name}` : '';
        if (overlay) {
          overlay.textContent = name;
          overlay.classList.remove('active');
          void overlay.offsetWidth;
          overlay.classList.add('active');
        }
        playFireworks();
      }
    };
    requestAnimationFrame(tick);
  }

  function playFireworks() {
    const canvas = document.getElementById('spinEffectsCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const colors = ['#ef4444','#f59e0b','#22c55e','#3b82f6','#a78bfa','#06b6d4','#fb7185','#fde047','#34d399','#60a5fa','#c084fc','#22d3ee'];
    const particles = [];
    const count = 80;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 4;
      particles.push({ x: cx, y: cy - (Math.min(w,h)/2 - 20), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r: 3 + Math.random() * 3, c: colors[i % colors.length], life: 800, decay: 0.98 });
    }
    const start = performance.now();
    const draw = (t) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.decay;
        p.vy = p.vy * p.decay + 0.03;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.fill();
      });
      if (elapsed < 900) {
        requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    requestAnimationFrame(draw);
  }

  // -----------------------------
  // Init App
  // -----------------------------
  async function init() {
    loadAll();
    seedInitialDataIfNeeded();
    loadAll();
    const remote = await loadServerState();
    if (remote && typeof remote === 'object') {
      if (Array.isArray(remote.bosses)) state.bosses = remote.bosses;
      if (Array.isArray(remote.members)) state.members = remote.members;
      if (Array.isArray(remote.hunts)) state.hunts = remote.hunts;
      if (Array.isArray(remote.ledger)) state.ledger = remote.ledger;
      if (Array.isArray(remote.attendance)) state.attendance = remote.attendance;
      if (Array.isArray(remote.recorderIds)) state.recorderIds = remote.recorderIds;
      if (remote.dashboardCounters && typeof remote.dashboardCounters === 'object') state.dashboardCounters = remote.dashboardCounters;
      if (Array.isArray(remote.events)) state.events = remote.events;
      saveAll();
    }

    initTabs();
    initBossManage();
    initMemberManage();
    initHuntTab();
    initPointsTab();
    initAttendanceTab();
    initSummaryExport();
    
    // เรียกใช้ฟังก์ชันแสดงผลเริ่มต้น
    renderBossHuntList();
    renderMemberSelectList();
    updateDashboardStats();
    renderDashboardCharts();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
 // ลบโค้ดธีมซ้ำด้านล่างนี้ทิ้งทั้งหมด (THEME_KEY, initTheme(), และ function init() ที่ซ้ำ)
    const undoBtn = document.getElementById('undoRangeToClanBtn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        if (!state.auth.loggedIn || state.auth.user !== POINTS_ADMIN_USER) return;
        const idsJson = localStorage.getItem(STORAGE_KEYS.lastRangeIds) || '[]';
        let ids;
        try { ids = JSON.parse(idsJson); } catch { ids = []; }
        if (!Array.isArray(ids) || ids.length === 0) return;
        state.ledger = state.ledger.filter(l => !ids.includes(l.id));
        saveAll();
        appendPointsLog('range', `UNDO range apply — removed ${ids.length} records`);
        localStorage.removeItem(STORAGE_KEYS.lastRangeIds);
        localStorage.removeItem(STORAGE_KEYS.lastRangeMarker);
        renderPointsBalance();
      });
      undoBtn.style.display = (state.auth.loggedIn && state.auth.user === POINTS_ADMIN_USER) ? '' : 'none';
    }
