import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataProvider';
import { Task, TaskStatus, TaskPriority, LoggedInUser, Staff, Activity, isSuperAdmin, isTaskManager, Lead, Customer } from '../types';
import { useToast } from './ToastProvider';
import { useRouter } from '../contexts/RouterProvider';
import { supabase } from '../lib/supabase';
import { syncTaskEventToLeadAndCustomer } from '../lib/taskActivitySync';
import { IconX, IconPlus, IconSearch, IconChevronDown, IconCheckCircle, IconChatBubble } from '../constants';

interface TasksProps {
  currentUser: LoggedInUser;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};

const formatDate = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');
const formatDateTime = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const WysiwygEditor: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const editorRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);
  const applyCommand = (command: string, valueArg: string | null = null) => {
    document.execCommand(command, false, valueArg ?? undefined);
    editorRef.current?.focus();
  };
  const handleToolbarMouseDown = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="border border-slate-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
      <div className="flex items-center gap-2 p-2 border-b bg-slate-50 rounded-t-md" onMouseDown={handleToolbarMouseDown}>
        <button type="button" onClick={() => applyCommand('bold')} className="px-2 py-1 text-sm font-bold hover:bg-slate-200 rounded" title="Bold">B</button>
        <button type="button" onClick={() => applyCommand('italic')} className="px-2 py-1 text-sm italic hover:bg-slate-200 rounded" title="Italic">I</button>
        <button type="button" onClick={() => applyCommand('underline')} className="px-2 py-1 text-sm underline hover:bg-slate-200 rounded" title="Underline">U</button>
        <button type="button" onClick={() => applyCommand('insertUnorderedList')} className="px-2 py-1 text-sm hover:bg-slate-200 rounded" title="Bullet List">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </button>
        <button type="button" onClick={() => applyCommand('insertOrderedList')} className="px-2 py-1 text-sm hover:bg-slate-200 rounded" title="Numbered List">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
        </button>
        <label className="flex items-center gap-1 text-sm cursor-pointer hover:bg-slate-200 p-1 rounded">
          A <input type="color" onChange={(e) => applyCommand('foreColor', e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer" title="Text Color" />
        </label>
        <label className="flex items-center gap-1 text-sm cursor-pointer hover:bg-slate-200 p-1 rounded">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
          <input type="color" defaultValue="#FFFF00" onChange={(e) => applyCommand('hiliteColor', e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer" title="Highlight" />
        </label>
      </div>
      <div ref={editorRef} contentEditable onInput={(e) => onChange(e.currentTarget.innerHTML)} className="prose prose-sm max-w-none p-3 min-h-[120px] focus:outline-none text-slate-900" />
    </div>
  );
};

function generateBookingId(lead: Lead | { id: number; created_at?: string }): string {
  if (!lead?.id || !lead?.created_at) return 'N/A';
  const d = new Date(lead.created_at);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `MTS-${lead.id}${day}${month}${year}`;
}

const AssignedToAvatars: React.FC<{ assignees: Staff[] }> = ({ assignees }) => {
  if (!assignees?.length) {
    return <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600" title="Unassigned">U</div>;
  }
  return (
    <div className="flex -space-x-3">
      {assignees.slice(0, 3).map((staff, index) => (
        <img
          key={staff.id}
          className="h-8 w-8 rounded-full border-2 border-white"
          src={staff.avatar_url}
          alt={staff.name}
          title={staff.name}
          style={{ zIndex: assignees.length - index }}
        />
      ))}
      {assignees.length > 3 && (
        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white" style={{ zIndex: 0 }}>
          +{assignees.length - 3}
        </div>
      )}
    </div>
  );
};

export const Tasks: React.FC<TasksProps> = ({ currentUser }) => {
  const { tasks, staff, leads, customers, branches, fetchTasks } = useData();
  const { addToast } = useToast();
  const { navigate } = useRouter();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | 'ALL'>('ALL');
  const [deleteConfirm, setDeleteConfirm] = useState<Task | null>(null);
  const [initialLeadIdsForNewTask, setInitialLeadIdsForNewTask] = useState<number[]>([]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== 'ALL' && t.status !== filterStatus) return false;
      if (filterPriority !== 'ALL' && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority]);

  const leadMap = useMemo(() => {
    const m = new Map<number, Lead>();
    leads.forEach(l => m.set(l.id, l));
    return m;
  }, [leads]);
  const customerMap = useMemo(() => {
    const m = new Map<number, Customer>();
    customers.forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const canDelete = isSuperAdmin(currentUser);
  const canMarkDone = useCallback((task: Task) => {
    const assignees = task.task_assignees || [];
    return assignees.some((a: any) => a.staff_id === currentUser.id) && task.status === 'PENDING';
  }, [currentUser.id]);

  const openPanelForTask = (task: Task | null) => {
    setSelectedTask(task);
    setIsAddMode(!task);
    setIsEditing(!!task ? false : true);
    setIsPanelOpen(true);
  };

  const closePanel = () => {
    setIsPanelClosing(true);
    setIsPanelOpen(false);
    setInitialLeadIdsForNewTask([]);
    setTimeout(() => {
      setSelectedTask(null);
      setIsAddMode(false);
      setIsEditing(false);
      setIsPanelClosing(false);
    }, 300);
  };

  const handleMarkDone = async (task: Task) => {
    if (!canMarkDone(task)) return;
    const { error } = await supabase.from('tasks').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', task.id);
    if (error) { addToast('Failed to mark task as done: ' + error.message, 'error'); return; }
    const leadIds = (task.task_leads || []).map((l: { lead_id: number }) => l.lead_id).filter(Boolean);
    if (leadIds.length) await syncTaskEventToLeadAndCustomer(leadIds, task.title, 'completed', currentUser.name);
    addToast('Task marked as done.', 'success');
    fetchTasks(true);
    setSelectedTask(prev => (prev?.id === task.id ? { ...prev, status: 'COMPLETED', completed_at: new Date().toISOString() } : prev));
  };

  const handleUndoDone = async (task: Task) => {
    const assignees = (task.task_assignees || []).map((a: { staff_id: number }) => a.staff_id);
    if (!assignees.includes(currentUser.id) || task.status !== 'COMPLETED') return;
    const { error } = await supabase.from('tasks').update({ status: 'PENDING', completed_at: null }).eq('id', task.id);
    if (error) { addToast('Failed to reopen task: ' + error.message, 'error'); return; }
    addToast('Task reopened.', 'success');
    fetchTasks(true);
    setSelectedTask(prev => (prev?.id === task.id ? { ...prev, status: 'PENDING', completed_at: null } : prev));
  };

  const handleDelete = async (task: Task) => {
    if (!canDelete) return;
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    if (error) { addToast('Failed to delete task: ' + error.message, 'error'); return; }
    addToast('Task deleted.', 'success');
    setDeleteConfirm(null);
    if (selectedTask?.id === task.id) closePanel();
    fetchTasks(true);
  };

  const handleSaveTask = async (payload: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    end_date: string;
    assigneeIds: number[];
    leadIds: number[];
    customer_id?: number | null;
  }) => {
    const effectiveAssigneeIds = (payload.assigneeIds?.length ? payload.assigneeIds : [currentUser.id]).filter(Boolean);
    if (selectedTask && !isAddMode) {
      const { error: taskError } = await supabase.from('tasks').update({
        title: payload.title,
        description: payload.description || null,
        status: payload.status,
        priority: payload.priority,
        end_date: payload.end_date,
        customer_id: payload.customer_id || null,
        completed_at: payload.status === 'COMPLETED' ? (selectedTask.completed_at || new Date().toISOString()) : null,
      }).eq('id', selectedTask.id);
      if (taskError) { addToast('Failed to update task: ' + taskError.message, 'error'); return; }
      await supabase.from('task_assignees').delete().eq('task_id', selectedTask.id);
      if (effectiveAssigneeIds.length) await supabase.from('task_assignees').insert(effectiveAssigneeIds.map(staff_id => ({ task_id: selectedTask.id, staff_id })));
      await supabase.from('task_leads').delete().eq('task_id', selectedTask.id);
      if (payload.leadIds.length) await supabase.from('task_leads').insert(payload.leadIds.map(lead_id => ({ task_id: selectedTask.id, lead_id })));
      addToast('Task updated.', 'success');
    } else {
      const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
        title: payload.title,
        description: payload.description || null,
        status: payload.status,
        priority: payload.priority,
        end_date: payload.end_date,
        created_by_staff_id: currentUser.id,
        customer_id: payload.customer_id || null,
      }).select('id').single();
      if (taskError || !newTask) { addToast('Failed to create task: ' + (taskError?.message || 'Unknown error'), 'error'); return; }
      if (effectiveAssigneeIds.length) await supabase.from('task_assignees').insert(effectiveAssigneeIds.map(staff_id => ({ task_id: newTask.id, staff_id })));
      if (payload.leadIds.length) {
        await supabase.from('task_leads').insert(payload.leadIds.map(lead_id => ({ task_id: newTask.id, lead_id })));
        await syncTaskEventToLeadAndCustomer(payload.leadIds, payload.title, 'created', currentUser.name);
      }
      addToast('Task created.', 'success');
    }
    setIsEditing(false);
    if (isAddMode) closePanel();
    else fetchTasks(true);
  };

  const createdByStaff = useMemo(() => {
    const map = new Map<number, Staff>();
    staff.forEach(s => map.set(s.id, s));
    return map;
  }, [staff]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Tasks</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as TaskStatus | 'ALL')} className="text-sm p-2 border border-slate-300 rounded-md bg-white text-slate-900">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as TaskPriority | 'ALL')} className="text-sm p-2 border border-slate-300 rounded-md bg-white text-slate-900">
            <option value="ALL">All priorities</option>
            {(Object.keys(PRIORITY_COLORS) as TaskPriority[]).map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="button" onClick={() => openPanelForTask(null)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] shrink-0">
            <IconPlus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      <div className="flex-1 border border-slate-200 rounded-lg bg-white overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-sm text-left text-slate-500 table-fixed">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">Created</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">Task</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">End date</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center">Priority</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center">Status</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center">Assigned Staff</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No tasks match the filters.</td></tr>
              )}
              {filteredTasks.map(task => {
                const assignees = (task.task_assignees || []).map((a: any) => a.staff).filter(Boolean) as Staff[];
                const firstLeadId = (task.task_leads || [])[0]?.lead_id;
                const firstLead = firstLeadId ? leadMap.get(firstLeadId) : null;
                const customer = task.customer_id ? customerMap.get(task.customer_id) : null;
                const subtitle = firstLead ? generateBookingId(firstLead) : customer ? `${customer.first_name} ${customer.last_name}` : null;
                return (
                  <tr key={task.id} onClick={() => openPanelForTask(task)} className="bg-white border-b hover:bg-slate-50 cursor-pointer">
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">{task.created_at ? new Date(task.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 min-w-0 max-w-[140px] sm:max-w-none" title={subtitle ? `${task.title} · ${subtitle}` : task.title}>
                      <span className="font-medium text-slate-800 truncate block">{task.title || '—'}</span>
                      {subtitle && <span className="text-xs text-slate-500 truncate block">{subtitle}</span>}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">{formatDate(task.end_date)}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><span className={`px-2 py-0.5 text-xs rounded ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span></td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><span className={`px-2 py-0.5 text-xs rounded ${task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{task.status}</span></td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><AssignedToAvatars assignees={assignees} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isPanelOpen && (
        <TaskDetailPanel
          task={selectedTask}
          isAddMode={isAddMode}
          initialLeadIds={isAddMode ? initialLeadIdsForNewTask : undefined}
          isEditing={isEditing}
          isPanelClosing={isPanelClosing}
          currentUser={currentUser}
          staff={staff}
          branches={branches}
          leads={leads}
          customers={customers}
          createdByStaff={createdByStaff}
          canDelete={canDelete}
          canMarkDone={selectedTask ? canMarkDone(selectedTask) : false}
          onClose={closePanel}
          onEdit={() => setIsEditing(true)}
          onMarkDone={selectedTask ? () => handleMarkDone(selectedTask) : undefined}
          onUndoDone={selectedTask ? () => handleUndoDone(selectedTask) : undefined}
          onDelete={selectedTask ? () => setDeleteConfirm(selectedTask) : undefined}
          onSave={handleSaveTask}
          onCancelEdit={() => setIsEditing(false)}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">Delete task?</h3>
            <p className="text-slate-600 mt-2">"{deleteConfirm.title}" will be permanently deleted.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-[5px] hover:bg-slate-50 text-slate-700">Cancel</button>
              <button type="button" onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-[5px] hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TaskActivityTab: React.FC<{
  task: Task;
  createdByStaff: Map<number, Staff>;
  formatDateTime: (s: string | null) => string;
}> = ({ task, createdByStaff, formatDateTime }) => {
  const createdByName = task.created_by_staff_id ? (createdByStaff.get(task.created_by_staff_id)?.name ?? 'Unknown') : 'Unknown';
  const derived: Activity[] = [
    ...(task.completed_at
      ? [{ id: -2, type: 'Task completed', description: `Task was marked as done.`, user: createdByName, timestamp: task.completed_at } as Activity]
      : []),
    { id: -1, type: 'Task created', description: `Task "${task.title}" was created.`, user: createdByName, timestamp: task.created_at },
    ...((task.activity as Activity[] | undefined) || []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const formatDate = (timestamp: string) => new Date(timestamp).toLocaleDateString(undefined, { dateStyle: 'medium' });
  const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString(undefined, { timeStyle: 'short' });

  return (
    <div className="relative pb-4 pt-4">
      <div className="absolute left-3 sm:left-4 top-6 h-[calc(100%-1.5rem)] w-px bg-slate-200" aria-hidden="true" />
      {derived.length === 0 ? (
        <p className="text-sm text-slate-500 pl-8">No activity yet.</p>
      ) : (
        derived.map((activity) => (
          <div key={activity.id} className="relative pl-8 sm:pl-12 pb-6">
            <div className="absolute left-3 sm:left-4 top-1 -translate-x-1/2 rounded-full bg-white p-1 border border-slate-300 shrink-0">
              <IconChatBubble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
              <div className="shrink-0 w-full sm:w-28 text-xs text-slate-500">
                <p>{formatDate(activity.timestamp)} {formatTime(activity.timestamp)}</p>
              </div>
              <div className="sm:ml-4 grow min-w-0 rounded-lg border bg-white shadow-sm p-2.5 sm:p-3">
                <p className="font-semibold text-sm text-slate-800">{activity.type}</p>
                <p className="text-sm text-slate-600 break-words">{activity.description}</p>
                <p className="text-xs text-slate-500 mt-1">by {activity.user}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export interface TaskDetailPanelProps {
  task: Task | null;
  isAddMode: boolean;
  initialLeadIds?: number[];
  isEditing: boolean;
  isPanelClosing: boolean;
  currentUser: LoggedInUser;
  staff: Staff[];
  branches: { id: number; name: string }[];
  leads: Lead[];
  customers: Customer[];
  createdByStaff: Map<number, Staff>;
  canDelete: boolean;
  canMarkDone: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMarkDone?: () => void;
  onUndoDone?: () => void;
  onDelete?: () => void;
  onSave: (payload: { title: string; description: string; status: TaskStatus; priority: TaskPriority; end_date: string; assigneeIds: number[]; leadIds: number[]; customer_id?: number | null }) => void;
  onCancelEdit: () => void;
  /** When rendered over another drawer (e.g. lead), use a higher z-index (e.g. 50). */
  overlayZIndex?: number;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  isAddMode,
  initialLeadIds,
  isEditing,
  isPanelClosing,
  currentUser,
  staff,
  branches,
  leads,
  customers,
  createdByStaff,
  canDelete,
  canMarkDone,
  onClose,
  onEdit,
  onMarkDone,
  onUndoDone,
  onDelete,
  onSave,
  onCancelEdit,
  overlayZIndex = 40,
}) => {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'PENDING');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [endDate, setEndDate] = useState(task?.end_date?.slice(0, 10) ?? '');
  const [assigneeIds, setAssigneeIds] = useState<number[]>(() => (task?.task_assignees ?? []).map((a: any) => a.staff_id).filter(Boolean));
  const [leadIds, setLeadIds] = useState<number[]>(() => task ? (task.task_leads ?? []).map((l: any) => l.lead_id).filter(Boolean) : (initialLeadIds ?? []));
  const [customerId, setCustomerId] = useState<number | null>(task?.customer_id ?? null);

  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [activeTaskTab, setActiveTaskTab] = useState<'details' | 'activity'>('details');
  const staffDropdownRef = useRef<HTMLDivElement>(null);
  const leadDropdownRef = useRef<HTMLDivElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setStatus(task.status);
      setPriority(task.priority);
      setEndDate(task.end_date?.slice(0, 10) ?? '');
      setAssigneeIds((task.task_assignees ?? []).map((a: any) => a.staff_id).filter(Boolean));
      setLeadIds((task.task_leads ?? []).map((l: any) => l.lead_id).filter(Boolean));
      setCustomerId(task.customer_id ?? null);
      setActiveTaskTab('details');
    } else {
      setTitle('');
      setDescription('');
      setStatus('PENDING');
      setPriority('MEDIUM');
      setEndDate('');
      setAssigneeIds(currentUser?.id != null ? [currentUser.id] : []);
      setLeadIds(initialLeadIds ?? []);
      setCustomerId(null);
    }
  }, [task, initialLeadIds, currentUser?.id]);

  // When customer changes, keep only leads that belong to the selected customer
  useEffect(() => {
    if (customerId == null) return;
    setLeadIds(prev => prev.filter(id => leads.some(l => l.id === id && l.customer_id === customerId)));
  }, [customerId]);

  const assigneeStaff = useMemo(() => staff.filter(s => assigneeIds.includes(s.id)), [staff, assigneeIds]);
  const filteredStaff = useMemo(() => {
    const q = staffSearchQuery.toLowerCase();
    if (!q) return staff.slice(0, 20);
    return staff.filter(s => (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)).slice(0, 20);
  }, [staff, staffSearchQuery]);

  // When a customer is selected, show only that customer's leads
  const leadsForDropdown = useMemo(() => {
    if (customerId == null) return leads;
    return leads.filter(l => l.customer_id === customerId);
  }, [leads, customerId]);

  const filteredLeads = useMemo(() => {
    const q = leadSearchQuery.toLowerCase();
    const base = leadsForDropdown;
    if (!q) return base.slice(0, 50);
    return base.filter(l => {
      const mts = generateBookingId(l);
      const cust = customers.find(c => c.id === l.customer_id);
      const custName = cust ? `${(cust.first_name || '')} ${(cust.last_name || '')}`.trim() : '';
      return mts.toLowerCase().includes(q) || (l.destination || '').toLowerCase().includes(q) || custName.toLowerCase().includes(q);
    }).slice(0, 50);
  }, [leadsForDropdown, leadSearchQuery, customers]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearchQuery.toLowerCase();
    if (!q) return customers.slice(0, 30);
    return customers.filter(c => {
      const name = `${(c.first_name || '')} ${(c.last_name || '')}`.trim();
      const phone = (c.phone || '').trim();
      return name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || phone.includes(q);
    }).slice(0, 30);
  }, [customers, customerSearchQuery]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(e.target as Node)) setIsStaffDropdownOpen(false);
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target as Node)) setIsLeadDropdownOpen(false);
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) setIsCustomerDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showForm = isAddMode || isEditing;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !endDate) return;
    const effectiveAssigneeIds = assigneeIds.length > 0 ? assigneeIds : (currentUser?.id != null ? [currentUser.id] : []);
    onSave({ title: title.trim(), description: description.trim() || '', status, priority, end_date: endDate, assigneeIds: effectiveAssigneeIds, leadIds, customer_id: customerId });
  };

  const toggleAssignee = (s: Staff) => {
    setAssigneeIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]);
  };
  const toggleLead = (l: Lead) => {
    setLeadIds(prev => prev.includes(l.id) ? prev.filter(id => id !== l.id) : [...prev, l.id]);
    setCustomerId(l.customer_id);
  };

  const selectedCustomerName = customerId ? (() => {
    const c = customers.find(x => x.id === customerId);
    if (!c) return '';
    const name = `${(c.first_name || '')} ${(c.last_name || '')}`.trim();
    const phone = (c.phone || '').trim();
    return phone ? `${name} - ${phone}` : name;
  })() : '';

  return (
    <div className="fixed inset-0" style={{ zIndex: overlayZIndex, pointerEvents: 'auto' }}>
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${isPanelClosing ? 'opacity-0' : 'opacity-40'}`} onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 w-full max-w-[100vw] sm:max-w-3xl bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${!isPanelClosing ? 'translate-x-0' : 'translate-x-full'}`} style={{ pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-slate-200 min-h-[52px] sm:h-16 shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{isAddMode ? 'New task' : task?.title ?? 'Task'}</h2>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!showForm && task && canMarkDone && (
              <button type="button" onClick={onMarkDone} className="px-2.5 sm:px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-[5px] hover:bg-green-700 min-h-[40px] sm:min-h-0 flex items-center gap-1.5">
                <IconCheckCircle className="w-4 h-4 shrink-0" /> Mark as done
              </button>
            )}
            {!showForm && task && task.status === 'COMPLETED' && (task.task_assignees || []).some((a: { staff_id: number }) => a.staff_id === currentUser?.id) && onUndoDone && (
              <button type="button" onClick={onUndoDone} className="px-2.5 sm:px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-200 border border-slate-300 rounded-[5px] hover:bg-slate-300 min-h-[40px] sm:min-h-0">
                Undo
              </button>
            )}
            {!showForm && task && (isSuperAdmin(currentUser) || isTaskManager(currentUser) || task.created_by_staff_id === currentUser.id) && <button type="button" onClick={onEdit} className="px-2.5 sm:px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200 min-h-[40px] sm:min-h-0">Edit</button>}
            {canDelete && task && <button type="button" onClick={onDelete} className="px-2.5 sm:px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-[5px] hover:bg-red-50 min-h-[40px] sm:min-h-0">Delete</button>}
            <button onClick={onClose} className="p-2 sm:p-1 rounded-full hover:bg-slate-100 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center" aria-label="Close"><IconX className="w-5 h-5 text-slate-600" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-slate-50 min-h-0">
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3 sm:mb-4 border-b border-slate-200 pb-2 text-sm sm:text-base">Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full text-sm p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                    <WysiwygEditor value={description} onChange={setDescription} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
                    <div className="flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5">
                      {(['PENDING', 'COMPLETED'] as TaskStatus[]).map(s => (
                        <button key={s} type="button" onClick={() => setStatus(s)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${status === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                          {s === 'PENDING' ? 'Pending' : 'Completed'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Priority</label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(PRIORITY_COLORS) as TaskPriority[]).map(p => (
                        <button key={p} type="button" onClick={() => setPriority(p)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${priority === p ? PRIORITY_COLORS[p] : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">End date *</label>
                    <div className="relative">
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm p-2.5 pl-3 border border-slate-200 rounded-xl bg-white text-slate-900 shadow-sm focus:ring-2 focus:ring-[#191974]/20 focus:border-[#191974] focus:outline-none [color-scheme:light]" required />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3 sm:mb-4 border-b border-slate-200 pb-2 text-sm sm:text-base">Assigned Staff <span className="text-slate-500 font-normal text-xs">(required; defaults to you if none selected)</span></h3>
                <div ref={staffDropdownRef} className="relative">
                  <button type="button" onClick={() => setIsStaffDropdownOpen(prev => !prev)} className="w-full text-left p-2 border rounded-md bg-slate-50 min-h-[40px]">
                    <AssignedToAvatars assignees={assigneeStaff} />
                  </button>
                  {isStaffDropdownOpen && (
                    <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20">
                      <div className="p-2 border-b">
                        <div className="relative">
                          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input type="text" placeholder="Search staff..." value={staffSearchQuery} onChange={e => setStaffSearchQuery(e.target.value)} onClick={e => e.stopPropagation()} className="w-full pl-8 pr-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus />
                        </div>
                      </div>
                      <ul className="max-h-48 overflow-y-auto">
                        {filteredStaff.length > 0 ? filteredStaff.map(s => (
                          <li key={s.id} onClick={() => { toggleAssignee(s); setStaffSearchQuery(''); }} className="p-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src={s.avatar_url} className="w-6 h-6 rounded-full" alt="" />
                              <div className="flex flex-col">
                                <span className="text-sm text-slate-900">{s.name}</span>
                                <span className="text-xs text-slate-500">{branches.find(b => b.id === s.branch_id)?.name || 'Unknown Branch'}</span>
                              </div>
                            </div>
                            {assigneeIds.includes(s.id) && <IconCheckCircle className="w-5 h-5 text-blue-600" />}
                          </li>
                        )) : <li className="p-2 text-sm text-slate-500 text-center">No staff found.</li>}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3 sm:mb-4 border-b border-slate-200 pb-2 text-sm sm:text-base">Link to customer & leads</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Select Customer</label>
                    <div ref={customerDropdownRef} className="relative">
                      <input
                        type="text"
                        value={isCustomerDropdownOpen ? customerSearchQuery : selectedCustomerName}
                        onChange={e => setCustomerSearchQuery(e.target.value)}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        placeholder="Customer name with mobile number"
                        className="w-full text-sm p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900 pr-8"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"><IconChevronDown className="w-5 h-5 text-slate-400" /></div>
                      {isCustomerDropdownOpen && (
                        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                          <ul>
                            {filteredCustomers.map(c => {
                              const name = `${(c.first_name || '')} ${(c.last_name || '')}`.trim();
                              const phone = (c.phone || '').trim();
                              return (
                                <li key={c.id} onClick={() => { setCustomerId(c.id); setIsCustomerDropdownOpen(false); setCustomerSearchQuery(''); }} className="p-2 hover:bg-slate-100 cursor-pointer text-sm">
                                  {phone ? `${name} - ${phone}` : name}
                                </li>
                              );
                            })}
                            {filteredCustomers.length === 0 && <li className="p-2 text-sm text-slate-500">No customers found.</li>}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Select Lead(s)</label>
                    <div ref={leadDropdownRef} className="relative">
                      <input
                        type="text"
                        value={isLeadDropdownOpen ? leadSearchQuery : (leadIds.length ? `${leadIds.length} lead(s) selected` : customerId ? 'Search or select leads' : 'Select a customer first')}
                        onChange={e => setLeadSearchQuery(e.target.value)}
                        onFocus={() => setIsLeadDropdownOpen(true)}
                        placeholder={customerId ? 'Search or select leads' : 'Select a customer first'}
                        className="w-full text-sm p-2 border border-slate-300 rounded-md bg-slate-50 text-slate-900 pr-8"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"><IconChevronDown className="w-5 h-5 text-slate-400" /></div>
                      {isLeadDropdownOpen && (
                        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                          <ul>
                            {filteredLeads.map(l => {
                              const cust = customers.find(c => c.id === l.customer_id);
                              const custName = cust ? `${(cust.first_name || '')} ${(cust.last_name || '')}`.trim() : '';
                              const label = [l.destination || '', custName].filter(Boolean).join(' - ') || generateBookingId(l);
                              return (
                                <li key={l.id} onClick={() => { toggleLead(l); setLeadSearchQuery(''); }} className="p-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between text-sm">
                                  <span>{label}</span>
                                  {leadIds.includes(l.id) && <IconCheckCircle className="w-5 h-5 text-blue-600 shrink-0" />}
                                </li>
                              );
                            })}
                            {filteredLeads.length === 0 && (
                              <li className="p-2 text-sm text-slate-500">
                                {customerId ? 'No leads found for this customer.' : 'Select a customer first to see their leads.'}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {isEditing && !isAddMode && <button type="button" onClick={onCancelEdit} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200">Cancel</button>}
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">{isAddMode ? 'Create task' : 'Save'}</button>
              </div>
            </form>
          ) : task ? (
            <>
              <div className="border-b border-slate-200 shrink-0 bg-white -mx-3 sm:-mx-6 px-3 sm:px-6 pt-2 pb-0">
                <nav className="-mb-px flex gap-4 overflow-x-auto" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTaskTab('details')}
                    className={`whitespace-nowrap py-2.5 px-1 border-b-2 font-medium text-xs sm:text-sm ${activeTaskTab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTaskTab('activity')}
                    className={`whitespace-nowrap py-2.5 px-1 border-b-2 font-medium text-xs sm:text-sm ${activeTaskTab === 'activity' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                  >
                    Activity
                  </button>
                </nav>
              </div>
              {activeTaskTab === 'details' && (
                <div className="space-y-4 sm:space-y-6 pt-4">
                  <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                    {task.description && (
                      <>
                        <h3 className="text-xs font-medium text-slate-500 mb-1">Description</h3>
                        <div className="text-sm text-slate-800 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: task.description }} />
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200">
                      <div><span className="block text-xs font-medium text-slate-500 mb-1">End date</span><p className="text-sm font-medium text-slate-800">{formatDate(task.end_date)}</p></div>
                      {task.completed_at && <div><span className="block text-xs font-medium text-slate-500 mb-1">Completed</span><p className="text-sm font-medium text-slate-800">{formatDateTime(task.completed_at)}</p></div>}
                      <div><span className="block text-xs font-medium text-slate-500 mb-1">Created by</span><p className="text-sm font-medium text-slate-800">{task.created_by_staff_id ? (createdByStaff.get(task.created_by_staff_id)?.name ?? '—') : '—'}</p></div>
                      <div><span className="block text-xs font-medium text-slate-500 mb-1">Priority</span><p><span className={`inline-block px-2 py-0.5 text-xs rounded ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span></p></div>
                    </div>
                  </div>
                  {(task.task_assignees?.length ?? 0) > 0 && (
                    <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                      <h3 className="font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-2 text-sm">Assignees</h3>
                      <div className="flex flex-wrap gap-2">
                        {(task.task_assignees || []).map((a: any) => a.staff).filter(Boolean).map((s: Staff) => (
                          <span key={s.id} className="inline-flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-md text-sm text-slate-700">
                            {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-6 h-6 rounded-full" /> : <span className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-xs">{s.name?.charAt(0)}</span>}
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {((task.task_leads?.length ?? 0) > 0 || task.customer_id) && (
                    <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                      <h3 className="font-semibold text-slate-700 mb-2 border-b border-slate-200 pb-2 text-sm">Linked leads & customer</h3>
                      {(task.task_leads || []).length > 0 && <p className="text-sm text-slate-700">Leads: {(task.task_leads || []).map((l: any) => l.lead_id).join(', ')}</p>}
                      {task.customer_id && <p className="text-sm text-slate-700 mt-1">Customer: {customers.find(c => c.id === task.customer_id)?.first_name} {customers.find(c => c.id === task.customer_id)?.last_name}</p>}
                    </div>
                  )}
                </div>
              )}
              {activeTaskTab === 'activity' && (
                <TaskActivityTab task={task} createdByStaff={createdByStaff} formatDateTime={formatDateTime} />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export { TaskDetailPanel };
