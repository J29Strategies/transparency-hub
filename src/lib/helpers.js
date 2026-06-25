export function initials(firstName, lastName) {
  return ((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase()
}

export function fullName(profile) {
  if (!profile) return '—'
  return `${profile.first_name} ${profile.last_name}`.trim()
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffMins < 2) return 'Just now'
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return formatDate(dateStr)
}

export function stabilityClass(stability) {
  if (!stability || stability === 'Unknown') return 'neutral'
  if (stability === 'Stable') return 'stable'
  if (stability === 'Unstable') return 'unstable'
  return 'at-risk'
}

export function statusClass(status) {
  const map = {
    open: 'open',
    claimed: 'claimed',
    closed: 'closed',
    unable_to_fulfill: 'unable',
  }
  return map[status] ?? 'neutral'
}

export function statusLabel(status) {
  const map = {
    open: 'Open',
    claimed: 'In Progress',
    closed: 'Closed',
    unable_to_fulfill: 'Unable to Fulfill',
  }
  return map[status] ?? status
}
