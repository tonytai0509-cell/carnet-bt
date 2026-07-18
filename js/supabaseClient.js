"use strict";
// Project Settings → API dans le dashboard Supabase (supabase.com).
const SUPABASE_URL = "https://gjbjjwarhmxzsvvawlfm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GLLtgSDSjdX-J-hyv2kDjg_PtsMvKWH";

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
