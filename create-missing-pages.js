const fs = require('fs');
const path = require('path');

const ids = [
  'dashboard', 'monitoring', 'analytics', 'inbox', 'chat', 'users', 'hr', 'org', 
  'attendance', 'timeoff', 'schedule', 'approvals', 'tasks', 'reports', 'contracts', 
  'tickets', 'coaching', 'planning', 'finance', 'payroll', 'targets', 'kb', 
  'permissions', 'policy', 'audit', 'design', 'mydash', 'myschedule', 'mytasks', 
  'revenue', 'mytarget', 'mytimeoff', 'collections'
];

const basePath = path.join(__dirname, 'src', 'app', 'dashboard', '[role]');

ids.forEach(id => {
  if (id === 'dashboard') return;
  const dirPath = path.join(basePath, id);
  const filePath = path.join(dirPath, 'page.tsx');
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  if (!fs.existsSync(filePath)) {
    const content = `export default function ${id.charAt(0).toUpperCase() + id.slice(1)}Page() {
  return (
    <div className="pn">
      <div className="pn-h">
        <div className="pn-t">${id.charAt(0).toUpperCase() + id.slice(1)} Portal</div>
      </div>
      <div style={{ padding: '20px', textAlign: 'center', color: '#6b7689' }}>
        This module is currently in development.
      </div>
    </div>
  );
}
`;
    fs.writeFileSync(filePath, content);
    console.log('Created missing page for', id);
  }
});
