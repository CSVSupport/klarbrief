// ═══════════════════════════════════════════════════
// Supabase Client & Database Operations
// ═══════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase ENV-Variablen fehlen! Setze VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY in Vercel.');
}

export const supabase = createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_ANON_KEY || 'placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

// ─── AUTH ─────────────────────────────────────────
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name?.trim() } }
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  return { data, error };
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── PROFILES ─────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return { data, error };
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
  return { data, error };
}

// ─── PROJECTS ─────────────────────────────────────
export async function getProjects(userId) {
  const { data, error } = await supabase.from('projects').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function createProject(userId, project) {
  try {
    const { data, error } = await supabase.from('projects').insert([{ ...project, user_id: userId }]).select().single();
    return { data, error };
  } catch (e) { console.warn("createProject failed:", e); return { data: null, error: e }; }
}

export async function updateProject(projectId, updates) {
  try {
    const { data, error } = await supabase.from('projects').update(updates).eq('id', projectId).select().single();
    return { data, error };
  } catch (e) { console.warn("updateProject failed:", e); return { data: null, error: e }; }
}

export async function deleteProject(projectId) {
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  return { error };
}

// ─── USAGE TRACKING ───────────────────────────────
export async function getUsageForMonth(userId, month) {
  const { data, error } = await supabase.from('usage_tracking').select('count').eq('user_id', userId).eq('month', month).maybeSingle();
  return { count: data?.count || 0, error };
}

export async function incrementUsage(userId, month) {
  try {
    const { data: existing } = await supabase.from('usage_tracking').select('count').eq('user_id', userId).eq('month', month).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('usage_tracking').update({ count: existing.count + 1 }).eq('user_id', userId).eq('month', month);
      return { error };
    } else {
      const { error } = await supabase.from('usage_tracking').insert([{ user_id: userId, month, count: 1 }]);
      return { error };
    }
  } catch (e) {
    console.warn("incrementUsage failed:", e);
    return { error: e };
  }
}

// ─── ADMIN QUERIES ────────────────────────────────
export async function adminGetAllUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function adminGetAllProjects() {
  const { data, error } = await supabase.from('projects').select('*');
  return { data: data || [], error };
}

export async function adminGetAllUsage() {
  const { data, error } = await supabase.from('usage_tracking').select('*');
  return { data: data || [], error };
}
