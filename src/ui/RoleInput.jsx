import { ROLE_SUGGESTIONS } from '../utils/employee.js'

const listId = 'zyoris-role-suggestions'

export function RoleInput({ value, onChange, placeholder = 'Type any role…' }) {
  return (
    <>
      <input
        className="input"
        list={listId}
        name="employee-role"
        type="text"
        inputMode="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        data-lpignore="true"
        data-form-type="other"
      />
      <datalist id={listId}>
        {ROLE_SUGGESTIONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </>
  )
}
