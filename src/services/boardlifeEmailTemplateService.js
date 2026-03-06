function inferType(notification) {
    const title = (notification.title || '').toLowerCase();
    const body = (notification.body || '').toLowerCase();
    const combined = `${title} ${body}`;

    if (/댓글|코멘트|comment/.test(combined)) return 'comment';
    if (/쪽지|메시지|message/.test(combined)) return 'message';
    if (/좋아요|추천|like/.test(combined)) return 'reaction';
    return 'generic';
}

function templateByType(type) {
    if (type === 'comment') {
        return {
            prefix: '[댓글 알림]',
            intro: '새 댓글 알림이 도착했습니다.'
        };
    }

    if (type === 'message') {
        return {
            prefix: '[쪽지 알림]',
            intro: '새 쪽지 알림이 도착했습니다.'
        };
    }

    if (type === 'reaction') {
        return {
            prefix: '[반응 알림]',
            intro: '새 반응 알림이 도착했습니다.'
        };
    }

    return {
        prefix: '[새 알림]',
        intro: '새 BoardLife 알림이 도착했습니다.'
    };
}

function buildBoardlifeMail(notification) {
    const type = inferType(notification);
    const template = templateByType(type);
    const title = notification.title || '제목 없음';
    const body = notification.body || '';
    const url = notification.source_url || '';
    const occurredAt = notification.occurred_at || '';

    return {
        subject: `[BoardLife] ${template.prefix} ${title}`,
        text: [
            template.intro,
            '',
            `제목: ${title}`,
            body ? `내용: ${body}` : '',
            url ? `링크: ${url}` : '',
            occurredAt ? `발생시각: ${occurredAt}` : ''
        ].filter(Boolean).join('\n')
    };
}

function buildBoardlifeDigestMail(notifications, options = {}) {
    const isTestMode = Boolean(options.testMode);
    const total = notifications.length;
    const modeLabel = isTestMode ? '[TEST] ' : '';
    const subject = `[BoardLife] ${modeLabel}새 알림 ${total}건`;

    const lines = [];
    lines.push(isTestMode ? '테스트 모드 묶음 발송입니다.' : '신규 알림 묶음 발송입니다.');
    lines.push('');

    notifications.forEach((item, index) => {
        const title = item.title || '제목 없음';
        const body = item.body || '';
        const url = item.source_url || '';
        const occurredAt = item.occurred_at || '';

        lines.push(`${index + 1}. ${title}`);
        if (body) lines.push(`   내용: ${body}`);
        if (url) lines.push(`   링크: ${url}`);
        if (occurredAt) lines.push(`   발생시각: ${occurredAt}`);
        lines.push('');
    });

    return {
        subject,
        text: lines.join('\n').trim()
    };
}

module.exports = {
    buildBoardlifeMail,
    buildBoardlifeDigestMail
};
