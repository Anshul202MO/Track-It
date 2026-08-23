// Track it — notifications.js
// Reminder math + local notification delivery.
// No period data or name is ever sent anywhere; everything here runs on-device.

const MIN_INTERVAL = 21;
const MAX_INTERVAL = 45;
const WINDOW_DAYS = 3;

const Reminders = {
  // periods: array sorted ascending by start date ("YYYY-MM-DD")
  estimateNextStart(periods) {
    if (!periods || periods.length < 2) return null;

    const starts = periods.map(p => p.start).sort();
    const intervals = [];
    for (let i = 1; i < starts.length; i++) {
      const gap = DateUtil.diffDays(starts[i - 1], starts[i]);
      if (gap >= MIN_INTERVAL && gap <= MAX_INTERVAL) intervals.push(gap);
    }
    if (intervals.length === 0) return null;

    const avg = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    const clamped = Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, avg));
    const lastStart = starts[starts.length - 1];
    return DateUtil.addDays(lastStart, clamped);
  },

  // Returns { estimatedStart, windowStart, windowEnd, inWindow, alreadyLogged } or null.
  getReminderStatus(periods) {
    const estimatedStart = Reminders.estimateNextStart(periods);
    if (!estimatedStart) return null;

    const windowStart = DateUtil.addDays(estimatedStart, -WINDOW_DAYS);
    const windowEnd = DateUtil.addDays(estimatedStart, WINDOW_DAYS);
    const today = DateUtil.todayStr();
    const inWindow = today >= windowStart && today <= windowEnd;

    const alreadyLogged = periods.some(p => p.start >= windowStart && p.start <= DateUtil.todayStr());

    return { estimatedStart, windowStart, windowEnd, inWindow, alreadyLogged };
  },

  async maybeNotify(periods) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const status = Reminders.getReminderStatus(periods);
    if (!status || !status.inWindow || status.alreadyLogged) return;

    const lastShown = await TrackitDB.getMeta('lastReminderShown');
    const today = DateUtil.todayStr();
    if (lastShown === today) return; // once per day at most

    const body = 'Your period may be due around today. If it has started, add your dates.';
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('Track it', {
        body,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'trackit-reminder'
      });
    } else {
      new Notification('Track it', { body, icon: 'icons/icon-192.png' });
    }
    await TrackitDB.setMeta('lastReminderShown', today);
  },

  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }
};
