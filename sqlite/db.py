import sqlite3

DB_PATH = 'boardgames.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 크롤링한 보드게임 기본 정보 테이블
    c.execute('''
        CREATE TABLE IF NOT EXISTS boardgames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bgg_id INTEGER UNIQUE,
            name TEXT NOT NULL,
            korean_name TEXT,
            main_image_url TEXT,
            players_min INTEGER,
            players_max INTEGER,
            players_best TEXT,
            players_recommended TEXT,
            play_time_min INTEGER,
            play_time_max INTEGER,
            age INTEGER,
            weight REAL,
            rating REAL,
            type TEXT,
            category TEXT,
            mechanism TEXT,
            url TEXT
        )
    ''')
    
    # 사용자 데이터 테이블 (즐겨찾기, 평점, 리뷰)
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bgg_id INTEGER,
            is_favorite INTEGER DEFAULT 0,
            my_rating INTEGER,
            my_review TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(bgg_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_db_connection():
    return sqlite3.connect(DB_PATH)

def save_boardgame_to_db(game):
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute('''
            INSERT OR REPLACE INTO boardgames (
                bgg_id, name, korean_name, main_image_url, players_min, players_max, players_best, players_recommended, play_time_min, play_time_max, age, weight, rating, type, category, mechanism, url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            game.get('bgg_id'),
            game['name'],
            game.get('korean_name'),
            game['main_image_url'],
            game['players_min'],
            game['players_max'],
            game['players_best'],
            game.get('players_recommended'),
            game['play_time_min'],
            game['play_time_max'],
            game['age'],
            game['weight'],
            game['rating'],
            game.get('type'),
            game.get('category'),
            game.get('mechanism'),
            game.get('url')
        ))
        conn.commit()
        conn.close()
        print(f"[DB 저장 성공] {game['name']} (한글: {game.get('korean_name', 'N/A')})")
    except Exception as e:
        print(f"[DB 저장 실패] {game.get('name', 'Unknown')} / {e}")

def update_boardgame_partial(game):
    """기존 데이터를 유지하면서 누락된 필드만 업데이트하는 함수"""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 기존 데이터 조회
        c.execute('''
            SELECT bgg_id, name, korean_name, main_image_url, players_min, players_max, 
                   players_best, players_recommended, play_time_min, play_time_max, 
                   age, weight, rating, type, category, mechanism, url
            FROM boardgames WHERE bgg_id = ?
        ''', [game.get('bgg_id')])
        existing = c.fetchone()
        
        if existing:
            # 기존 데이터와 병합 (누락된 필드만 업데이트)
            (bgg_id, name, korean_name, main_image_url, players_min, players_max,
             players_best, players_recommended, play_time_min, play_time_max,
             age, weight, rating, type, category, mechanism, url) = existing
            
            # 누락된 필드만 업데이트
            updated_game = {
                "bgg_id": bgg_id,
                "name": game.get('name', name),
                "korean_name": game.get('korean_name') or korean_name,
                "main_image_url": game.get('main_image_url') or main_image_url,
                "players_min": game.get('players_min', players_min),
                "players_max": game.get('players_max', players_max),
                "players_best": game.get('players_best', players_best),
                "players_recommended": game.get('players_recommended') or players_recommended,
                "play_time_min": game.get('play_time_min', play_time_min),
                "play_time_max": game.get('play_time_max', play_time_max),
                "age": game.get('age', age),
                "weight": game.get('weight', weight),
                "rating": game.get('rating', rating),
                "type": game.get('type', type),
                "category": game.get('category', category),
                "mechanism": game.get('mechanism', mechanism),
                "url": game.get('url', url)
            }
            
            # UPDATE 쿼리로 부분 업데이트
            c.execute('''
                UPDATE boardgames SET 
                    name = ?, korean_name = ?, main_image_url = ?, 
                    players_min = ?, players_max = ?, players_best = ?, players_recommended = ?,
                    play_time_min = ?, play_time_max = ?, age = ?, weight = ?, rating = ?,
                    type = ?, category = ?, mechanism = ?, url = ?
                WHERE bgg_id = ?
            ''', (
                updated_game['name'], updated_game['korean_name'], updated_game['main_image_url'],
                updated_game['players_min'], updated_game['players_max'], updated_game['players_best'], updated_game['players_recommended'],
                updated_game['play_time_min'], updated_game['play_time_max'], updated_game['age'], updated_game['weight'], updated_game['rating'],
                updated_game['type'], updated_game['category'], updated_game['mechanism'], updated_game['url'],
                bgg_id
            ))
            
            print(f"[DB 부분 업데이트 성공] {updated_game['name']} (한글: {updated_game.get('korean_name', 'N/A')})")
        else:
            # 새로운 게임이면 전체 저장
            save_boardgame_to_db(game)
            
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[DB 부분 업데이트 실패] {game.get('name', 'Unknown')} / {e}")

def get_user_data(bgg_id):
    """사용자 데이터 조회"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT is_favorite, my_rating, my_review FROM user_data WHERE bgg_id = ?', (bgg_id,))
    result = c.fetchone()
    conn.close()
    
    if result:
        return {
            'is_favorite': bool(result[0]),
            'my_rating': result[1],
            'my_review': result[2]
        }
    return {
        'is_favorite': False,
        'my_rating': None,
        'my_review': None
    }

def update_user_data(bgg_id, is_favorite=None, my_rating=None, my_review=None):
    """사용자 데이터 업데이트"""
    conn = get_db_connection()
    c = conn.cursor()
    
    # 기존 데이터 조회
    c.execute('SELECT * FROM user_data WHERE bgg_id = ?', (bgg_id,))
    existing = c.fetchone()
    
    if existing:
        # 기존 데이터 업데이트
        current_data = {
            'is_favorite': existing[2] if is_favorite is None else is_favorite,
            'my_rating': existing[3] if my_rating is None else my_rating,
            'my_review': existing[4] if my_review is None else my_review
        }
        
        c.execute('''
            UPDATE user_data SET 
                is_favorite = ?, my_rating = ?, my_review = ?, updated_at = CURRENT_TIMESTAMP
            WHERE bgg_id = ?
        ''', (current_data['is_favorite'], current_data['my_rating'], current_data['my_review'], bgg_id))
    else:
        # 새 데이터 생성
        c.execute('''
            INSERT INTO user_data (bgg_id, is_favorite, my_rating, my_review)
            VALUES (?, ?, ?, ?)
        ''', (bgg_id, is_favorite or False, my_rating, my_review))
    
    conn.commit()
    conn.close() 