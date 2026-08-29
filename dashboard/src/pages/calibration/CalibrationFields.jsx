export function EquipmentFields({ formData, onChange }) {
  return (
    <div className="calibration-form-grid">
      <Field label="Equipment ID" name="equipment_id" value={formData.equipment_id} onChange={onChange} required />
      <Field label="Equipment Name" name="equipment_name" value={formData.equipment_name} onChange={onChange} required />
      <Field label="Equipment Type" name="equipment_type" value={formData.equipment_type} onChange={onChange} required />
      <Field label="Serial Number" name="serial_number" value={formData.serial_number} onChange={onChange} required />
      <Field label="Department" name="department" value={formData.department} onChange={onChange} required />
      <Field label="Location" name="location" value={formData.location} onChange={onChange} required />
      <Field label="Calibration Frequency (days)" name="calibration_frequency_days" type="number" min="1" value={formData.calibration_frequency_days} onChange={onChange} required />
      <Field label="Last Calibration Date" name="last_calibration_date" type="date" value={formData.last_calibration_date} onChange={onChange} required />
      <Field label="Next Calibration Due Date" name="next_calibration_date" type="date" value={formData.next_calibration_date} onChange={onChange} required />
      <div className="form-group calibration-form-span">
        <label className="form-label" htmlFor="calibration-remarks">Remarks</label>
        <textarea id="calibration-remarks" className="form-textarea" name="remarks" value={formData.remarks} onChange={onChange} />
      </div>
    </div>
  );
}

export function Field({ label, name, type = 'text', value, onChange, required = false, min }) {
  const id = `calibration-${name}`;
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}{required ? ' *' : ''}</label>
      <input id={id} className="form-input" name={name} type={type} min={min} value={value} onChange={onChange} required={required} />
    </div>
  );
}
