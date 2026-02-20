import React, { useContext, useState } from 'react';
import { LanguageContext } from '../App';

interface Node {
  id: string;
  name: string;
  status: 'ACTIVE' | 'VIOLATION' | 'IDLE';
}

const AdminDashboardPanel: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { t } = useContext(LanguageContext);
  const [nodes] = useState<Node[]>([
    { id: '1', name: 'STUDENT_001', status: 'ACTIVE' },
    { id: '2', name: 'STUDENT_042', status: 'VIOLATION' },
    { id: '3', name: 'STUDENT_112', status: 'ACTIVE' },
    { id: '4', name: 'STUDENT_098', status: 'IDLE' },
  ]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-6">
      <div className="mb-4 flex items-center justify-between border-b border-[#39ff14]/20 pb-4">
        <div>
          <h1 className="neon-glow text-xl font-bold uppercase tracking-[0.2em]">PROCTOR_DASH</h1>
          <p className="mt-1 text-[9px] uppercase tracking-[0.2em] opacity-50">NODES_CONNECTED: {nodes.length}</p>
        </div>
        <button
          onClick={onLogout}
          className="border border-red-500 px-3 py-1 text-[10px] font-bold uppercase text-red-500 transition-colors hover:bg-red-500 hover:text-black"
        >
          {t.exit}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 border border-[#39ff14]/20 bg-[#0a0a0a] text-[11px] uppercase tracking-[0.2em]">
        <span className="bg-[#39ff14] px-3 py-2 text-center font-black text-black">{t.tab_monitor}</span>
        <span className="px-3 py-2 text-center opacity-50">{t.tab_tokens}</span>
        <span className="px-3 py-2 text-center opacity-50">{t.tab_whitelist}</span>
      </div>

      <div className="space-y-3">
        {nodes.map((item) => (
          <div key={item.id} className="flex items-center justify-between border border-[#39ff14]/30 bg-[#0a0a0a]/90 p-4">
            <div>
              <p className="text-sm font-bold tracking-[0.08em]">{item.name}</p>
              <p className="text-[9px] uppercase tracking-[0.16em] opacity-50">ID: {item.id} // SYS_STABLE</p>
            </div>
            <span
              className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] ${
                item.status === 'VIOLATION' ? 'border-red-500 text-red-500' : 'border-[#39ff14] text-[#39ff14]'
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboardPanel;
