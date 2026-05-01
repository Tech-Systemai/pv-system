export default function DesignPage() {
  return (
    <div className="two">
      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Brand configuration</div>
        <div className="pv-fld"><label>Logo</label><input type="text" placeholder=".png or .svg" /></div>
        <div className="pv-fld"><label>Primary color</label><input type="text" defaultValue="#4F46E5" /></div>
        <div className="pv-fld">
          <label>Apply to</label>
          <div style={{ display: 'grid', gap: '5px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input type="checkbox" defaultChecked /> Payslips
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input type="checkbox" defaultChecked /> Contracts
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input type="checkbox" defaultChecked /> Reports
            </label>
          </div>
        </div>
        <button className="pv-btn pv-btn-pri" style={{ marginTop: '16px' }}>Save template</button>
      </div>

      <div className="pn">
        <div className="pn-t" style={{ marginBottom: '13px' }}>Live preview</div>
        <div style={{ background: '#fff', border: '1px solid #e4e7eb', padding: '22px', borderRadius: '8px', minHeight: '340px' }}>
          <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '13px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>PV</div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700 }}>Pioneers Veneers</div>
              <div style={{ fontSize: '10px', color: '#6b7689', textTransform: 'uppercase' }}>Performance Report</div>
            </div>
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.7, color: '#4a5568' }}>
            All generated PDFs follow this branded template format.
          </div>
        </div>
      </div>
    </div>
  );
}
