export const PAY_TYPES = ['Salary', 'Stipend', 'Unpaid']

export function payTypeLabel(type) {
  if (type === 'Stipend') return 'Stipend'
  if (type === 'Unpaid') return 'Unpaid'
  return 'Salary'
}

export function isValidEmail(value) {
  if (!value?.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
