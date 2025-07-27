const { createClient } = require('@supabase/supabase-js');

// 환경변수 로드
require('dotenv').config();

// 환경변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.SUPABASE_URL || 'https://rqknwnwjvwnympkjtvds.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxa253bndqdndueW1wa2p0dmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODcwMzAsImV4cCI6MjA2OTE2MzAzMH0.a4_h0HbRCnzElezAgtXfqVhXG_dXMawisQk07CKPX_Y';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey ? '설정됨' : '설정되지 않음');

// Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase; 