// User menu functionality

document.addEventListener('DOMContentLoaded', function() {
    const menuButton = document.getElementById('userMenuButton');
    const dropdown = document.getElementById('userMenuDropdown');
    const userList = document.getElementById('userList');
    const addButton = document.getElementById('addUserButton');
    const newUserInput = document.getElementById('newUserId');
    const currentUserLabel = document.getElementById('currentUserLabel');

    if (!menuButton || !dropdown) return;

    menuButton.addEventListener('click', function() {
        const isOpen = !dropdown.hasAttribute('hidden');
        if (isOpen) {
            dropdown.setAttribute('hidden', '');
            menuButton.setAttribute('aria-expanded', 'false');
        } else {
            dropdown.removeAttribute('hidden');
            menuButton.setAttribute('aria-expanded', 'true');
            loadUsers();
        }
    });

    document.addEventListener('click', function(event) {
        if (!dropdown.contains(event.target) && !menuButton.contains(event.target)) {
            dropdown.setAttribute('hidden', '');
            menuButton.setAttribute('aria-expanded', 'false');
        }
    });

    if (addButton) {
        addButton.addEventListener('click', function() {
            const userId = (newUserInput.value || '').trim();
            if (!userId) {
                alert('유저 ID를 입력해주세요.');
                return;
            }
            addUser(userId);
        });
    }

    if (newUserInput) {
        newUserInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                addButton.click();
            }
        });
    }

    function loadUsers() {
        fetch('/users')
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    alert('유저 목록 로딩 실패');
                    return;
                }
                renderUsers(data.users || []);
            })
            .catch(error => {
                console.error('유저 목록 에러:', error);
                alert('유저 목록을 불러오는 중 오류가 발생했습니다.');
            });
    }

    function renderUsers(users) {
        userList.innerHTML = '';
        if (users.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'user-empty';
            empty.textContent = '등록된 유저가 없습니다.';
            userList.appendChild(empty);
            return;
        }
        users.forEach(user => {
            const button = document.createElement('button');
            button.className = 'user-item';
            button.type = 'button';
            button.textContent = user.id;
            const isCurrent = currentUserLabel && currentUserLabel.textContent === user.id;
            if (isCurrent) {
                button.classList.add('active');
            }
            button.addEventListener('click', function() {
                if (isCurrent && window.location.pathname !== '/mypage') {
                    window.location.href = '/mypage';
                    return;
                }
                selectUser(user.id);
            });
            userList.appendChild(button);
        });
    }

    function addUser(userId) {
        fetch('/users/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert(data.error || '유저 추가 실패');
                return;
            }
            newUserInput.value = '';
            selectUser(userId);
        })
        .catch(error => {
            console.error('유저 추가 에러:', error);
            alert('유저 추가 중 오류가 발생했습니다.');
        });
    }

    function selectUser(userId) {
        fetch('/users/select', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert(data.error || '유저 변경 실패');
                return;
            }
            if (currentUserLabel) currentUserLabel.textContent = userId;
            window.location.reload();
        })
        .catch(error => {
            console.error('유저 변경 에러:', error);
            alert('유저 변경 중 오류가 발생했습니다.');
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.mypage-tab');
    const panels = document.querySelectorAll('.mypage-panel');

    if (tabButtons.length === 0 || panels.length === 0) return;

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const target = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            panels.forEach(panel => panel.classList.remove('active'));

            button.classList.add('active');
            const panel = document.querySelector(`.mypage-panel[data-panel="${target}"]`);
            if (panel) panel.classList.add('active');
        });
    });
});
