async function fetchWithTimeout(url, options = {}) {
    const { timeoutMs = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...fetchOptions,
            signal: controller.signal
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    fetchWithTimeout
};
