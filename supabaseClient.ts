import { createClient } from '@supabase/supabase-js';

// Credenciais do projeto Supabase
const supabaseUrl = 'https://uwgdzagmztzccvazcupf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Z2R6YWdtenR6Y2N2YXpjdXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDkxMDQsImV4cCI6MjA4MzkyNTEwNH0.1olM4lIUFQNBI5bDgd4YvLLQ3A-uDdBexNQeXHUiV54';

export const supabase = createClient(supabaseUrl, supabaseKey);