import { supabase } from './supabase';
import type { Candidate } from '@/types';

export const database = {
  async saveCandidate(candidate: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('candidates')
      .insert([{
        ...candidate,
        user_id: user.id,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getCandidates() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Candidate[];
  },

  async getCandidate(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data as Candidate;
  },

  async updateCandidate(id: string, updates: Partial<Candidate>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('candidates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data as Candidate;
  },

  async deleteCandidate(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },
};
