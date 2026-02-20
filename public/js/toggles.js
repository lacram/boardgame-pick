// Toggle functionality for favorites, scheduled, and owned games

function toggleFavorite(button, rowId, currentFav) {
    const requestData = {
        rowId: rowId,
        currentFav: currentFav
    };
    
    // 버튼 비활성화
    button.disabled = true;
    
    fetch('/toggle-favorite', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 버튼 상태만 업데이트
            const icon = button.querySelector('img');
            if (data.isFavorite) {
                if (icon) icon.src = '/images/bookmark-on.svg';
                button.classList.add('active');
                button.setAttribute('data-favorite', '1');
            } else {
                if (icon) icon.src = '/images/bookmark-off.svg';
                button.classList.remove('active');
                button.setAttribute('data-favorite', '0');
            }
        } else {
            alert('즐겨찾기 업데이트 실패');
        }
    })
    .catch(error => {
        console.error('즐겨찾기 토글 에러:', error);
        alert('즐겨찾기 토글 중 오류가 발생했습니다.');
    })
    .finally(() => {
        // 버튼 다시 활성화
        button.disabled = false;
    });
}

function toggleScheduled(button, rowId, currentScheduled) {
    const requestData = {
        rowId: rowId,
        currentScheduled: currentScheduled
    };
    
    // 버튼 비활성화
    button.disabled = true;
    
    fetch('/toggle-scheduled', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 버튼 상태만 업데이트
            const icon = button.querySelector('img');
            if (data.isScheduled) {
                if (icon) icon.src = '/images/scheduled-on.svg';
                button.classList.add('active');
                button.setAttribute('data-scheduled', '1');
            } else {
                if (icon) icon.src = '/images/scheduled-off.svg';
                button.classList.remove('active');
                button.setAttribute('data-scheduled', '0');
            }
        } else {
            alert('플레이 예정 업데이트 실패');
        }
    })
    .catch(error => {
        console.error('플레이 예정 토글 에러:', error);
        alert('플레이 예정 토글 중 오류가 발생했습니다.');
    })
    .finally(() => {
        // 버튼 다시 활성화
        button.disabled = false;
    });
}

function toggleOwned(button, rowId, currentOwned) {
    const requestData = {
        rowId: rowId,
        currentOwned: currentOwned
    };
    
    // 버튼 비활성화
    button.disabled = true;
    
    fetch('/toggle-owned', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // 버튼 상태만 업데이트
            const icon = button.querySelector('img');
            if (data.isOwned) {
                if (icon) icon.src = '/images/owned-on.svg';
                button.classList.add('active');
                button.setAttribute('data-owned', '1');
            } else {
                if (icon) icon.src = '/images/owned-off.svg';
                button.classList.remove('active');
                button.setAttribute('data-owned', '0');
            }
        } else {
            alert('보유 업데이트 실패');
        }
    })
    .catch(error => {
        console.error('보유 토글 에러:', error);
        alert('보유 토글 중 오류가 발생했습니다.');
    })
    .finally(() => {
        // 버튼 다시 활성화
        button.disabled = false;
    });
}
