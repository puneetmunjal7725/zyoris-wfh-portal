import { useState } from 'react'
import { updateEmployee } from '../state/storage.js'

export function EmployeeProfileEditor({ employee, onSaved, onCancel }) {
  const [address, setAddress] = useState(employee.address || '')
  const [compensation, setCompensation] = useState(employee.compensation || '')
  const [compensationType, setCompensationType] = useState(employee.compensationType || 'Salary')
  const [photo, setPhoto] = useState(employee.photo || '')
  const [error, setError] = useState('')

  function onPhotoPick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 800_000) {
      setError('Photo must be under 800 KB.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(file)
  }

  function save() {
    setError('')
    updateEmployee(employee.id, (e) => ({
      ...e,
      address: address.trim(),
      compensation: compensation.trim(),
      compensationType,
      photo,
    }))
    onSaved()
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="cardHeader">
        <div>
          <div className="cardHeaderTitle">Edit profile — {employee.name}</div>
          <div className="cardHeaderSub">Employee ID: {employee.id}</div>
        </div>
      </div>
      <div className="cardBody">
        <div className="profileEditGrid">
          <div className="profilePhotoWrap">
            {photo ? (
              <img className="profilePhoto" src={photo} alt={employee.name} />
            ) : (
              <div className="profilePhotoPlaceholder">{employee.name?.charAt(0) || '?'}</div>
            )}
            <label className="btn" style={{ marginTop: 10, cursor: 'pointer' }}>
              Upload photo
              <input type="file" accept="image/*" hidden onChange={onPhotoPick} />
            </label>
          </div>
          <div className="grid2" style={{ flex: 1 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="label">Address</div>
              <textarea
                className="textarea"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Employee address"
              />
            </div>
            <div>
              <div className="label">Pay type</div>
              <select
                className="select"
                value={compensationType}
                onChange={(e) => setCompensationType(e.target.value)}
              >
                <option>Salary</option>
                <option>Stipend</option>
              </select>
            </div>
            <div>
              <div className="label">Amount / details</div>
              <input
                className="input"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
                placeholder="e.g. ₹25,000 / month"
              />
            </div>
          </div>
        </div>
        {error ? <div className="formError" style={{ marginTop: 10 }}>{error}</div> : null}
        <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btnPrimary" onClick={save}>
            Save profile
          </button>
        </div>
      </div>
    </div>
  )
}
