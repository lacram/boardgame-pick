import sqlite3

DB_PATH = 'boardgames.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 기존 테이블에 korean_name 컬럼 추가
    try:
        c.execute('ALTER TABLE boardgames ADD COLUMN korean_name TEXT')
        print("korean_name 컬럼이 추가되었습니다.")
    except sqlite3.OperationalError:
        print("korean_name 컬럼이 이미 존재합니다.")
    
    # 기존 테이블에 players_recommended 컬럼 추가
    try:
        c.execute('ALTER TABLE boardgames ADD COLUMN players_recommended TEXT')
        print("players_recommended 컬럼이 추가되었습니다.")
    except sqlite3.OperationalError:
        print("players_recommended 컬럼이 이미 존재합니다.")
    
    # players_best 컬럼 타입을 TEXT로 변경 (기존 데이터가 있으면 백업 후 재생성)
    try:
        # 기존 데이터 백업
        c.execute('SELECT bgg_id, players_best FROM boardgames WHERE players_best IS NOT NULL')
        backup_data = c.fetchall()
        
        # 임시 테이블 생성
        c.execute('''
            CREATE TABLE boardgames_temp (
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
        
        # 데이터 복사
        c.execute('''
            INSERT INTO boardgames_temp 
            SELECT id, bgg_id, name, korean_name, main_image_url, players_min, players_max, 
                   CAST(players_best AS TEXT), players_recommended, play_time_min, play_time_max, 
                   age, weight, rating, type, category, mechanism, url
            FROM boardgames
        ''')
        
        # 기존 테이블 삭제
        c.execute('DROP TABLE boardgames')
        
        # 새 테이블 이름 변경
        c.execute('ALTER TABLE boardgames_temp RENAME TO boardgames')
        
        print("players_best 컬럼 타입이 TEXT로 변경되었습니다.")
    except Exception as e:
        print(f"players_best 컬럼 타입 변경 중 오류: {e}")
        # 오류 발생 시 임시 테이블 정리
        try:
            c.execute('DROP TABLE IF EXISTS boardgames_temp')
        except:
            pass
    
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
            rating REAL, -- geek rating
            type TEXT,
            category TEXT,
            mechanism TEXT,
            url TEXT
        )
    ''')
    # 리뷰 테이블 추가
    c.execute('''
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bgg_id INTEGER,
            rating INTEGER,
            text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            game['rating'],  # geek rating
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

def update_korean_names():
    """기존 데이터의 한글 제목을 업데이트하는 함수"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('SELECT bgg_id, name FROM boardgames WHERE korean_name IS NULL OR korean_name = ""')
    games_to_update = c.fetchall()
    conn.close()
    
    print(f"한글 제목 업데이트 대상: {len(games_to_update)}개 게임")
    return games_to_update 

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