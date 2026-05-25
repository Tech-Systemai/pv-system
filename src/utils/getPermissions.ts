import { createAdminClient } from '@/utils/supabase/admin';

export type ViewType = 'none' | 'agent' | 'admin' | 'both';
export type PermMatrix = Record<string, Record<string, ViewType>>;

export const PERM_DEFAULTS: PermMatrix = {
  tasks:      { owner: 'both', admin: 'both',  supervisor: 'both',  accountant: 'none',  sales: 'agent', cx: 'agent', dentist: 'agent' },
  schedule:   { owner: 'both', admin: 'admin', supervisor: 'admin', accountant: 'none',  sales: 'agent', cx: 'agent', dentist: 'agent' },
  reports:    { owner: 'both', admin: 'admin', supervisor: 'admin', accountant: 'admin', sales: 'none',  cx: 'none',  dentist: 'none'  },
  tickets:    { owner: 'both', admin: 'both',  supervisor: 'both',  accountant: 'none',  sales: 'agent', cx: 'agent', dentist: 'admin' },
  hr:         { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
  contracts:  { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'admin', sales: 'agent', cx: 'none',  dentist: 'none'  },
  inbox:      { owner: 'both', admin: 'both',  supervisor: 'both',  accountant: 'both',  sales: 'agent', cx: 'agent', dentist: 'agent' },
  attendance: { owner: 'both', admin: 'admin', supervisor: 'admin', accountant: 'none',  sales: 'agent', cx: 'agent', dentist: 'agent' },
  monitoring: { owner: 'both', admin: 'admin', supervisor: 'admin', accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
  policy:     { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
  targets:    { owner: 'both', admin: 'both',  supervisor: 'both',  accountant: 'none',  sales: 'agent', cx: 'agent', dentist: 'none'  },
  coaching:   { owner: 'both', admin: 'admin', supervisor: 'admin', accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
  planning:   { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
  policies:   { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
  kb:         { owner: 'both', admin: 'both',  supervisor: 'both',  accountant: 'both',  sales: 'agent', cx: 'agent', dentist: 'none'  },
  chat:       { owner: 'both', admin: 'both',  supervisor: 'both',  accountant: 'both',  sales: 'agent', cx: 'agent', dentist: 'agent' },
  payroll:    { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'admin', sales: 'none',  cx: 'none',  dentist: 'none'  },
  finance:    { owner: 'both', admin: 'admin', supervisor: 'none',  accountant: 'admin', sales: 'none',  cx: 'none',  dentist: 'none'  },
  wise:       { owner: 'both', admin: 'admin', supervisor: 'agent', accountant: 'none',  sales: 'none',  cx: 'none',  dentist: 'none'  },
};

// Normalise a raw value that might be a legacy boolean or a ViewType string
function normalise(val: unknown): ViewType {
  if (val === true)  return 'both';
  if (val === false) return 'none';
  if (val === 'agent' || val === 'admin' || val === 'both') return val;
  return 'none';
}

export async function getPermMatrix(): Promise<PermMatrix> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('permissions')
    .select('matrix')
    .eq('id', 'main')
    .maybeSingle();

  if (!data?.matrix || Object.keys(data.matrix).length === 0) return PERM_DEFAULTS;

  // Merge saved with defaults so newly added modules always have a value
  const merged: PermMatrix = {};
  for (const mod of Object.keys(PERM_DEFAULTS)) {
    merged[mod] = {};
    for (const role of Object.keys(PERM_DEFAULTS[mod])) {
      const raw = (data.matrix as any)[mod]?.[role];
      merged[mod][role] = raw !== undefined ? normalise(raw) : PERM_DEFAULTS[mod][role];
    }
  }
  return merged;
}

export function resolveViewType(matrix: PermMatrix, module: string, role: string): ViewType {
  if (role === 'owner') return 'both';
  return normalise(matrix[module]?.[role]);
}

export const isAdminView = (v: ViewType) => v === 'admin' || v === 'both';
export const isAgentView = (v: ViewType) => v === 'agent' || v === 'both';
export const hasAccess   = (v: ViewType) => v !== 'none';
