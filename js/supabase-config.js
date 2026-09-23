// ============================================================
// GANTI 2 value bawah ni dengan Project URL & anon key kau
// (Supabase Dashboard > Settings > API)
// ============================================================
const SUPABASE_URL = "https://dvidgiuocyixenaeisvq.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2aWRnaXVvY3lpeGVuYWVpc3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMDYwMjgsImV4cCI6MjEwNTY4MjAyOH0.Y5wa3WtiIu8zx2G0pQF7GyyWAL4v4PxGF6gkwPM8pQ4";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
