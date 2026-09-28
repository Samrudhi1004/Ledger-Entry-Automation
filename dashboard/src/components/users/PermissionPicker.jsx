export default function PermissionPicker({ groups = [], common = [], value = [], onChange, disabled = false }) {
  const selected = new Set(value);

  const keysFor = (permission) => permission.keys?.length ? permission.keys : [permission.key];
  const isCommon = (permission) => keysFor(permission).every((key) => common.includes(key));

  const toggle = (keys, checked) => {
    const next = new Set(value);
    keys.forEach((key) => {
      if (checked) next.add(key);
      else next.delete(key);
    });
    onChange([...next].sort());
  };

  return (
    <div className="permission-picker" aria-label="Permission selector">
      {groups.map((group) => {
        const keys = group.permissions.flatMap(keysFor);
        const allSelected = keys.every((key) => selected.has(key));
        // The counter represents the visible choices in this group. Each
        // choice may expand to multiple backend action keys.
        const selectedCount = group.permissions.filter((permission) =>
          keysFor(permission).every((key) => selected.has(key))
        ).length;
        return (
          <fieldset key={group.name} className="permission-group">
            <legend className="permission-group-title">
              <label style={{ display: 'flex', gap: 9, alignItems: 'center', cursor: disabled ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={allSelected} disabled={disabled}
                  onChange={(event) => toggle(keys, event.target.checked)} />
                <span>{group.name}</span>
                <span className="permission-count">{selectedCount}/{group.permissions.length}</span>
              </label>
            </legend>
            <div className="permission-options">
              {group.permissions.map((item) => {
                const itemKeys = keysFor(item);
                const itemSelected = itemKeys.every((key) => selected.has(key));
                const itemCommon = isCommon(item);
                return (
                <label key={item.key} className={`permission-option${itemSelected ? ' is-selected' : ''}${itemCommon ? ' is-common' : ''}`}>
                  <input type="checkbox" checked={itemSelected}
                    disabled={disabled}
                    onChange={(event) => toggle(itemKeys, event.target.checked)} />
                  <span className="permission-option-text">
                    <span>{item.label}</span>
                    {itemCommon && <small>Default for new roles</small>}
                  </span>
                </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
