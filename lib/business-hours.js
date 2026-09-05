/**
 * Business-hours detection (timezone-aware).
 *
 * Step config shape:
 *   timezone: 'Asia/Kolkata'           // IANA tz (default: process.env.TZ)
 *   hours: { mon: ['09:00-18:00'], tue: [...], ... }  // 24h "HH:MM-HH:MM"
 *   includeWeekends: true | false      // default false
 *   overrideContextKey: 'is_business_hours'
 *
 * Uses Intl.DateTimeFormat to get the current weekday + hour in the target tz,
 * so DST transitions are handled correctly without external libs.
 */

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function parseHHMM(str) {
  const [h, m] = String(str).split(':').map((n) => parseInt(n, 10))
  return (h || 0) * 60 + (m || 0)
}

function getLocalPartsInTz(timezone, now = new Date()) {
  const tz = timezone || process.env.TZ || 'UTC'
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
  const parts = fmt.formatToParts(now)
  let weekdayShort = ''
  let hour = 0
  let minute = 0
  for (const p of parts) {
    if (p.type === 'weekday') weekdayShort = p.value
    else if (p.type === 'hour') hour = parseInt(p.value, 10) % 24
    else if (p.type === 'minute') minute = parseInt(p.value, 10)
  }
  const dayKeyMap = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' }
  const dayKey = dayKeyMap[weekdayShort] || 'mon'
  return { dayKey, minutesOfDay: hour * 60 + minute, weekday: weekdayShort }
}

export function isWithinBusinessHours({
  timezone,
  hours = {},
  includeWeekends = false,
  now = new Date()
}) {
  const { dayKey, minutesOfDay } = getLocalPartsInTz(timezone, now)
  const isWeekend = dayKey === 'sat' || dayKey === 'sun'
  if (isWeekend && !includeWeekends) return { open: false, dayKey, reason: 'weekend' }

  const todayHours = hours[dayKey]
  if (!Array.isArray(todayHours) || todayHours.length === 0) {
    return { open: false, dayKey, reason: 'no_hours_configured' }
  }

  for (const range of todayHours) {
    const [startStr, endStr] = String(range).split('-')
    if (!startStr || !endStr) continue
    const start = parseHHMM(startStr)
    const end = parseHHMM(endStr)
    if (minutesOfDay >= start && minutesOfDay <= end) {
      return { open: true, dayKey, currentMinutes: minutesOfDay }
    }
  }
  return { open: false, dayKey, currentMinutes: minutesOfDay, reason: 'outside_window' }
}

/**
 * Pretty directive for an after-hours reply.
 */
export function businessHoursDirective(hours = {}) {
  const days = Object.keys(hours).filter((d) => hours[d]?.length)
  if (!days.length) return 'We are currently unavailable. We will reply during business hours.'
  const todayKey = DAY_KEYS[new Date().getDay()]
  if (hours[todayKey]?.length) {
    return `We are currently outside business hours. Today's hours were ${hours[todayKey].join(', ')}.`
  }
  return `We are currently outside business hours. Please reply during our next open window.`
}