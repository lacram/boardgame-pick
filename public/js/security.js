function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
}

function withCsrfHeaders(headers) {
    const token = getCsrfToken();
    return {
        ...(headers || {}),
        ...(token ? { 'x-csrf-token': token } : {})
    };
}
