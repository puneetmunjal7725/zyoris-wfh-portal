export const PAY_TYPES = ['Salary', 'Stipend', 'Unpaid']

/** Suggestions only — any custom text is allowed */
export const ROLE_SUGGESTIONS = [
  'Engineer',
  'Senior Engineer',
  'Team Lead',
  'Manager',
  'HR',
  'QA',
  'Intern',
  'Designer',
  'DevOps',
  'Product',
  'Operations',
  'Sales',
  'Support',
]

export function payTypeLabel(type) {
  if (type === 'Stipend') return 'Stipend'
  if (type === 'Unpaid') return 'Unpaid'
  return 'Salary'
}

export function isValidEmail(value) {
  if (!value?.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
