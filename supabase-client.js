const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

// Supabase 클라이언트 생성
const supabase = createClient(config.supabase.url, config.supabase.anonKey);

console.log('Supabase URL:', config.supabase.url);
console.log('Supabase Key:', config.supabase.anonKey ? '설정됨' : '설정되지 않음');

module.exports = supabase; 