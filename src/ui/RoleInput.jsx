import { ROLE_SUGGESTIONS } from '../utils/employee.js'

const listId = 'zyoris-role-suggestions'

export function RoleInput({ value, onChange, placeholder = 'Type any role…' }) {
  return (
    <>
      <input
        className="input"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {ROLE_SUGGESTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </>
  )
}
