const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 환경변수 로드
require('dotenv').config();

// 환경변수에서 Supabase 설정 가져오기
const supabaseUrl = process.env.SUPABASE_URL || 'https://rqknwnwjvwnympkjtvds.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxa253bndqdndueW1wa2p0dmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1ODcwMzAsImV4cCI6MjA2OTE2MzAzMH0.a4_h0HbRCnzElezAgtXfqVhXG_dXMawisQk07CKPX_Y';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey ? '설정됨' : '설정되지 않음');

// Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseKey);

// 데이터 마이그레이션 함수
async function migrateData() {
    console.log('데이터 마이그레이션 시작...');
    console.log('현재 디렉토리:', __dirname);
    
    // SQLite 데이터베이스 연결
    const dbPath = path.join(__dirname, 'boardgames.db');
    console.log('SQLite 파일 경로:', dbPath);
    
    const db = new sqlite3.Database(dbPath);
    
    try {
        // 1. boardgames 테이블 데이터 마이그레이션
        console.log('boardgames 테이블 마이그레이션 중...');
        
        db.all('SELECT * FROM boardgames', async (err, rows) => {
            if (err) {
                console.error('boardgames 데이터 조회 오류:', err);
                return;
            }
            
            console.log(`총 ${rows.length}개의 게임 데이터 발견`);
            if (rows.length > 0) {
                console.log('첫 번째 게임 예시:', rows[0]);
            }
            
            // Supabase에 데이터 삽입
            for (let i = 0; i < rows.length; i += 100) { // 100개씩 배치 처리
                const batch = rows.slice(i, i + 100);
                console.log(`배치 ${i/100 + 1} 처리 중... (${batch.length}개)`);
                
                const { data, error } = await supabase
                    .from('boardgames')
                    .upsert(batch, { onConflict: 'bgg_id' });
                
                if (error) {
                    console.error(`배치 ${i/100 + 1} 삽입 오류:`, error);
                } else {
                    console.log(`배치 ${i/100 + 1} 완료 (${batch.length}개)`);
                    console.log('삽입된 데이터 수:', data?.length || 0);
                }
            }
            
            // 2. reviews 테이블 데이터 마이그레이션
            console.log('reviews 테이블 마이그레이션 중...');
            
            db.all('SELECT * FROM reviews', async (err, reviewRows) => {
                if (err) {
                    console.error('reviews 데이터 조회 오류:', err);
                    return;
                }
                
                console.log(`총 ${reviewRows.length}개의 리뷰 데이터 발견`);
                
                // Supabase에 리뷰 데이터 삽입
                for (let i = 0; i < reviewRows.length; i += 100) {
                    const batch = reviewRows.slice(i, i + 100);
                    const { error } = await supabase
                        .from('reviews')
                        .upsert(batch, { onConflict: 'id' });
                    
                    if (error) {
                        console.error(`리뷰 배치 ${i/100 + 1} 삽입 오류:`, error);
                    } else {
                        console.log(`리뷰 배치 ${i/100 + 1} 완료 (${batch.length}개)`);
                    }
                }
                
                console.log('✅ 데이터 마이그레이션 완료!');
                db.close();
            });
        });
        
    } catch (error) {
        console.error('마이그레이션 오류:', error);
        db.close();
    }
}

// 마이그레이션 실행 (직접 실행 시에만)
if (require.main === module) {
    migrateData();
}

module.exports = { supabase, migrateData }; 