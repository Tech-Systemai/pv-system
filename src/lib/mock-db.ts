import { Employee, Applicant, Contract, Schedule, Task, Ticket } from './types';

export const mockEmployees: Employee[] = [
  { id: 'EMP001', username: 'ahmed', name: 'Ahmed Hassan', role: 'sales', dept: 'Sales', salary: 2800, points: 6, score: 94, status: 'Active', location: 'Cairo', hired: '2024-03-12', clockedIn: true, currentActivity: 'Customer call' },
  { id: 'EMP002', username: 'maria', name: 'Maria Santos', role: 'cx', dept: 'CX', salary: 2400, points: 7, score: 88, status: 'Active', location: 'Manila', hired: '2024-05-20', clockedIn: true, currentActivity: 'Logging collection' },
  { id: 'EMP004', username: 'lena', name: 'Lena Müller', role: 'supervisor', dept: 'Mgmt', salary: 4200, points: 7, score: 97, status: 'Active', location: 'Berlin', hired: '2023-01-15', clockedIn: true, currentActivity: 'Reviewing reports' },
  { id: 'EMP005', username: 'priya', name: 'Priya Sharma', role: 'admin', dept: 'Mgmt', salary: 3800, points: 7, score: 95, status: 'Active', location: 'Mumbai', hired: '2023-09-10', clockedIn: true, currentActivity: 'Approving schedules' },
  { id: 'OWN001', username: 'owner', name: 'Alexandra Voss', role: 'owner', dept: 'Executive', salary: 0, points: 7, score: 100, status: 'Active', location: 'HQ', hired: '2022-01-01', clockedIn: true, currentActivity: 'System overview' },
];

export const mockApplicants: Applicant[] = [
  { id: 'APP001', name: 'Sara Kim', position: 'Sales', score: 93, email: 'sara.k@email.com', status: 'Interviewed' },
  { id: 'APP002', name: 'Tom Bradley', position: 'CX', score: 68, email: 't.brad@email.com', status: 'Interviewed' },
  { id: 'APP003', name: 'Nina Petrov', position: 'Sales', score: 96, email: 'nina.p@email.com', status: 'New' },
];

export const mockContracts: Contract[] = [
  { id: 'CON001', employeeId: 'EMP001', employeeName: 'Ahmed Hassan', type: 'Full-Time Remote', createdAt: '2024-03-10', status: 'Active' },
  { id: 'CON002', employeeId: 'EMP002', employeeName: 'Maria Santos', type: 'Full-Time Remote', createdAt: '2024-05-18', status: 'Active' },
];

export const mockSchedules: Schedule[] = [
  { id: 'SCH001', submittedBy: 'Lena Müller', week: 'Apr 28–May 4', team: 'Sales Team', status: 'Pending', employeesAffected: 5 },
  { id: 'SCH002', submittedBy: 'Priya Sharma', week: 'Apr 28–May 4', team: 'CX Team', status: 'Approved', employeesAffected: 6 },
];

export const mockTasks: Task[] = [
  { id: 'T001', title: 'Follow up with Tuesday leads', assignedTo: 'Ahmed Hassan', assignedBy: 'Lena Müller', dueDate: 'Today', priority: 'High', acknowledged: true, completed: false },
  { id: 'T002', title: 'Submit weekly summary', assignedTo: 'James Okafor', assignedBy: 'Lena Müller', dueDate: 'Tomorrow', priority: 'Medium', acknowledged: false, completed: false },
  { id: 'T003', title: 'Customer escalation review', assignedTo: 'Maria Santos', assignedBy: 'Priya Sharma', dueDate: 'Today', priority: 'High', acknowledged: true, completed: true },
];

export const mockTickets: Ticket[] = [
  { id: 'TK001', title: 'Payment gateway not processing', submittedBy: 'Ahmed Hassan', priority: 'High', status: 'Open', time: '1h ago' },
  { id: 'TK002', title: 'CRM sync issue', submittedBy: 'James Okafor', priority: 'Low', status: 'In Progress', time: 'Yesterday' },
];

export const mockPolicies = [
  { id: 'P1', name: 'Late Clock-In Penalty', trigger: 'Every 5 min late', action: '-0.5 points · -$10 salary', active: true, executed: 8 },
  { id: 'P2', name: 'No-Show Penalty', trigger: 'Full day absence', action: '-3 points · -$60 salary', active: true, executed: 2 },
  { id: 'P3', name: 'Termination Trigger', trigger: '7 points lost in cycle', action: 'Auto-flag for termination review', active: true, executed: 0 },
];

export const mockLiveFeed = [
  { time: 'Just now', user: 'Ahmed Hassan', action: 'Logged revenue $1,200', type: 'green' },
  { time: '2m', user: 'Lena Müller', action: 'Submitted Sales Team schedule', type: 'cyan' },
  { time: '5m', user: 'Maria Santos', action: 'Clocked in (1 min late · flagged)', type: 'amber' },
  { time: '12m', user: 'System', action: 'Auto-deducted -0.5 pts from EMP002', type: 'pink' },
  { time: '25m', user: 'James Okafor', action: 'Clocked out', type: 'gray' },
];
