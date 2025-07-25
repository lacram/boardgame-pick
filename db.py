import sqlite3

DB_PATH = 'boardgames.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS boardgames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bgg_id INTEGER UNIQUE,
            name TEXT NOT NULL,
            main_image_url TEXT,
            players_min INTEGER,
            players_max INTEGER,
            players_best INTEGER,
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
            INSERT OR IGNORE INTO boardgames (
                bgg_id, name, main_image_url, players_min, players_max, players_best, play_time_min, play_time_max, age, weight, rating, type, category, mechanism, url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            game.get('bgg_id'),
            game['name'],
            game['main_image_url'],
            game['players_min'],
            game['players_max'],
            game['players_best'],
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
        print(f"[DB 저장 성공] {game['name']}")
    except Exception as e:
        print(f"[DB 저장 실패] {game.get('name', 'Unknown')} / {e}") 