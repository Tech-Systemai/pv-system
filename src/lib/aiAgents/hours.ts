// The agents keep office hours: 9:00 to 5:00 in the founder's time zone. The
// GitHub schedule fires a bit either side of that, so the real gate is here,
// which also keeps working when the clocks change.

export const WORK_TZ = 'America/New_York';
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 17;

function parts(now: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: WORK_TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })
      .formatToParts(now).map(x => [x.type, x.value]),
  );
  // Midnight can come back as "24" in some runtimes.
  const hour = Number(p.hour) % 24;
  return { weekday: String(p.weekday), hour, minute: Number(p.minute) };
}

export function isWorkHours(now = new Date()) {
  const { hour } = parts(now);
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

/** "9:00 AM ET" style label for when the team is back, for the UI. */
export function hoursLabel(now = new Date()) {
  const { hour, minute } = parts(now);
  const clock = `${((hour + 11) % 12) + 1}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
  if (isWorkHours(now)) return { open: true, text: `On duty · 9–5 ET, now ${clock} ET` };
  return { open: false, text: `Off duty until 9:00 AM ET (now ${clock} ET)` };
}
