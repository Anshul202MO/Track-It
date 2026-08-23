// Track it — app.js
// Main controller. No account, no network calls, no analytics.

const PALETTE = [
  { name: 'Pink',      hex: '#F5C6D6' },
  { name: 'Peach',     hex: '#F7D3B7' },
  { name: 'Yellow',    hex: '#F3E3A3' },
  { name: 'Green',     hex: '#C9E4C5' },
  { name: 'Blue',      hex: '#BFDCEB' },
  { name: 'Lavender',  hex: '#D9CBEE' },
  { name: 'Beige',     hex: '#E8DCC8' },
  { name: 'Grey',      hex: '#D8D5D2' }
];
const DEFAULT_COLOR = PALETTE[0].hex;

const state = {
  profile: null,
  periods: [],
  calendarMonthKey: DateUtil.monthKey(DateUtil.todayStr()),
  editingPeriodId: null,
  pendingModal: null // 'endDatePrompt' | 'monthConflict' | 'deleteConfirm'
};

const el = (id) => document.getElementById(id);

// ---------- Boot ----------
async function boot() {
  state.profile = await TrackitDB.getProfile();
  if (!state.profile) {
    showOnboarding();
  } else {
    document.documentElement.style.setProperty('--period-color', state.profile.color || DEFAULT_COLOR);
    await loadPeriods();
    showHome();
  }
  wireStaticEvents();
}

async function loadPeriods() {
  state.periods = await TrackitDB.getAllPeriods();
}

// ---------- Onboarding ----------
function showOnboarding() {
  el('onboarding-screen').classList.remove('hidden');
  el('home-screen').classList.add('hidden');
  el('onboarding-name').focus();
}

function wireStaticEvents() {
  el('onboarding-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('onboarding-name').value.trim();
    if (!name) return;
    state.profile = await TrackitDB.saveProfile({ name, color: DEFAULT_COLOR });
    document.documentElement.style.setProperty('--period-color', DEFAULT_COLOR);
    await loadPeriods();
    showHome();
  });

  el('start-date').addEventListener('change', onStartDateChange);
  el('end-date').addEventListener('change', onEndDateChange);
  el('save-dates-btn').addEventListener('click', attemptSave);
  el('cancel-edit-btn').addEventListener('click', resetForm);
  el('cal-prev').addEventListener('click', () => shiftCalendar(-1));
  el('cal-next').addEventListener('click', () => shiftCalendar(1));
  el('reminder-enable-btn').addEventListener('click', onEnableReminders);
  el('reminder-dismiss-btn').addEventListener('click', onDismissReminderPrompt);

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]')) closeModal();
  });
}

// ---------- Home ----------
async function showHome() {
  el('onboarding-screen').classList.add('hidden');
  el('home-screen').classList.remove('hidden');
  el('greeting').textContent = `Hi, ${state.profile.name}`;
  renderSwatches();
  resetForm();
  renderCalendar();
  renderHistory();
  await renderReminderBanner();
  Reminders.maybeNotify(state.periods);
}

function renderSwatches() {
  const wrap = el('swatches');
  wrap.innerHTML = '';
  PALETTE.forEach(({ name, hex }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = hex;
    btn.setAttribute('aria-label', name);
    btn.setAttribute('aria-pressed', String(state.profile.color === hex));
    btn.addEventListener('click', () => selectColor(hex));
    wrap.appendChild(btn);
  });
}

async function selectColor(hex) {
  state.profile = await TrackitDB.saveProfile({ ...state.profile, color: hex });
  document.documentElement.style.setProperty('--period-color', hex);
  renderSwatches();
  renderCalendar();
  renderHistory();
}

// ---------- Date entry form ----------
function setDateInputBounds() {
  const min = DateUtil.minSelectableDate();
  const max = DateUtil.maxSelectableDate();
  el('start-date').min = min;
  el('start-date').max = max;
  el('end-date').min = el('start-date').value || min;
  el('end-date').max = max;
}

function resetForm() {
  state.editingPeriodId = null;
  el('start-date').value = '';
  el('end-date').value = '';
  setDateInputBounds();
  el('form-error').textContent = '';
  el('editing-banner').classList.add('hidden');
  el('save-dates-btn').textContent = 'Save dates';
  updateSaveButtonState();
}

function onStartDateChange() {
  setDateInputBounds();
  if (el('end-date').value && el('end-date').value < el('start-date').value) {
    el('end-date').value = '';
  }
  updateSaveButtonState();
}

function onEndDateChange() {
  updateSaveButtonState();
}

function updateSaveButtonState() {
  const ok = !!el('start-date').value && !!el('end-date').value;
  el('save-dates-btn').disabled = !ok;
  el('form-error').textContent = '';
}

function setEditingPeriod(period) {
  state.editingPeriodId = period.id;
  el('start-date').value = period.start;
  el('end-date').value = period.end;
  setDateInputBounds();
  el('editing-banner').classList.remove('hidden');
  el('editing-banner-text').textContent = `Editing period from ${DateUtil.monthLabel(period.monthKey)}`;
  el('save-dates-btn').textContent = 'Update dates';
  updateSaveButtonState();
  state.calendarMonthKey = period.monthKey;
  renderCalendar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function attemptSave() {
  const start = el('start-date').value;
  const end = el('end-date').value;
  const errorEl = el('form-error');
  errorEl.textContent = '';

  if (!start || !end) return;

  if (!DateUtil.isWithinSelectableRange(start) || !DateUtil.isWithinSelectableRange(end)) {
    errorEl.textContent = 'Dates older than 3 months, or in the future, can\u2019t be selected.';
    return;
  }
  if (end < start) {
    errorEl.textContent = 'The end date can\u2019t be before the start date.';
    return;
  }

  const today = DateUtil.todayStr();
  if (start === today && end === today) {
    openEndDatePrompt(start, end);
    return;
  }

  await checkMonthConflictAndSave(start, end);
}

function openEndDatePrompt(start, end) {
  showModal({
    title: 'Come back to enter the end date',
    body: 'It helps us give you timely reminders.',
    actions: [
      { label: "I'll add it later", style: 'btn-secondary', onClick: closeModal },
      { label: 'Save for now', style: 'btn-primary', onClick: () => { closeModal(); checkMonthConflictAndSave(start, end); } }
    ]
  });
}

async function checkMonthConflictAndSave(start, end) {
  const monthKey = DateUtil.monthKey(start);
  const existing = await TrackitDB.getPeriodByMonthKey(monthKey);
  const isSameRecordBeingEdited = existing && state.editingPeriodId && existing.id === state.editingPeriodId;

  if (existing && !isSameRecordBeingEdited) {
    showModal({
      title: "Update this month's dates?",
      body: `You already have dates saved for ${DateUtil.monthLabel(monthKey)}. Would you like to replace them with your latest dates?`,
      actions: [
        { label: 'Keep existing', style: 'btn-secondary', onClick: closeModal },
        { label: 'Save latest', style: 'btn-primary', onClick: () => { closeModal(); finalizeSave(start, end, monthKey, existing.id); } }
      ]
    });
    return;
  }

  await finalizeSave(start, end, monthKey, null);
}

async function finalizeSave(start, end, monthKey, replaceId) {
  if (replaceId && replaceId !== state.editingPeriodId) {
    await TrackitDB.deletePeriod(replaceId);
  }
  const record = { start, end, monthKey };
  if (state.editingPeriodId) record.id = state.editingPeriodId;
  await TrackitDB.putPeriod(record);

  await loadPeriods();
  state.calendarMonthKey = monthKey;
  resetForm();
  renderCalendar();
  renderHistory();
  await renderReminderBanner();
  showToast('Saved');
}

// ---------- Calendar ----------
function shiftCalendar(delta) {
  state.calendarMonthKey = DateUtil.addMonthsToKey(state.calendarMonthKey, delta);
  renderCalendar();
}

function periodsForDate(dateStr) {
  return state.periods.filter(p => dateStr >= p.start && dateStr <= p.end);
}

function renderCalendar() {
  el('cal-month-label').textContent = DateUtil.monthLabel(state.calendarMonthKey);
  const grid = el('day-grid');
  grid.innerHTML = '';
  const today = DateUtil.todayStr();
  const days = DateUtil.buildMonthGrid(state.calendarMonthKey);

  days.forEach(({ dateStr, dayNum, outside }) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell';
    if (outside) cell.classList.add('outside');
    if (dateStr === today) cell.classList.add('today');
    if (!outside && periodsForDate(dateStr).length) cell.classList.add('logged');
    cell.setAttribute('aria-label', dateStr);

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = dayNum;
    cell.appendChild(num);
    cell.addEventListener('click', () => onDayClick(dateStr, outside));
    grid.appendChild(cell);
  });
}

// Tapping the calendar feeds the "Add your dates" form above it.
function onDayClick(dateStr, outside) {
  if (outside) {
    state.calendarMonthKey = DateUtil.monthKey(dateStr);
    renderCalendar();
    return;
  }

  const existing = periodsForDate(dateStr)[0];
  if (existing) {
    setEditingPeriod(existing);
    return;
  }

  const startVal = el('start-date').value;
  const endVal = el('end-date').value;

  if (!startVal || endVal) {
    // Nothing picked yet, or a full pair is already picked — start fresh.
    state.editingPeriodId = null;
    el('editing-banner').classList.add('hidden');
    el('save-dates-btn').textContent = 'Save dates';
    el('start-date').value = dateStr;
    el('end-date').value = '';
  } else if (dateStr >= startVal) {
    el('end-date').value = dateStr;
  } else {
    el('start-date').value = dateStr;
    el('end-date').value = '';
  }

  setDateInputBounds();
  updateSaveButtonState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------- History ----------
function lastThreeMonthKeys() {
  const keys = [];
  let k = DateUtil.monthKey(DateUtil.todayStr());
  for (let i = 0; i < 3; i++) {
    keys.push(k);
    k = DateUtil.addMonthsToKey(k, -1);
  }
  return keys;
}

function renderHistory() {
  const keys = lastThreeMonthKeys();
  const items = state.periods
    .filter(p => keys.includes(p.monthKey))
    .sort((a, b) => (a.start < b.start ? 1 : -1));

  const list = el('history-list');
  const empty = el('history-empty');
  list.innerHTML = '';

  if (items.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  items.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'history-item';

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'history-item-main';
    main.setAttribute('aria-label', `Edit period from ${DateUtil.monthLabel(p.monthKey)}`);

    const dot = document.createElement('span');
    dot.className = 'history-dot';

    const info = document.createElement('span');
    info.className = 'history-info';
    const monthEl = document.createElement('div');
    monthEl.className = 'history-month';
    monthEl.textContent = DateUtil.monthLabel(p.monthKey);
    const rangeEl = document.createElement('div');
    rangeEl.className = 'history-range';
    rangeEl.textContent = DateUtil.rangeLabel(p.start, p.end);
    info.appendChild(monthEl);
    info.appendChild(rangeEl);

    main.appendChild(dot);
    main.appendChild(info);
    main.addEventListener('click', () => setEditingPeriod(p));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'chevron';
    del.textContent = '\u2715';
    del.setAttribute('aria-label', 'Delete this period');
    del.addEventListener('click', () => confirmDelete(p));

    row.appendChild(main);
    row.appendChild(del);

    list.appendChild(row);
  });
}

function confirmDelete(period) {
  showModal({
    title: 'Delete this period?',
    body: `This removes the ${DateUtil.monthLabel(period.monthKey)} entry (${DateUtil.rangeLabel(period.start, period.end)}). This can\u2019t be undone.`,
    actions: [
      { label: 'Cancel', style: 'btn-secondary', onClick: closeModal },
      { label: 'Delete', style: 'btn-primary', onClick: async () => {
          closeModal();
          await TrackitDB.deletePeriod(period.id);
          if (state.editingPeriodId === period.id) resetForm();
          await loadPeriods();
          renderCalendar();
          renderHistory();
          await renderReminderBanner();
          showToast('Deleted');
        } }
    ]
  });
}

// ---------- Reminders ----------
async function renderReminderBanner() {
  const banner = el('reminder-banner');
  const promptBanner = el('reminder-prompt-banner');
  banner.classList.add('hidden');
  promptBanner.classList.add('hidden');

  if (state.periods.length < 2) return;

  const status = Reminders.getReminderStatus(state.periods);
  const permission = ('Notification' in window) ? Notification.permission : 'unsupported';
  const dismissed = await TrackitDB.getMeta('reminderPromptDismissed');

  if (permission === 'default' && !dismissed) {
    promptBanner.classList.remove('hidden');
    return;
  }

  if (permission === 'granted' && status && status.inWindow && !status.alreadyLogged) {
    banner.classList.remove('hidden');
    el('reminder-banner-text').textContent = 'Your period may be due around now, based on your history.';
  }
}

async function onEnableReminders() {
  const result = await Reminders.requestPermission();
  await renderReminderBanner();
  Reminders.maybeNotify(state.periods);
  if (result === 'granted') tryRegisterPeriodicSync();
}

// Best-effort only: supported on some Android/Chrome installs, not iOS Safari.
async function tryRegisterPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker.ready;
    if ('periodicSync' in reg) {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state === 'granted') {
        await reg.periodicSync.register('trackit-reminder-check', { minInterval: 20 * 60 * 60 * 1000 });
      }
    } else if ('sync' in reg) {
      await reg.sync.register('trackit-reminder-check');
    }
  } catch (e) {
    // Silently ignore — foreground checks still cover the common case.
  }
}

async function onDismissReminderPrompt() {
  await TrackitDB.setMeta('reminderPromptDismissed', true);
  el('reminder-prompt-banner').classList.add('hidden');
}

// ---------- Modal ----------
function showModal({ title, body, actions }) {
  const backdrop = el('modal-backdrop');
  el('modal-title').textContent = title;
  el('modal-body').textContent = body;
  const actionsWrap = el('modal-actions');
  actionsWrap.innerHTML = '';
  actions.forEach(({ label, style, onClick }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn ${style}`;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    actionsWrap.appendChild(btn);
  });
  backdrop.classList.remove('hidden');
}

function closeModal() {
  el('modal-backdrop').classList.add('hidden');
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(message) {
  const toast = el('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline capability degrades gracefully if registration fails.
    });
  });
}

// Re-check reminder status whenever the app regains focus.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.profile) {
    Reminders.maybeNotify(state.periods);
    renderReminderBanner();
  }
});

boot();
