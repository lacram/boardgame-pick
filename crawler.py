import requests
from bs4 import BeautifulSoup
from db import get_db_connection, save_boardgame_to_db
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

# 리스트 페이지에서 게임 ID 추출
def fetch_boardgames_from_bgg():
    page = 11
    games = []
    seen_ids = set()
    failed_ids = set()
    while True:
        base_url = f'https://boardgamegeek.com/browse/boardgame/page/{page}'
        res = requests.get(base_url, headers=HEADERS, cookies=COOKIES)
        soup = BeautifulSoup(res.text, 'html.parser')
        rows = soup.select('tr[id^="row_"]')
        if not rows:
            break
        for row in rows:
            link = row.select_one('a.primary')
            if not link or not link.get('href'):
                continue
            match = re.search(r'/boardgame/(\d+)', link['href'])
            if not match:
                continue
            game_id = match.group(1)
            if game_id in seen_ids:
                continue
            seen_ids.add(game_id)
            print(f"[API 크롤링 시도] {game_id}")
            game = None
            for attempt in range(3):
                game = fetch_bgg_api(game_id)
                if game:
                    break
                print(f"[재시도 {attempt+1}/3] {game_id}")
                time.sleep(0.5)
            print(f"[API 크롤링 결과] {game}")
            if game:
                games.append(game)
            else:
                failed_ids.add(game_id)
            time.sleep(0.5)
            if len(games) % 20 == 0:
                print(f"[DB 저장] {len(games)}개 저장 중...")
                for g in games[-20:]:
                    save_boardgame_to_db(g)
                games = []
        print(f"Page {page} done, total games: {len(games)} (이 페이지 누적)")
        page += 1
    if games:
        print(f"[DB 저장] 마지막 {len(games)}개 저장 중...")
        for g in games:
            save_boardgame_to_db(g)
    # 1차 크롤링 실패 id 재시도
    if failed_ids:
        print(f"[1차 실패 id {len(failed_ids)}개] 재시도 중...")
        still_failed = set()
        for game_id in failed_ids:
            game = None
            for attempt in range(3):
                game = fetch_bgg_api(game_id)
                if game:
                    break
                print(f"[최종 재시도 {attempt+1}/3] {game_id}")
                time.sleep(0.5)
            if game:
                save_boardgame_to_db(game)
            else:
                still_failed.add(game_id)
        if still_failed:
            print(f"[최종 실패 id] {sorted(list(still_failed))}")
        else:
            print("모든 게임 크롤링 성공!")
    print(f"크롤링 완료: 총 {len(seen_ids)}개 게임")
    return games

def fetch_bgg_api(game_id):
    url = BGG_API_URL.format(game_id=game_id)
    try:
        res = requests.get(url, headers=HEADERS, cookies=COOKIES)
        soup = BeautifulSoup(res.content, "lxml-xml")
        item = soup.find("item")
        if not item:
            return None
        name = item.find("name", type="primary")
        name = name["value"] if name else None
        image = item.find("image")
        image = image.text if image else None
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
                avg = ratings.find("average")
                if avg and avg["value"] != 'N/A':
                    rating = float(avg["value"])
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
        return {
            "bgg_id": int(game_id),
            "name": name,
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