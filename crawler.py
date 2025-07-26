import requests
from bs4 import BeautifulSoup
from db import get_db_connection, save_boardgame_to_db, update_korean_names, update_boardgame_partial
import re
import time

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

COOKIES = {
    'bggusername': 'lacram',
    'bggpassword': 'wbb3a19xsh64vjjl6ba7wjgm47sfutws',
    'SessionID': '28649ec8cb74741890058ebfd2a8230ac3576219u4313722',
}

BGG_API_URL = "https://boardgamegeek.com/xmlapi2/thing?id={game_id}&stats=1"

def fetch_bgg_api(game_id):
    url = BGG_API_URL.format(game_id=game_id)
    try:
        res = requests.get(url, headers=HEADERS, cookies=COOKIES)
        soup = BeautifulSoup(res.content, "html.parser")
        item = soup.find("item")
        if not item:
            return None
        name = item.find("name", type="primary")
        name = name["value"] if name else None
        
        image_elem = item.find("image")
        image = None
        if image_elem and image_elem.next_sibling:
            image = str(image_elem.next_sibling).strip()
        
        min_players = item.find("minplayers")
        min_players = int(min_players["value"]) if min_players else None
        max_players = item.find("maxplayers")
        max_players = int(max_players["value"]) if max_players else None
        min_time = item.find("minplaytime")
        min_time = int(min_time["value"]) if min_time else None
        max_time = item.find("maxplaytime")
        max_time = int(max_time["value"]) if max_time else None
        age = item.find("minage")
        age = int(age["value"]) if age else None
        stats = item.find("statistics")
        rating = None
        weight = None
        if stats:
            ratings = stats.find("ratings")
            if ratings:
                bayes_avg = ratings.find("bayesaverage")
                if bayes_avg and bayes_avg["value"] != 'N/A':
                    rating = float(bayes_avg["value"])
                avgweight = ratings.find("averageweight")
                if avgweight and avgweight["value"] != 'N/A':
                    weight = float(avgweight["value"])
        # best/recommended player 파싱 (poll-summary)
        players_best = None
        players_recommended = None
        poll_summary = item.find("poll-summary", {"name": "suggested_numplayers"})
        if poll_summary:
            bestwith = poll_summary.find("result", {"name": "bestwith"})
            if bestwith and bestwith.get("value"):
                players_best = bestwith["value"].replace("Best with ", "").replace(" players", "")
            recommendedwith = poll_summary.find("result", {"name": "recommmendedwith"})
            if recommendedwith and recommendedwith.get("value"):
                players_recommended = recommendedwith["value"].replace("Recommended with ", "").replace(" players", "")
        # 카테고리, 메커니즘, 타입
        categories = [link["value"] for link in item.find_all("link", type="boardgamecategory")]
        mechanisms = [link["value"] for link in item.find_all("link", type="boardgamemechanic")]
        types = [link["value"] for link in item.find_all("link", type="boardgamesubdomain")]
        
        # 한글 제목 찾기
        korean_name = None
        all_names = item.find_all("name")
        for name_elem in all_names:
            name_value = name_elem.get("value", "")
            # 한글 문자가 포함된 제목 찾기
            if re.search(r'[가-힣]', name_value):
                korean_name = name_value
                break
        
        return {
            "bgg_id": int(game_id),
            "name": name,
            "korean_name": korean_name,
            "main_image_url": image,
            "players_min": min_players,
            "players_max": max_players,
            "players_best": players_best,
            "players_recommended": players_recommended,
            "play_time_min": min_time,
            "play_time_max": max_time,
            "age": age,
            "weight": weight,
            "rating": rating,
            "type": ", ".join(types),
            "category": ", ".join(categories),
            "mechanism": ", ".join(mechanisms),
            "url": f"https://boardgamegeek.com/boardgame/{game_id}"
        }
    except Exception as e:
        print(f"[API 파싱 실패] {game_id} / {e}")
        return None

def update_missing_data():
    """기존 데이터에서 누락된 정보(이미지, 한글 제목, 평점, 추천 인원)를 업데이트하는 함수"""
    conn = get_db_connection()
    c = conn.cursor()
    
    # 이미지, 한글 제목, 평점, 또는 추천 인원이 없는 게임들 찾기
    c.execute('''
        SELECT bgg_id, name, korean_name, main_image_url, rating, players_recommended
        FROM boardgames 
        WHERE main_image_url IS NULL OR main_image_url = '' 
           OR korean_name IS NULL OR korean_name = ''
           OR rating IS NULL OR rating = 0
           OR players_recommended IS NULL OR players_recommended = ''
    ''')
    games_to_update = c.fetchall()
    conn.close()
    
    if not games_to_update:
        print("업데이트할 게임이 없습니다.")
        return
    
    print(f"누락된 데이터 업데이트 대상: {len(games_to_update)}개 게임")
    
    updated_count = 0
    failed_count = 0
    
    for bgg_id, name, korean_name, image_url, current_rating, current_recommended in games_to_update:
        print(f"[데이터 업데이트] {name} (ID: {bgg_id})")
        print(f"  - 현재 한글 제목: {korean_name or '없음'}")
        print(f"  - 현재 이미지: {'있음' if image_url else '없음'}")
        print(f"  - 현재 평점: {current_rating or '없음'}")
        print(f"  - 현재 추천 인원: {current_recommended or '없음'}")
        
        game = fetch_bgg_api(str(bgg_id))
        if game:
            # 기존 데이터와 병합
            updated_game = {
                "bgg_id": bgg_id,
                "name": game.get('name', name),
                "korean_name": game.get('korean_name') or korean_name,
                "main_image_url": game.get('main_image_url') or image_url,
                "players_min": game.get('players_min'),
                "players_max": game.get('players_max'),
                "players_best": game.get('players_best'),
                "players_recommended": game.get('players_recommended') or current_recommended,
                "play_time_min": game.get('play_time_min'),
                "play_time_max": game.get('play_time_max'),
                "age": game.get('age'),
                "weight": game.get('weight'),
                "rating": game.get('rating'),
                "type": game.get('type'),
                "category": game.get('category'),
                "mechanism": game.get('mechanism'),
                "url": game.get('url')
            }
            
            save_boardgame_to_db(updated_game)
            
            # 업데이트된 정보 출력
            if game.get('korean_name') and not korean_name:
                print(f"  ✓ 한글 제목 추가: {game['korean_name']}")
            if game.get('main_image_url') and not image_url:
                print(f"  ✓ 이미지 추가: {game['main_image_url'][:50]}...")
            if game.get('rating') and (not current_rating or current_rating == 0):
                print(f"  ✓ 평점 업데이트: {game['rating']}")
            if game.get('players_recommended') and not current_recommended:
                print(f"  ✓ 추천 인원 추가: {game['players_recommended']}")
            
            updated_count += 1
        else:
            print(f"  ✗ 크롤링 실패")
            failed_count += 1
        
        time.sleep(0.3)  # API 호출 간격 조절
    
    print(f"데이터 업데이트 완료: {updated_count}개 성공, {failed_count}개 실패")

def crawl_all_pages():
    """첫 페이지부터 순차적으로 크롤링하는 함수"""
    page = 1
    total_games = 0
    new_games = 0
    updated_games = 0
    
    while True:
        print(f"\n=== 페이지 {page} 크롤링 시작 ===")
        
        try:
            url = f'https://boardgamegeek.com/browse/boardgame/page/{page}'
            res = requests.get(url, headers=HEADERS, cookies=COOKIES)
            soup = BeautifulSoup(res.text, 'html.parser')
            
            rows = soup.select('tr[id^="row_"]')
            if not rows:
                print(f"페이지 {page}에 게임이 없습니다. 크롤링 종료.")
                break
                
            print(f"페이지 {page}에서 {len(rows)}개 게임 발견")
            
            for i, row in enumerate(rows):
                link = row.select_one('a.primary')
                if not link or not link.get('href'):
                    continue
                    
                match = re.search(r'/boardgame/(\d+)', link['href'])
                if not match:
                    continue
                    
                game_id = match.group(1)
                print(f"[{page}-{i+1}/{len(rows)}] 게임 ID: {game_id}")
                
                # 기존 데이터 확인
                conn = get_db_connection()
                c = conn.cursor()
                c.execute('SELECT bgg_id, name, korean_name, main_image_url, rating, players_recommended FROM boardgames WHERE bgg_id = ?', [game_id])
                existing_game = c.fetchone()
                conn.close()
                
                # 3회까지 재시도
                game = None
                for attempt in range(3):
                    game = fetch_bgg_api(game_id)
                    if game:
                        break
                    if attempt < 2:  # 마지막 시도가 아니면 재시도
                        print(f"  [재시도 {attempt+1}/3] {game_id}")
                        time.sleep(0.5)  # 재시도 전 대기
                
                if game:
                    if existing_game:
                        # 기존 데이터가 있으면 부분 업데이트 (즐겨찾기 등 유지)
                        update_boardgame_partial(game)
                        
                        # 업데이트된 정보 출력
                        bgg_id, name, korean_name, image_url, current_rating, current_recommended = existing_game
                        updated_fields = []
                        if game.get('korean_name') and not korean_name:
                            updated_fields.append("한글 제목")
                        if game.get('main_image_url') and not image_url:
                            updated_fields.append("이미지")
                        if game.get('rating') and (not current_rating or current_rating == 0):
                            updated_fields.append("평점")
                        if game.get('players_recommended') and not current_recommended:
                            updated_fields.append("추천 인원")
                        
                        if updated_fields:
                            print(f"  ✓ 업데이트: {', '.join(updated_fields)}")
                            updated_games += 1
                        else:
                            print(f"  - 업데이트 없음")
                    else:
                        # 새로운 게임이면 전체 저장
                        save_boardgame_to_db(game)
                        print(f"  ✓ 신규 저장: {game['name']}")
                        new_games += 1
                    
                    total_games += 1
                else:
                    print(f"  ✗ 실패")
                
                time.sleep(0.3)  # API 호출 간격 조절
            
            print(f"페이지 {page} 완료. 현재까지 총 {total_games}개 게임 (신규: {new_games}, 업데이트: {updated_games})")
            page += 1
            
        except Exception as e:
            print(f"페이지 {page} 크롤링 실패: {e}")
            break
    
    print(f"\n전체 크롤링 완료: 총 {total_games}개 게임 (신규: {new_games}, 업데이트: {updated_games})")

if __name__ == "__main__":
    from db import init_db
    init_db()
    
    print("=== 보드게임 크롤링 시작 ===")
    print("1. 전체 페이지 크롤링")
    crawl_all_pages()
    
    print("\n=== 누락된 데이터 업데이트 ===")
    print("2. 누락된 데이터 업데이트")
    update_missing_data()
    
    print("\n=== 크롤링 완료 ===") 