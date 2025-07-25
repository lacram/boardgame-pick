

import streamlit as st
from db import init_db, get_db_connection
import datetime

# DB 초기화
init_db()

st.title('Boardgame Pick')
st.write('모바일 완벽 호환 보드게임 리스트')

conn = get_db_connection()
c = conn.cursor()

# 전체 카테고리/타입/메커니즘 목록 추출
c.execute('SELECT DISTINCT category FROM boardgames WHERE category IS NOT NULL')
categories = sorted(set(sum([x[0].split(', ') for x in c.fetchall() if x[0]], [])))
c.execute('SELECT DISTINCT type FROM boardgames WHERE type IS NOT NULL')
types = sorted(set(sum([x[0].split(', ') for x in c.fetchall() if x[0]], [])))
c.execute('SELECT DISTINCT mechanism FROM boardgames WHERE mechanism IS NOT NULL')
mechanisms = sorted(set(sum([x[0].split(', ') for x in c.fetchall() if x[0]], [])))

with st.form('search_form'):
    col1, col2 = st.columns([2,1])
    with col1:
        search = st.text_input('게임 이름 검색')
    with col2:
        page_size = st.selectbox('페이지당 개수', [10, 20, 50], index=0)
    col3, col4, col5 = st.columns(3)
    with col3:
        category = st.selectbox('카테고리', ['전체'] + categories)
    with col4:
        type_ = st.selectbox('타입', ['전체'] + types)
    with col5:
        mechanism = st.selectbox('메커니즘', ['전체'] + mechanisms)
    col6, col7 = st.columns(2)
    with col6:
        search_players = st.text_input('플레이 인원(예: 3)')
    with col7:
        search_best = st.text_input('베스트 인원(예: 4)')
    submitted = st.form_submit_button('검색')

# 즐겨찾기만 보기 토글
if 'show_favorites_only' not in st.session_state:
    st.session_state['show_favorites_only'] = False
show_fav = st.checkbox('즐겨찾기만 보기', value=st.session_state['show_favorites_only'], key='fav_filter')
st.session_state['show_favorites_only'] = show_fav

# 쿼리 빌드
columns = [
    'rowid', 'bgg_id', 'name', 'main_image_url', 'players_min', 'players_max', 'players_best',
    'play_time_min', 'play_time_max', 'weight', 'rating', 'type', 'category', 'mechanism', 'url', 'is_favorite'
]
query = f'SELECT {", ".join(columns)} FROM boardgames WHERE 1=1'
params = []
if search:
    query += ' AND name LIKE ?'
    params.append(f'%{search}%')
if category and category != '전체':
    query += ' AND category LIKE ?'
    params.append(f'%{category}%')
if type_ and type_ != '전체':
    query += ' AND type LIKE ?'
    params.append(f'%{type_}%')
if mechanism and mechanism != '전체':
    query += ' AND mechanism LIKE ?'
    params.append(f'%{mechanism}%')
if search_players:
    try:
        n = int(search_players)
        query += ' AND players_min <= ? AND players_max >= ?'
        params.extend([n, n])
    except:
        pass
if search_best:
    query += ' AND players_best LIKE ?'
    params.append(f'%{search_best}%')
if st.session_state['show_favorites_only']:
    query += ' AND is_favorite = 1'

# 전체 개수
c.execute(f'SELECT COUNT(*) FROM ({query})', params)
total = c.fetchone()[0]

# 페이지네이션
page = st.number_input('페이지', min_value=1, max_value=max(1, (total-1)//page_size+1), value=1, step=1)
offset = (page-1)*page_size
query += ' LIMIT ? OFFSET ?'
params += [page_size, offset]
c.execute(query, params)
rows = c.fetchall()

st.write(f'총 {total}개 결과, {page} / {max(1, (total-1)//page_size+1)} 페이지')

if 'show_modal' not in st.session_state:
    st.session_state['show_modal'] = False
if 'selected_game' not in st.session_state:
    st.session_state['selected_game'] = None

def show_detail_modal(game):
    with st.expander(f"상세 정보: {game[2]}", expanded=True):
        if game[3] and game[3].startswith('http'):
            st.image(game[3], use_container_width=True)
        st.markdown(f"### {game[2]}")
        st.write(f"플레이 인원: {game[4]} ~ {game[5]}")
        st.write(f"베스트 인원: {game[6]}")
        st.write(f"플레이 시간: {game[7]} ~ {game[8]}분")
        st.write(f"난이도: {game[9]}")
        st.write(f"레이팅: {game[10]}")
        st.write(f"Type: {game[11]}")
        st.write(f"Category: {game[12]}")
        st.write(f"Mechanism: {game[13]}")
        if game[14]:
            st.markdown(f"[BGG 상세 페이지]({game[14]})")
        # 인원 수정 폼
        st.markdown('---')
        st.subheader('플레이 인원/베스트 인원 수정')
        with st.form(f'edit_players_{game[0]}'):
            new_min = st.number_input('최소 인원', min_value=1, value=game[4] if game[4] else 1, step=1)
            new_max = st.number_input('최대 인원', min_value=new_min, value=game[5] if game[5] else new_min, step=1)
            new_best = st.text_input('베스트 인원(쉼표로 구분)', value=str(game[6]) if game[6] else '')
            if st.form_submit_button('수정 저장'):
                conn2 = get_db_connection()
                conn2.execute('UPDATE boardgames SET players_min=?, players_max=?, players_best=? WHERE rowid=?', (new_min, new_max, new_best, game[0]))
                conn2.commit()
                conn2.close()
                st.success('인원 정보가 수정되었습니다! 새로고침 후 확인하세요.')
        # 리뷰 조회
        c = get_db_connection().cursor()
        c.execute('SELECT rating, text, created_at FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC', (game[1],))
        reviews = c.fetchall()
        st.markdown('---')
        st.subheader('리뷰 남기기')
        with st.form(f'review_form_{game[1]}'):
            rating = st.slider('별점(1~10)', 1, 10, 10)
            text = st.text_area('리뷰(선택)', '')
            if st.form_submit_button('리뷰 등록'):
                conn2 = get_db_connection()
                conn2.execute('INSERT INTO reviews (bgg_id, rating, text) VALUES (?, ?, ?)', (game[1], rating, text))
                conn2.commit()
                conn2.close()
                st.success('리뷰가 등록되었습니다! 새로고침 후 확인하세요.')
        st.markdown('---')
        st.subheader('리뷰 목록')
        if not reviews:
            st.write('아직 리뷰가 없습니다.')
        else:
            for r in reviews:
                st.write(f"⭐ {r[0]}점 | {r[2][:16]} | {r[1] if r[1] else ''}")

# 목차 없이, 각 게임을 2행(rowspan)으로 쪼개서 구성
# 이미지 셀을 정사각형(1:1), object-fit:cover, 동일 크기로
html = """
<style>
.bgp-table3 { width:100%; border-collapse:collapse; min-width:420px; }
.bgp-td { border:1px solid #e0e0e0; padding:8px 7px; font-size:1em; }
.bgp-imgbox { width:76px; height:76px; display:flex; align-items:center; justify-content:center; }
.bgp-img3 { width:72px; height:72px; object-fit:cover; border-radius:10px; background:#fafafa; box-shadow:0 1px 2px #0001; }
.bgp-title3 { font-weight:bold; color:#1976d2; font-size:1.08em; text-align:left; text-decoration:underline; }
.bgp-cellsub { color:#444; font-size:0.97em; }
@media (max-width: 700px) {
  .bgp-table3 { font-size:0.97em; min-width:320px; }
  .bgp-imgbox { width:52px; height:52px; }
  .bgp-img3 { width:48px; height:48px; }
  .bgp-td { padding:4px 2px; }
  .bgp-title3 { font-size:1em; }
}
.table-scroll-x { overflow-x:auto; width:100%; }
</style>
<div class='table-scroll-x'>
<table class='bgp-table3'>
"""

conn2 = get_db_connection()
c2 = conn2.cursor()

for row in rows:
    c2.execute('SELECT rating FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC LIMIT 1', (row[1],))
    my_review = c2.fetchone()
    my_rating = my_review[0] if my_review else ''
    html += "<tr>"
    # 이미지 (2행 합침, 정사각형 박스)
    if row[3] and isinstance(row[3], str) and row[3].startswith('http'):
        html += f"<td class='bgp-td' rowspan='2' style='width:80px; text-align:center; vertical-align:middle;'><div class='bgp-imgbox'><img src='{row[3]}' class='bgp-img3'></div></td>"
    else:
        html += "<td class='bgp-td' rowspan='2'><div class='bgp-imgbox'></div></td>"
    # 이름(왼쪽) + 즐겨찾기(오른쪽, 같은 셀, st.button)
    fav = row[15] if len(row) > 15 else 0
    fav_icon = '★' if fav else '☆'
    fav_color = '#FFD600' if fav else '#bbb'
    fav_btn_key = f'favbtn_{row[0]}'
    html += f"<td class='bgp-td bgp-title3' colspan='3' style='position:relative;'>"
    html += f"<span style='display:inline-block; text-align:left;'>{'<a href=\'' + row[14] + '\' target=\'_blank\'>' + row[2] + '</a>'}</span>"
    html += f"<form style='position:absolute; right:12px; top:50%; transform:translateY(-50%); display:inline;' method='post'><button name='fav' value='{row[0]}' style='background:none;border:none;cursor:pointer;font-size:1.2em;color:{fav_color};' formmethod='post'>{fav_icon}</button></form>"
    html += "</td>"
    html += "</tr>"
    html += "<tr>"
    # 인원/베스트
    html += f"<td class='bgp-td bgp-cellsub'>👥 {row[4]}~{row[5]}명<br><span style='color:#888;'>⭐ {row[6]}명</span></td>"
    # 시간/난이도
    html += f"<td class='bgp-td bgp-cellsub'>⏱️ {row[7]}~{row[8]}분<br><span style='color:#888;'>난이도:{row[9]}</span></td>"
    # 평점/내평점
    html += f"<td class='bgp-td bgp-cellsub'>🌟 {row[10]}<br><span style='color:#888;'>내평점:{my_rating}</span></td>"
    html += "</tr>"

st.markdown(html, unsafe_allow_html=True)

# 즐겨찾기 버튼(st.button) 실제 배치 및 동작
for row in rows:
    fav = row[15] if len(row) > 15 else 0
    fav_icon = '★' if fav else '☆'
    fav_color = '#FFD600' if fav else '#bbb'
    btn_label = f"{fav_icon}"
    btn_key = f'favbtn_{row[0]}'
    # 버튼을 이름 셀의 오른쪽 끝에 오버레이
    btn_clicked = st.button(btn_label, key=btn_key, help='즐겨찾기', args=(), kwargs=None)
    if btn_clicked:
        conn2 = get_db_connection()
        c2 = conn2.cursor()
        c2.execute('UPDATE boardgames SET is_favorite=? WHERE rowid=?', (0 if fav else 1, row[0]))
        conn2.commit()
        conn2.close()
        st.rerun()

conn2.close()

conn.close() 