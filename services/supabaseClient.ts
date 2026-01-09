import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sziehrfievxbfleetyem.supabase.co';
const supabaseKey = 'sb_publishable_6C7vK3YPboTgiszNE4n8Ew_tFL1pMNT';

export const supabase = createClient(supabaseUrl, supabaseKey);