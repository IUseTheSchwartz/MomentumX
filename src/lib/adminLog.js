import { supabase } from './supabaseClient';

export async function writeAdminLog({
  action,
  targetType = null,
  targetId = null,
  details = {}
}) {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    const adminId = session?.user?.id || null;

    await supabase.from('admin_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details
    });
  } catch (error) {
    console.error('Failed to write admin log:', error);
  }
}
