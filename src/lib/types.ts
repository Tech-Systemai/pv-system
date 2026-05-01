export type Role = 'owner' | 'admin' | 'supervisor' | 'accountant' | 'sales' | 'cx';
export type Department = 'Executive' | 'Mgmt' | 'Finance' | 'Sales' | 'CX';

export interface Employee {
  id: string;
  username: string;
  name: string;
  role: Role;
  dept: Department;
  salary: number;
  points: number;
  score: number;
  status: 'Active' | 'Inactive' | 'Suspended';
  location: string;
  hired: string;
  clockedIn: boolean;
  currentActivity?: string;
}

export interface Applicant {
  id: string;
  name: string;
  position: 'Sales' | 'CX';
  score: number;
  email: string;
  status: 'New' | 'Interviewed' | 'Offered' | 'Rejected';
}

export interface Contract {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  createdAt: string;
  status: 'Draft' | 'Signed' | 'Active';
}

export interface Schedule {
  id: string;
  submittedBy: string;
  week: string;
  team: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  employeesAffected: number;
}

export interface Task {
  id: string;
  title: string;
  assignedTo: string;
  assignedBy: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High';
  acknowledged: boolean;
  completed: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  submittedBy: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'In Progress' | 'Resolved';
  time: string;
}
