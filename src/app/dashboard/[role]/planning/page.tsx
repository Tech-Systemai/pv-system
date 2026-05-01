export default function PlanningPage() {
  return (
    <div className="pv-panel">
      <h2 className="pv-panel-title">Strategic Planning Workspace</h2>
      
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Document Selection Side */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '16px' }}>
            <button className="pv-btn pv-btn-sec" style={{ width: '100%', borderStyle: 'dashed' }}>+ Upload New Plan Document</button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {['Q3 Marketing Strategy', 'Annual Hiring Plan', 'Expansion Roadmap'].map((doc, i) => (
              <div key={i} style={{ 
                padding: '16px', background: i === 0 ? '#eef2ff' : '#fff', 
                border: `1px solid ${i === 0 ? '#c7d2fe' : '#e4e7eb'}`, borderRadius: '6px',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: i === 0 ? '#4338ca' : '#1a1f2e' }}>{doc}</div>
                <div style={{ fontSize: '11px', color: '#6b7689', marginTop: '4px' }}>PDF • Last updated 2 days ago</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Chatbot Side */}
        <div style={{ flex: 2, background: '#fff', border: '1px solid #e4e7eb', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #e4e7eb', background: '#f8fafc', borderRadius: '8px 8px 0 0' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#4a5568' }}>AI ASSISTANT: Q3 Marketing Strategy</div>
          </div>
          
          <div style={{ flex: 1, padding: '16px', color: '#1a1f2e', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ alignSelf: 'flex-end', background: '#eef2ff', color: '#4338ca', padding: '12px 16px', borderRadius: '12px 12px 0 12px', maxWidth: '80%' }}>
              What is our allocated budget for influencer campaigns in August?
            </div>
            <div style={{ alignSelf: 'flex-start', background: '#f5f6f8', color: '#4a5568', padding: '12px 16px', borderRadius: '12px 12px 12px 0', maxWidth: '80%' }}>
              Based on the document, the August budget for influencer campaigns is $12,500, targeting 3 mid-tier creators.
            </div>
          </div>
          
          <div style={{ padding: '16px', borderTop: '1px solid #e4e7eb' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" style={{ flex: 1, padding: '10px 14px', border: '1px solid #d8dde5', borderRadius: '8px', fontSize: '13px', outline: 'none' }} placeholder="Ask a question about this document..." />
              <button className="pv-btn pv-btn-pri">Ask</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
