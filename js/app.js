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
  selection: { start: null, end: null }
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

  el('cal-prev').addEventListener('click', () => shiftCalendar(-1));
  el('cal-next').addEventListener('click', () => shiftCalendar(1));
  el('reminder-enable-btn').addEventListener('click', onEnableReminders);
  el('reminder-dismiss-btn').addEventListener('click', onDismissReminderPrompt);
  el('confirm-cancel-btn').addEventListener('click', clearSelection);
  el('confirm-save-btn').addEventListener('click', attemptSaveFromSelection);

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]')) closeModal();
  });
}

// ---------- Home ----------
async function showHome() {
  el('onboarding-screen').classList.add('hidden');
  el('home-screen').classList.remove('hidden');
  el('greeting').textContent = `Hi, ${state.profile.name}`;
  clearSelection();
  renderCalendar();
  renderHistory();
  await renderReminderBanner();
  Reminders.maybeNotify(state.periods);
}

function renderSwatchesInto(containerId, onSelect) {
  const wrap = el(containerId);
  wrap.innerHTML = '';
  PALETTE.forEach(({ name, hex }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.style.background = hex;
    btn.setAttribute('aria-label', name);
    btn.setAttribute('aria-pressed', String(state.profile.color === hex));
    btn.addEventListener('click', () => onSelect(hex));
    wrap.appendChild(btn);
  });
}

async function selectColor(hex) {
  state.profile = await TrackitDB.saveProfile({ ...state.profile, color: hex });
  document.documentElement.style.setProperty('--period-color', hex);
  renderCalendar();
  renderHistory();
  renderConfirmBar();
}

// ---------- Calendar-driven date selection ----------
function clearSelection() {
  state.editingPeriodId = null;
  state.selection = { start: null, end: null };
  renderConfirmBar();
}

function openSelectionForEdit(period) {
  state.editingPeriodId = period.id;
  state.selection = { start: period.start, end: period.end };
  state.calendarMonthKey = period.monthKey;
  renderCalendar();
  renderConfirmBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderConfirmBar() {
  const bar = el('confirm-bar');
  const { start, end } = state.selection;

  if (!start) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');

  const label = el('confirm-bar-label');
  label.textContent = end
    ? DateUtil.rangeLabel(start, end)
    : `${DateUtil.shortDateLabel(start)} — tap an end day`;

  el('confirm-bar-error').textContent = '';
  el('confirm-save-btn').disabled = !end;
  el('confirm-save-btn').textContent = state.editingPeriodId ? 'Update dates' : 'Save dates';

  renderSwatchesInto('confirm-bar-swatches', selectColor);
}

// ---------- Calendar ----------
function shiftCalendar(delta) {
  const next = DateUtil.addMonthsToKey(state.calendarMonthKey, delta);
  const minMonth = DateUtil.monthKey(DateUtil.minSelectableDate());
  const maxMonth = DateUtil.monthKey(DateUtil.maxSelectableDate());
  if (next < minMonth || next > maxMonth) return;
  state.calendarMonthKey = next;
  renderCalendar();
}

function periodsForDate(dateStr) {
  return state.periods.filter(p => dateStr >= p.start && dateStr <= p.end);
}

function renderCalendar() {
  el('cal-month-label').textContent = DateUtil.monthLabel(state.calendarMonthKey);
  const minMonth = DateUtil.monthKey(DateUtil.minSelectableDate());
  const maxMonth = DateUtil.monthKey(DateUtil.maxSelectableDate());
  el('cal-prev').disabled = state.calendarMonthKey <= minMonth;
  el('cal-next').disabled = state.calendarMonthKey >= maxMonth;

  const grid = el('day-grid');
  grid.innerHTML = '';
  const today = DateUtil.todayStr();
  const days = DateUtil.buildMonthGrid(state.calendarMonthKey);
  const { start: selStart, end: selEnd } = state.selection;

  days.forEach(({ dateStr, dayNum, outside }) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day-cell';
    const inRangeAllowed = DateUtil.isWithinSelectableRange(dateStr);

    if (outside) cell.classList.add('outside');
    if (dateStr === today) cell.classList.add('today');
    if (!outside && periodsForDate(dateStr).length) cell.classList.add('logged');
    if (!outside && !inRangeAllowed) cell.classList.add('unselectable');

    if (!outside) {
      if (dateStr === selStart) cell.classList.add('range-start');
      if (dateStr === selEnd) cell.classList.add('range-end');
      if (selStart && selEnd && dateStr > selStart && dateStr < selEnd) cell.classList.add('in-range');
    }

    cell.setAttribute('aria-label', dateStr);

    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = dayNum;
    cell.appendChild(num);
    cell.addEventListener('click', () => onDayClick(dateStr, outside, inRangeAllowed));
    grid.appendChild(cell);
  });
}

// Tapping the calendar drives selection; the confirm bar reflects it live.
function onDayClick(dateStr, outside, inRangeAllowed) {
  if (outside) {
    const targetMonth = DateUtil.monthKey(dateStr);
    const minMonth = DateUtil.monthKey(DateUtil.minSelectableDate());
    const maxMonth = DateUtil.monthKey(DateUtil.maxSelectableDate());
    if (targetMonth >= minMonth && targetMonth <= maxMonth) {
      state.calendarMonthKey = targetMonth;
      renderCalendar();
    }
    return;
  }

  if (!inRangeAllowed) return;

  const sel = state.selection;

  // Nothing selected yet and this day already has a saved period — open it for editing.
  if (!sel.start) {
    const existing = periodsForDate(dateStr)[0];
    if (existing) {
      openSelectionForEdit(existing);
      return;
    }
  }

  if (!sel.start || (sel.start && sel.end)) {
    state.editingPeriodId = null;
    sel.start = dateStr;
    sel.end = null;
  } else if (dateStr >= sel.start) {
    sel.end = dateStr;
  } else {
    sel.start = dateStr;
    sel.end = null;
  }

  renderCalendar();
  renderConfirmBar();
}

async function attemptSaveFromSelection() {
  const { start, end } = state.selection;
  const errorEl = el('confirm-bar-error');
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
  clearSelection();
  renderCalendar();
  renderHistory();
  await renderReminderBanner();
  showToast('Saved');
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
    main.addEventListener('click', () => openSelectionForEdit(p));

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
          if (state.editingPeriodId === period.id) clearSelection();
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
