import { supabase } from './supabaseClient';
import { AppConfig, Collaborator } from '../types';

export const storageService = {
  getAppConfig: async (key: string): Promise<string | null> => {
    const { data, error } = await supabase
      .from('app_configs')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error) {
        return null;
    }
    return data?.value || null;
  },

  setAppConfig: async (config: AppConfig) => {
      const { error } = await supabase.from('app_configs').upsert(config);
      if (error) {
          console.error("Supabase Error [setAppConfig]:", error);
      }
      return { error };
  },

  getCollaborators: async (): Promise<Collaborator[]> => {
      const { data, error } = await supabase.from('collaborators').select('*');
      if (error) {
          console.error("Error fetching collaborators:", error);
          return [];
      }
      return data || [];
  },

  saveUser: (user: Collaborator | null, remember: boolean = true) => {
      if (user) {
          const str = JSON.stringify(user);
          if (remember) localStorage.setItem('hotel_user', str);
          else sessionStorage.setItem('hotel_user', str);
      } else {
          localStorage.removeItem('hotel_user');
          sessionStorage.removeItem('hotel_user');
      }
  },

  getUser: (): Collaborator | null => {
      const str = localStorage.getItem('hotel_user') || sessionStorage.getItem('hotel_user');
      return str ? JSON.parse(str) : null;
  }
};