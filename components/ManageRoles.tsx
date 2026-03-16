import React from 'react';
import { ROLE_NAMES } from '../types';

/** Read-only view: default roles (3) + tags (Lead Manager, Accountant). */
const DEFAULT_ROLE_CAPABILITIES: Record<string, string[]> = {
  'Super Admin': [
    'Full system access (all in one).',
    'Branches, Manage Roles, Website Integration (Settings).',
    'All leads, invoices, payments, customers, itineraries, visas, job applicants, sub agents, destinations, transfers, attractions.',
  ],
  'Manager': [
    'Manage their own branch only.',
    'Delete leads in their branch; add users in their branch; add leads for their branch.',
    'Leads, customers, itineraries, visas, invoices, payments, transactions (branch-scoped).',
  ],
  'Staff': [
    'See only their assigned leads; edit their own leads.',
    'See itineraries, invoices, visas, customers of their branch.',
    'Flights, Hotels, Invoices, Payments of their handling leads.',
    'Calendar, Dashboard.',
  ],
};

const TAG_CAPABILITIES: Record<string, string[]> = {
  'Lead Manager': [
    'Manage leads of all branches.',
    'Job applications, sub agent registrations: see, edit, add, update all.',
    'All destinations, all transfers, all attractions: see, edit, add, update all.',
  ],
  'Accountant': [
    'Approve payments, record & expenses.',
    'Approve costing.',
    'Invoices, payments, transactions (read & edit).',
  ],
  'Task Manager': [
    'See and manage all tasks (reassign, edit).',
    'Cannot delete tasks; only assignees can mark task as done.',
  ],
  'Developer': [
    'View, edit, add Tasks only. Only Tasks visible in sidebar.',
  ],
  'Design': [
    'View, edit, add Tasks only. Only Tasks visible in sidebar.',
  ],
  'Design Intern': [
    'View, edit, add Tasks only. Only Tasks visible in sidebar.',
  ],
  'Developer Intern': [
    'View, edit, add Tasks only. Only Tasks visible in sidebar.',
  ],
  'Sales Intern': [
    'Add and view leads only. Can create itinerary but cannot see or edit Trip Cost Summary.',
    'Sidebar: Dashboard, Customers, Leads, Itineraries.',
  ],
  'Editor': [
    'Add and edit: All Attractions, All Destinations, All Transfers, Visas.',
    'Only these items visible in sidebar.',
  ],
};

const ManageRoles: React.FC = () => {
  return (
    <div className="space-y-6 w-full min-w-0">
      <p className="text-sm text-slate-600">
        Each staff has one <strong>default role</strong> (Super Admin, Manager, or Staff) and optional <strong>tags</strong> (Lead Manager, Accountant, Task Manager, Sales, Operations). Tags are assigned in Employees.
      </p>

      {/* Default roles */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Default role</h3>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {ROLE_NAMES.map((roleName) => (
            <div key={roleName} className="border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
              <p className="font-medium text-slate-800 mb-2">{roleName}</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                {(DEFAULT_ROLE_CAPABILITIES[roleName] || []).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Desktop: table */}
        <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Default role</th>
                <th className="px-4 py-3 font-medium">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_NAMES.map((roleName) => (
                <tr key={roleName} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800 align-top w-40">{roleName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <ul className="list-disc list-inside space-y-1">
                      {(DEFAULT_ROLE_CAPABILITIES[roleName] || []).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tags */}
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Tags (Lead Manager, Accountant, Task Manager, etc.)</h3>
        <p className="text-xs text-slate-500 mb-2">Assigned in Employees → staff detail → Tags.</p>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-3">
          {Object.entries(TAG_CAPABILITIES).map(([tagName, lines]) => (
            <div key={tagName} className="border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
              <p className="font-medium text-slate-800 mb-2">{tagName}</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                {lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Desktop: table */}
        <div className="hidden md:block border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium">Tag</th>
                <th className="px-4 py-3 font-medium">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(TAG_CAPABILITIES).map(([tagName, lines]) => (
                <tr key={tagName} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800 align-top w-40">{tagName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <ul className="list-disc list-inside space-y-1">
                      {lines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageRoles;
