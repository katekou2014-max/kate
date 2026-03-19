// ============================================================
//  CATEGORIES
// ============================================================
const DEFAULT_CATEGORIES = [
  { id: 'food',          name: 'Food',        icon: '🍔', color: '#FF9500' },
  { id: 'gas',           name: 'Gas',         icon: '⛽', color: '#FF3B30' },
  { id: 'electricity',   name: 'Electric',    icon: '⚡', color: '#FFD60A' },
  { id: 'water',         name: 'Water',       icon: '💧', color: '#32ADE6' },
  { id: 'rent',          name: 'Rent',        icon: '🏠', color: '#5E5CE6' },
  { id: 'transport',     name: 'Transport',   icon: '🚗', color: '#30D158' },
  { id: 'health',        name: 'Health',      icon: '💊', color: '#FF375F' },
  { id: 'entertainment', name: 'Fun',         icon: '🎬', color: '#BF5AF2' },
  { id: 'shopping',      name: 'Shopping',    icon: '🛍️', color: '#FF9F0A' },
  { id: 'subscriptions', name: 'Subscr.',     icon: '📱', color: '#0A84FF' },
  { id: 'fitness',       name: 'Fitness',     icon: '🏋️', color: '#32D74B' },
  { id: 'other',         name: 'Other',       icon: '📦', color: '#8E8E93' },
];

function getCustomCategories() {
  try {
    return JSON.parse(localStorage.getItem('daily_expenses_custom_cats') || '[]');
  } catch { return []; }
}

function saveCustomCategories(cats) {
  localStorage.setItem('daily_expenses_custom_cats', JSON.stringify(cats));
}

function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...getCustomCategories()];
}

function addCustomCategory(cat) {
  const cats = getCustomCategories();
  cats.push(cat);
  saveCustomCategories(cats);
}

function deleteCustomCategory(id) {
  const cats = getCustomCategories().filter(c => c.id !== id);
  saveCustomCategories(cats);
}

// ============================================================
//  STORAGE
// ============================================================
function getData() {
  try {
    return JSON.parse(localStorage.getItem('daily_expenses_v1') || '{"expenses":[]}');
  } catch { return { expenses: [] }; }
}

function saveData(data) {
  localStorage.setItem('daily_expenses_v1', JSON.stringify(data));
}

function addExpense(exp) {
  const d = getData();
  d.expenses.push(exp);
  saveData(d);
}

function removeExpense(id) {
  const d = getData();
  d.expenses = d.expenses.filter(e => e.id !== id);
  saveData(d);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getTodayExpenses() {
  return getData().expenses.filter(e => e.date === todayStr());
}

function getAllExpenses() {
  return getData().expenses;
}

// ============================================================
//  HELPERS
// ============================================================
function fmt(amount) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount);
}

function fmtDateFull(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IE', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (dateStr === todayStr()) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
  return d.toLocaleDateString('en-IE', { weekday: 'long', month: 'short', day: 'numeric' });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getCat(id) {
  return getAllCategories().find(c => c.id === id) || DEFAULT_CATEGORIES.at(-1);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ============================================================
//  STATE
// ============================================================
let selectedCat     = null;
let selectedMethod  = 'cash';
let pendingDeleteId = null;
let editingId       = null;   // null = new expense, string = editing existing

// ============================================================
//  RENDER HELPERS
// ============================================================
function expenseCardHTML(exp) {
  const cat  = getCat(exp.category);
  const meta = exp.note || fmtTime(exp.createdAt);
  return `
    <div class="expense-card" data-id="${exp.id}">
      <div class="cat-bubble" style="background:${cat.color}1a">${cat.icon}</div>
      <div class="card-info">
        <p class="card-cat">${cat.name}</p>
        <p class="card-meta">${meta}</p>
      </div>
      <div class="card-right">
        <span class="card-amount ${amountClass(exp.amount)}">${fmt(exp.amount)}</span>
        <span class="card-method">${exp.paymentMethod === 'cash' ? '💵 Cash' : '💳 Card'}</span>
      </div>
    </div>`;
}

// ============================================================
//  HEADER
// ============================================================
function updateHeader() {
  document.getElementById('greeting').textContent = getGreeting();
  document.getElementById('header-date').textContent = fmtDateFull(todayStr());
  const total   = getTodayExpenses().reduce((s, e) => s + e.amount, 0);
  const totalEl = document.getElementById('daily-total');
  totalEl.textContent = fmt(total);
  totalEl.className   = 'daily-total-amount ' + totalColorClass(total);
}

// ============================================================
//  TODAY VIEW
// ============================================================
function renderToday() {
  const list = document.getElementById('expenses-list');
  const expenses = getTodayExpenses().slice().reverse();

  if (expenses.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p class="empty-title">No expenses today</p>
        <p class="empty-sub">Tap the + button to record your first expense</p>
      </div>`;
    return;
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  list.innerHTML = `<p class="section-title">Today · ${fmt(total)}</p>`;
  expenses.forEach(exp => {
    list.insertAdjacentHTML('beforeend', expenseCardHTML(exp));
  });

  list.querySelectorAll('.expense-card').forEach(card => {
    card.addEventListener('click', () => openActionSheet(card.dataset.id));
  });
}

// ============================================================
//  HISTORY VIEW
// ============================================================
function renderHistory() {
  const container = document.getElementById('history-content');
  const all       = getAllExpenses();
  const today     = todayStr();

  if (all.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p class="empty-title">No history yet</p><p class="empty-sub">Past days will appear here</p></div>`;
    return;
  }

  // ── Quick stats cards ──
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })();
  const thisMonth = today.slice(0,7);

  const todayExps     = all.filter(e => e.date === today);
  const yesterdayExps = all.filter(e => e.date === yesterday);
  const monthExps     = all.filter(e => e.date.startsWith(thisMonth));

  const sum = arr => arr.reduce((s,e) => s+e.amount, 0);
  const allTotal = sum(all);

  let html = `
    <p class="section-title">Overview</p>
    <div class="overview-grid">
      <div class="ov-card">
        <span class="ov-label">Today</span>
        <span class="ov-val ${totalColorClass(sum(todayExps))}">${fmt(sum(todayExps))}</span>
        <span class="ov-count">${todayExps.length} expense${todayExps.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="ov-card">
        <span class="ov-label">Yesterday</span>
        <span class="ov-val ${totalColorClass(sum(yesterdayExps))}">${fmt(sum(yesterdayExps))}</span>
        <span class="ov-count">${yesterdayExps.length} expense${yesterdayExps.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="ov-card">
        <span class="ov-label">This month</span>
        <span class="ov-val ${totalColorClass(sum(monthExps)/30)}">${fmt(sum(monthExps))}</span>
        <span class="ov-count">${monthExps.length} expenses</span>
      </div>
      <div class="ov-card">
        <span class="ov-label">All time</span>
        <span class="ov-val">${fmt(allTotal)}</span>
        <span class="ov-count">${all.length} total</span>
      </div>
    </div>`;

  // ── Group by month, then by day ──
  const byMonth = {};
  all.slice().sort((a,b) => b.date.localeCompare(a.date)).forEach(e => {
    const m = e.date.slice(0,7);
    (byMonth[m] = byMonth[m] || {})[e.date] = byMonth[m][e.date] || [];
    byMonth[m][e.date].push(e);
  });

  Object.keys(byMonth).sort().reverse().forEach(month => {
    const monthLabel = new Date(month+'-01T12:00:00').toLocaleDateString('en-IE', { month:'long', year:'numeric' });
    const monthTotal = Object.values(byMonth[month]).flat().reduce((s,e)=>s+e.amount,0);
    html += `
      <div class="month-section">
        <div class="month-header">
          <span class="month-label">${monthLabel}</span>
          <span class="month-total">${fmt(monthTotal)}</span>
        </div>`;

    Object.keys(byMonth[month]).sort().reverse().forEach(date => {
      const exps  = byMonth[month][date].slice().reverse();
      const total = sum(exps);
      const isToday = date === today;
      const isYday  = date === yesterday;
      const badge   = isToday ? ' <span class="day-badge today-badge">Today</span>' : isYday ? ' <span class="day-badge">Yesterday</span>' : '';
      html += `
        <div class="history-group">
          <div class="history-date-row">
            <span class="history-date-label">${fmtDateShort(date)}${badge}</span>
            <span class="history-date-total ${totalColorClass(total)}">${fmt(total)}</span>
          </div>
          ${exps.map(e => expenseCardHTML(e)).join('')}
        </div>`;
    });
    html += `</div>`;
  });

  container.innerHTML = html;
  container.querySelectorAll('.expense-card').forEach(card => {
    card.addEventListener('click', () => openActionSheet(card.dataset.id));
  });
}

// ============================================================
//  SUMMARY VIEW
// ============================================================
function renderSummary() {
  const container = document.getElementById('summary-content');
  const all = getAllExpenses();

  if (all.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p class="empty-title">No data yet</p>
        <p class="empty-sub">Add expenses to see your breakdown</p>
      </div>`;
    return;
  }

  const monthKey = todayStr().slice(0, 7);
  const monthExps = all.filter(e => e.date.startsWith(monthKey));
  const totalMonth = monthExps.reduce((s, e) => s + e.amount, 0);
  const totalAll   = all.reduce((s, e) => s + e.amount, 0);

  const cashTotal = monthExps.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0);
  const cardTotal = monthExps.filter(e => e.paymentMethod === 'card').reduce((s, e) => s + e.amount, 0);

  const monthName = new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' });

  // By category
  const byCat = {};
  monthExps.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; });
  const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  let html = `<p class="section-title">Summary</p>`;

  // Overview card
  html += `
    <div class="summary-card">
      <p class="summary-card-title">${monthName}</p>
      <div class="summary-row">
        <div class="summary-row-left">
          <div class="sum-icon" style="background:rgba(0,122,255,0.1)">📊</div>
          <div><p class="sum-name">Total Spent</p></div>
        </div>
        <span class="sum-amount">${fmt(totalMonth)}</span>
      </div>
      <div class="summary-row">
        <div class="summary-row-left">
          <div class="sum-icon" style="background:rgba(52,199,89,0.1)">💵</div>
          <div><p class="sum-name">Cash</p></div>
        </div>
        <span class="sum-amount">${fmt(cashTotal)}</span>
      </div>
      <div class="summary-row">
        <div class="summary-row-left">
          <div class="sum-icon" style="background:rgba(0,122,255,0.1)">💳</div>
          <div><p class="sum-name">Bank / Card</p></div>
        </div>
        <span class="sum-amount">${fmt(cardTotal)}</span>
      </div>
      <div class="summary-row">
        <div class="summary-row-left">
          <div class="sum-icon" style="background:rgba(142,142,147,0.1)">🗓️</div>
          <div><p class="sum-name">All Time</p></div>
        </div>
        <span class="sum-amount">${fmt(totalAll)}</span>
      </div>
    </div>`;

  // By category card
  if (sortedCats.length > 0) {
    html += `<div class="summary-card"><p class="summary-card-title">By Category</p>`;
    sortedCats.forEach(([catId, amount]) => {
      const cat = getCat(catId);
      const pct = totalMonth > 0 ? Math.round((amount / totalMonth) * 100) : 0;
      html += `
        <div class="summary-row">
          <div class="summary-row-left">
            <div class="sum-icon" style="background:${cat.color}1a">${cat.icon}</div>
            <div>
              <p class="sum-name">${cat.name}</p>
              <p class="sum-pct">${pct}% of total</p>
            </div>
          </div>
          <span class="sum-amount">${fmt(amount)}</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
        </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============================================================
//  CATEGORY GRID
// ============================================================
function renderCategoryGrid() {
  const grid = document.getElementById('category-grid');
  const customIds = new Set(getCustomCategories().map(c => c.id));

  grid.innerHTML = getAllCategories().map(cat => `
    <button class="cat-btn${selectedCat === cat.id ? ' selected' : ''}${customIds.has(cat.id) ? ' custom' : ''}"
            data-cat="${cat.id}" title="${customIds.has(cat.id) ? 'Hold to delete' : ''}">
      <span class="icon">${cat.icon}</span>
      <span class="name">${cat.name}</span>
      ${customIds.has(cat.id) ? '<span class="custom-badge">✕</span>' : ''}
    </button>`).join('');

  // Add the "+ New" tile
  grid.insertAdjacentHTML('beforeend', `
    <button class="cat-btn cat-btn-add" id="open-new-cat">
      <span class="icon">＋</span>
      <span class="name">New</span>
    </button>`);

  grid.querySelectorAll('.cat-btn:not(.cat-btn-add)').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCat = btn.dataset.cat;
      renderCategoryGrid();
    });
    // Delete custom category on ✕ badge click
    const badge = btn.querySelector('.custom-badge');
    if (badge) {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        deleteCustomCategory(btn.dataset.cat);
        if (selectedCat === btn.dataset.cat) selectedCat = null;
        renderCategoryGrid();
      });
    }
  });

  document.getElementById('open-new-cat').addEventListener('click', openNewCatModal);
}

// ============================================================
//  NEW CATEGORY MODAL
// ============================================================
const PRESET_COLORS = [
  '#FF3B30','#FF9500','#FFD60A','#34C759','#30D158',
  '#32ADE6','#007AFF','#5E5CE6','#BF5AF2','#FF375F',
  '#8E8E93','#000000',
];

let newCatColor = PRESET_COLORS[6]; // default blue

function openNewCatModal() {
  newCatColor = PRESET_COLORS[6];
  document.getElementById('new-cat-icon').value  = '';
  document.getElementById('new-cat-name').value  = '';
  renderColorPicker();
  document.getElementById('newcat-overlay').classList.add('open');
  setTimeout(() => document.getElementById('new-cat-icon').focus(), 320);
}

function closeNewCatModal() {
  document.getElementById('newcat-overlay').classList.remove('open');
}

function renderColorPicker() {
  const wrap = document.getElementById('color-picker');
  wrap.innerHTML = PRESET_COLORS.map(c => `
    <button class="color-dot${c === newCatColor ? ' selected' : ''}"
            style="background:${c}" data-color="${c}"></button>`).join('');
  wrap.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      newCatColor = btn.dataset.color;
      renderColorPicker();
    });
  });
}

function handleSaveNewCat() {
  const icon = document.getElementById('new-cat-icon').value.trim();
  const name = document.getElementById('new-cat-name').value.trim();

  if (!icon) {
    shake(document.getElementById('new-cat-icon')); return;
  }
  if (!name) {
    shake(document.getElementById('new-cat-name')); return;
  }

  addCustomCategory({ id: 'custom_' + uid(), name, icon, color: newCatColor });
  closeNewCatModal();
  renderCategoryGrid();
}

function shake(el) {
  el.classList.add('shake');
  el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
}

// ============================================================
//  MODAL  (new + edit)
// ============================================================
function openModal(prefill = null) {
  editingId      = null;
  selectedCat    = prefill?.category    || null;
  selectedMethod = prefill?.paymentMethod || 'cash';

  document.getElementById('amount-input').value = prefill?.amount  || '';
  document.getElementById('note-input').value   = prefill?.note    || '';
  document.getElementById('date-input').value   = todayStr();
  document.getElementById('modal-header-title').textContent = 'New Expense';
  document.getElementById('add-btn').textContent = 'Add Expense';

  renderCategoryGrid();
  syncPaymentBtns();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('amount-input').focus(), 420);
}

function openEditModal(id) {
  const exp = getAllExpenses().find(e => e.id === id);
  if (!exp) return;

  editingId      = id;
  selectedCat    = exp.category;
  selectedMethod = exp.paymentMethod;

  document.getElementById('amount-input').value = exp.amount;
  document.getElementById('note-input').value   = exp.note || '';
  document.getElementById('date-input').value   = exp.date;
  document.getElementById('modal-header-title').textContent = 'Edit Expense';
  document.getElementById('add-btn').textContent = 'Save Changes';

  renderCategoryGrid();
  syncPaymentBtns();
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  editingId = null;
  document.getElementById('modal-overlay').classList.remove('open');
}

function syncPaymentBtns() {
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === selectedMethod);
  });
}

// ============================================================
//  ADD / SAVE EXPENSE
// ============================================================
function handleAdd() {
  const amount = parseFloat(document.getElementById('amount-input').value);
  if (!amount || amount <= 0) { shake(document.getElementById('amount-input')); return; }
  if (!selectedCat)           { shake(document.getElementById('category-grid')); return; }

  const note = document.getElementById('note-input').value.trim();
  const date = document.getElementById('date-input').value || todayStr();

  if (editingId) {
    const d = getData();
    const idx = d.expenses.findIndex(e => e.id === editingId);
    if (idx !== -1) {
      d.expenses[idx] = { ...d.expenses[idx], amount, category: selectedCat, paymentMethod: selectedMethod, note, date };
      saveData(d);
    }
  } else {
    addExpense({ id: uid(), date, amount, category: selectedCat, paymentMethod: selectedMethod, note, createdAt: Date.now() });
  }

  closeModal();
  updateHeader();
  renderToday();
  renderWallet();
  if (activeTab === 'history') renderHistory();
  if (activeTab === 'summary') renderSummary();
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('voice-toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ============================================================
//  ACTION SHEET (tap expense → Edit / Delete)
// ============================================================
function openActionSheet(id) {
  pendingDeleteId = id;
  const exp = getAllExpenses().find(e => e.id === id);
  if (!exp) return;
  const cat = getCat(exp.category);
  document.getElementById('action-sheet-title').textContent    = `${cat.icon} ${cat.name}`;
  document.getElementById('action-sheet-subtitle').textContent = `${fmt(exp.amount)} · ${exp.paymentMethod === 'cash' ? 'Cash' : 'Card'}${exp.note ? ' · ' + exp.note : ''}`;
  document.getElementById('action-overlay').classList.add('open');
}

function closeActionSheet() {
  document.getElementById('action-overlay').classList.remove('open');
}

// ============================================================
//  DELETE SHEET
// ============================================================
function openDeleteSheet(id) {
  pendingDeleteId = id;
  document.getElementById('delete-overlay').classList.add('open');
}

function closeDeleteSheet() {
  pendingDeleteId = null;
  document.getElementById('delete-overlay').classList.remove('open');
}

// ============================================================
//  MAIN-PAGE VOICE (auto-submit on "add …")
// ============================================================
function startMainVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { alert('Voice not supported. Try Chrome or Edge.'); return; }

  const btn = document.getElementById('fab-mic-btn');
  btn.classList.add('listening');
  showToast('🎤 Listening…  say "add 50 gas cash"');

  const rec = new SpeechRecognition();
  rec.lang = 'en-IE';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript.trim();
    const lower      = transcript.toLowerCase();
    const parsed     = parseVoiceInput(transcript);

    const autoSubmit = /^(add|record|log|new|put|enter)\b/i.test(lower);

    if (autoSubmit && parsed.amount && parsed.category) {
      const cat  = getCat(parsed.category);
      const note = parsed.note || cat.name;
      const exp  = {
        id: uid(), date: todayStr(),
        amount: parsed.amount,
        category: parsed.category,
        paymentMethod: parsed.paymentMethod || 'cash',
        note,
        createdAt: Date.now(),
      };
      addExpense(exp);
      updateHeader();
      renderToday();
      renderWallet();
      showToast(`✅ Added ${fmt(parsed.amount)} · ${cat.icon} ${cat.name} · ${exp.paymentMethod === 'cash' ? 'Cash' : 'Card'}`);
    } else {
      // Open modal pre-filled for review
      openModal(parsed.amount || parsed.category || parsed.paymentMethod ? parsed : null);
      if (parsed.amount || parsed.category) {
        showToast(`📝 Check the form — "${transcript}"`);
      } else {
        showToast(`❓ Didn't understand — try "add 50 gas cash"`);
      }
    }
  };

  rec.onerror = () => {
    showToast('⚠️ Could not hear — try again');
  };

  rec.onend = () => {
    btn.classList.remove('listening');
  };

  rec.start();
}

// ============================================================
//  TABS
// ============================================================
let activeTab = 'today';

function switchTab(tab) {
  if (activeTab === tab) return;
  activeTab = tab;

  document.querySelectorAll('.tab-item').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab));

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${tab}`).classList.add('active');

  if (tab === 'history') renderHistory();
  if (tab === 'summary') renderSummary();
}

// ============================================================
//  AMOUNT COLOR CODING
// ============================================================
function amountClass(amount) {
  if (amount < 20)  return 'amount-low';
  if (amount < 100) return 'amount-medium';
  return 'amount-high';
}

function totalColorClass(total) {
  if (total < 50)  return 'amount-low';
  if (total < 200) return 'amount-medium';
  return 'amount-high';
}

// ============================================================
//  WEATHER
// ============================================================
const WMO_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'🌨️', 73:'🌨️', 75:'❄️',
  80:'🌦️', 81:'🌦️', 82:'⛈️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};

const WMO_DESC = {
  0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
  45:'Foggy', 48:'Freezing fog',
  51:'Light drizzle', 53:'Drizzle', 55:'Heavy drizzle',
  61:'Light rain', 63:'Rain', 65:'Heavy rain',
  71:'Light snow', 73:'Snow', 75:'Heavy snow',
  80:'Showers', 81:'Showers', 82:'Heavy showers',
  95:'Thunderstorm', 96:'Thunderstorm', 99:'Thunderstorm',
};

async function fetchWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=38.0833&longitude=23.7167&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m&timezone=Europe%2FAthens';
    const res  = await fetch(url);
    const data = await res.json();
    const c    = data.current;
    const code = c.weathercode;

    document.getElementById('weather-icon').textContent  = WMO_ICONS[code] || '🌡️';
    document.getElementById('weather-temp').textContent  = Math.round(c.temperature_2m) + '°C';
    document.getElementById('weather-desc').textContent  = (WMO_DESC[code] || 'Kamatero') + ' · Kamatero';
    document.getElementById('weather-feels').textContent = 'Feels ' + Math.round(c.apparent_temperature) + '°C';
    document.getElementById('weather-wind').textContent  = 'Wind ' + Math.round(c.windspeed_10m) + ' km/h';
  } catch {
    document.getElementById('weather-desc').textContent = 'Kamatero, GR';
    document.getElementById('weather-temp').textContent = '--°C';
  }
}

// ============================================================
//  WALLET
// ============================================================
function getWallet() {
  try {
    return JSON.parse(localStorage.getItem('expenses_wallet') || '{"cash":0,"bank":0}');
  } catch { return { cash: 0, bank: 0 }; }
}

function saveWallet(w) {
  localStorage.setItem('expenses_wallet', JSON.stringify(w));
}

function renderWallet() {
  const w     = getWallet();
  const spent = getTodayExpenses().reduce((s, e) => s + e.amount, 0);
  document.getElementById('wallet-cash').textContent  = fmt(w.cash);
  document.getElementById('wallet-bank').textContent  = fmt(w.bank);
  document.getElementById('wallet-spent').textContent = fmt(spent);
}

function openWalletSheet() {
  const w = getWallet();
  document.getElementById('input-cash').value = w.cash || '';
  document.getElementById('input-bank').value = w.bank || '';
  document.getElementById('wallet-overlay').classList.add('open');
}

function closeWalletSheet() {
  document.getElementById('wallet-overlay').classList.remove('open');
}

function saveWalletFromSheet() {
  const cash = parseFloat(document.getElementById('input-cash').value) || 0;
  const bank = parseFloat(document.getElementById('input-bank').value) || 0;
  saveWallet({ cash, bank });
  closeWalletSheet();
  renderWallet();
}

// ============================================================
//  DARK MODE
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('expenses_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('expenses_theme', theme);
  const sun  = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (theme === 'dark') {
    sun.style.display  = 'block';
    moon.style.display = 'none';
  } else {
    sun.style.display  = 'none';
    moon.style.display = 'block';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ============================================================
//  VOICE INPUT
// ============================================================
const CATEGORY_KEYWORDS = {
  food:          ['food','eat','eating','restaurant','lunch','dinner','breakfast','grocery','groceries','coffee','pizza','burger','snack','drink','bar','cafe'],
  gas:           ['gas','fuel','petrol','gasoline','diesel'],
  electricity:   ['electricity','electric','power','light','lights','bill'],
  water:         ['water'],
  rent:          ['rent','mortgage','house','apartment','flat'],
  transport:     ['transport','bus','taxi','uber','train','metro','tram','car','parking','ticket'],
  health:        ['health','doctor','pharmacy','medicine','drug','medical','hospital','dentist','clinic'],
  entertainment: ['fun','entertainment','cinema','movie','film','concert','theater','theatre','game','games'],
  shopping:      ['shopping','shop','clothes','clothing','shoes','store'],
  subscriptions: ['subscription','subscriptions','subscr','netflix','spotify','amazon','prime'],
  fitness:       ['fitness','gym','sport','sports','yoga','swim','swimming'],
  other:         ['other','misc','miscellaneous'],
};

function parseVoiceInput(text) {
  const lower = text.toLowerCase();
  const result = { amount: null, category: null, paymentMethod: null, note: text };

  // Amount: find a number (e.g. "50", "12.5", "twelve")
  const numMatch = lower.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (numMatch) result.amount = parseFloat(numMatch[1].replace(',', '.'));

  // Payment method
  if (/\bcard\b|\bbank\b|\bdebit\b|\bcredit\b/.test(lower)) result.paymentMethod = 'card';
  else if (/\bcash\b/.test(lower)) result.paymentMethod = 'cash';

  // Category — check default keywords first
  for (const [catId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) {
      result.category = catId;
      break;
    }
  }
  // Then check custom category names
  if (!result.category) {
    for (const cat of getCustomCategories()) {
      if (lower.includes(cat.name.toLowerCase())) {
        result.category = cat.id;
        break;
      }
    }
  }

  return result;
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Voice input is not supported in this browser. Try Chrome or Edge.');
    return;
  }

  const btn   = document.getElementById('voice-btn');
  const label = document.getElementById('voice-label');
  const hint  = document.getElementById('voice-hint');

  const rec = new SpeechRecognition();
  rec.lang = 'en-IE';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    btn.classList.add('listening');
    label.textContent = 'Listening…';
    hint.textContent  = 'Speak now';
  };

  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    hint.textContent = `"${transcript}"`;
    const parsed = parseVoiceInput(transcript);

    if (parsed.amount)        document.getElementById('amount-input').value = parsed.amount;
    if (parsed.category)    { selectedCat = parsed.category; renderCategoryGrid(); }
    if (parsed.paymentMethod) { selectedMethod = parsed.paymentMethod; syncPaymentBtns(); }
  };

  rec.onerror = () => {
    btn.classList.remove('listening');
    label.textContent = 'Tap to speak';
    hint.textContent  = 'Could not hear you — try again';
  };

  rec.onend = () => {
    btn.classList.remove('listening');
    label.textContent = 'Tap to speak';
  };

  rec.start();
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Register service worker for PWA / offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  initTheme();
  fetchWeather();
  renderWallet();

  // Wallet sheet
  document.getElementById('wallet-edit-btn').addEventListener('click', openWalletSheet);
  document.getElementById('save-wallet').addEventListener('click', saveWalletFromSheet);
  document.getElementById('cancel-wallet').addEventListener('click', closeWalletSheet);
  document.getElementById('wallet-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('wallet-overlay')) closeWalletSheet();
  });

  updateHeader();
  renderToday();

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Main-page voice FAB
  document.getElementById('fab-mic-btn').addEventListener('click', startMainVoice);

  // Voice inside modal
  document.getElementById('voice-btn').addEventListener('click', startVoice);

  // FAB
  document.getElementById('fab-btn').addEventListener('click', () => openModal());

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Add button
  document.getElementById('add-btn').addEventListener('click', handleAdd);

  // Enter key on amount
  document.getElementById('amount-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('note-input').focus();
  });
  document.getElementById('note-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });

  // Payment buttons
  document.querySelectorAll('.pay-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMethod = btn.dataset.method;
      syncPaymentBtns();
    });
  });

  // Tabs
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Delete sheet
  document.getElementById('confirm-delete').addEventListener('click', () => {
    if (pendingDeleteId) {
      removeExpense(pendingDeleteId);
      closeDeleteSheet();
      updateHeader();
      renderWallet();
      if (activeTab === 'today')   renderToday();
      if (activeTab === 'history') renderHistory();
      if (activeTab === 'summary') renderSummary();
    }
  });

  // Action sheet
  document.getElementById('action-edit').addEventListener('click', () => {
    const id = pendingDeleteId;
    closeActionSheet();
    openEditModal(id);
  });
  document.getElementById('action-delete').addEventListener('click', () => {
    closeActionSheet();
    openDeleteSheet(pendingDeleteId);
  });
  document.getElementById('action-cancel').addEventListener('click', closeActionSheet);
  document.getElementById('action-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('action-overlay')) closeActionSheet();
  });

  // Delete confirm
  document.getElementById('cancel-delete').addEventListener('click', closeDeleteSheet);
  document.getElementById('delete-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('delete-overlay')) closeDeleteSheet();
  });

  // New category modal
  document.getElementById('newcat-close').addEventListener('click', closeNewCatModal);
  document.getElementById('newcat-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('newcat-overlay')) closeNewCatModal();
  });
  document.getElementById('save-new-cat').addEventListener('click', handleSaveNewCat);
  document.getElementById('new-cat-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSaveNewCat();
  });
});
