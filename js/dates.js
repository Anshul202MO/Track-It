// Track it — dates.js
// All dates are handled as local-time "YYYY-MM-DD" strings to avoid timezone drift.

const DateUtil = {
  todayStr() {
    return DateUtil.toStr(new Date());
  },

  toStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  fromStr(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  addDays(dateStr, n) {
    const d = DateUtil.fromStr(dateStr);
    d.setDate(d.getDate() + n);
    return DateUtil.toStr(d);
  },

  diffDays(aStr, bStr) {
    const a = DateUtil.fromStr(aStr);
    const b = DateUtil.fromStr(bStr);
    return Math.round((b - a) / 86400000);
  },

  minSelectableDate() {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return DateUtil.toStr(d);
  },

  maxSelectableDate() {
    return DateUtil.todayStr();
  },

  isWithinSelectableRange(dateStr) {
    return dateStr >= DateUtil.minSelectableDate() && dateStr <= DateUtil.maxSelectableDate();
  },

  monthKey(dateStr) {
    return dateStr.slice(0, 7); // "YYYY-MM"
  },

  monthLabel(dateStr) {
    const d = DateUtil.fromStr(dateStr + (dateStr.length === 7 ? '-01' : ''));
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  },

  shortDateLabel(dateStr) {
    const d = DateUtil.fromStr(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  },

  rangeLabel(startStr, endStr) {
    if (startStr === endStr) return DateUtil.shortDateLabel(startStr);
    return `${DateUtil.shortDateLabel(startStr)} – ${DateUtil.shortDateLabel(endStr)}`;
  },

  // Builds a 6-row calendar grid (42 days) for the given YYYY-MM month key,
  // starting on Sunday, including leading/trailing days from adjacent months.
  buildMonthGrid(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const startOffset = first.getDay(); // 0 = Sunday
    const gridStart = new Date(y, m - 1, 1 - startOffset);
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push({
        dateStr: DateUtil.toStr(d),
        dayNum: d.getDate(),
        outside: d.getMonth() !== m - 1
      });
    }
    return days;
  },

  addMonthsToKey(monthKey, n) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
};
