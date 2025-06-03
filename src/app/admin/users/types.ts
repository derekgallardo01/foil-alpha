import { Session } from 'next-auth';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  registeredAt: string;
  lastLoginAt?: string;
  subscriptionStatus: string;
  auditTrail?: { action: string; by: string; at: string }[];
  password?: string;
}

export interface ActivityLogEntry {
  id: number;
  userId: number;
  action: string;
  timestamp: string;
}

export interface AdminSession extends Session {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    subscriptionStatus: string;
    isVerified: boolean;
    accessToken: string;
  };
}

export interface GridColDef {
  field: string;
  headerName: string;
  width: number;
  sortable?: boolean;
  valueFormatter?: (params: { value: string | number | undefined | { action: string; by: string; at: string }[] }) => string;
  renderCell?: (params: { row: User; id: number }) => React.ReactNode;
}