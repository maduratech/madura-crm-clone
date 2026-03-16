import { supabase } from './supabase';

/** Append an activity entry to a lead's activity array (used when task is linked or completed). */
export async function appendLeadActivity(
  leadId: number,
  type: string,
  description: string,
  user: string
): Promise<void> {
  const { data: lead, error: fetchError } = await supabase
    .from('leads')
    .select('activity')
    .eq('id', leadId)
    .single();
  if (fetchError || !lead) return;
  const newActivity = {
    id: Date.now(),
    type,
    description,
    user,
    timestamp: new Date().toISOString(),
  };
  const updated = [newActivity, ...(lead.activity || [])];
  await supabase
    .from('leads')
    .update({ activity: updated, last_updated: new Date().toISOString() })
    .eq('id', leadId);
}

/** Append an activity entry to a customer's activity array. */
export async function appendCustomerActivity(
  customerId: number,
  type: string,
  description: string,
  user: string
): Promise<void> {
  const { data: customer, error: fetchError } = await supabase
    .from('customers')
    .select('activity')
    .eq('id', customerId)
    .single();
  if (fetchError || !customer) return;
  const newActivity = {
    id: Date.now(),
    type,
    description,
    user,
    timestamp: new Date().toISOString(),
  };
  const updated = [newActivity, ...(customer.activity || [])];
  await supabase
    .from('customers')
    .update({ activity: updated })
    .eq('id', customerId);
}

/** Sync "New task added" or "Task completed" to all leads linked to the task (and their customers). */
export async function syncTaskEventToLeadAndCustomer(
  leadIds: number[],
  taskTitle: string,
  event: 'created' | 'completed',
  userName: string
): Promise<void> {
  if (leadIds.length === 0) return;
  const type = event === 'created' ? 'New task added' : 'Task completed';
  const description = event === 'created'
    ? `Task "${taskTitle}" was added and linked to this lead.`
    : `Task "${taskTitle}" was marked as done.`;
  for (const leadId of leadIds) {
    await appendLeadActivity(leadId, type, description, userName);
    const { data: lead } = await supabase.from('leads').select('customer_id').eq('id', leadId).single();
    if (lead?.customer_id) {
      await appendCustomerActivity(lead.customer_id, type, description, userName);
    }
  }
}
