import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Auth helper functions
export const authService = {
  // Get current user
  getCurrentUser: () => {
    return supabase.auth.getUser();
  },

  // Get current session
  getCurrentSession: () => {
    return supabase.auth.getSession();
  },

  // Sign out
  signOut: () => {
    return supabase.auth.signOut();
  },

  // Listen to auth changes
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};

export class DataService {
  // Save stakeholder information
  async saveStakeholder(stakeholderData) {
    const { data, error } = await supabase
      .from('stakeholders')
      .insert([stakeholderData])
      .select();
    
    if (error) throw error;
    return data[0];
  }

  // Save consultation session
  async saveConsultationSession(sessionData) {
    const { data, error } = await supabase
      .from('consultation_sessions')
      .insert([sessionData])
      .select();
    
    if (error) throw error;
    return data[0];
  }

  // Save conversation message
  async saveMessage(messageData) {
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert([messageData])
      .select();
    
    if (error) throw error;
    return data[0];
  }

  // Save priorities
  async savePriorities(priorities) {
    const { data, error } = await supabase
      .from('priorities')
      .insert(priorities)
      .select();
    
    if (error) throw error;
    return data;
  }

  // Get consultation data for export
  async getConsultationData(sessionId) {
    const { data: session } = await supabase
      .from('consultation_sessions')
      .select(`
        *,
        stakeholders(*),
        conversation_messages(*),
        priorities(*)
      `)
      .eq('id', sessionId)
      .single();
    
    return session;
  }

  // Get all consultations for admin
  async getAllConsultations() {
    const { data, error } = await supabase
      .from('consultation_sessions')
      .select(`
        *,
        stakeholders(name, role, department)
      `)
      .order('started_at', { ascending: false });
    
    return data;
  }
}