const fs = require('fs');
const path = require('path');

const LOGIN_MODE = process.env.BOARDLIFE_LOGIN_MODE || 'cookie';
const SITE_URL = process.env.BOARDLIFE_SITE_URL || 'https://boardlife.co.kr';
const LOGIN_URL = process.env.BOARDLIFE_LOGIN_URL || SITE_URL;
const USERNAME = process.env.BOARDLIFE_USERNAME || '';
const PASSWORD = process.env.BOARDLIFE_PASSWORD || '';
const COOKIE_FILE = process.env.BOARDLIFE_COOKIE_FILE || path.join(process.cwd(), '.boardlife.cookie');
const COOKIE_TTL_MINUTES = parseInt(process.env.BOARDLIFE_COOKIE_TTL_MINUTES || '120', 10);
const PLAYWRIGHT_HEADLESS = process.env.BOARDLIFE_PLAYWRIGHT_HEADLESS !== 'false';
const PLAYWRIGHT_EXECUTABLE_PATH = process.env.BOARDLIFE_PLAYWRIGHT_EXECUTABLE_PATH || '';
const PLAYWRIGHT_TIMEOUT_MS = parseInt(process.env.BOARDLIFE_PLAYWRIGHT_TIMEOUT_MS || '30000', 10);

async function fillFirstAvailable(page, selectors, value) {
    for (const selector of selectors) {
        const node = await page.$(selector);
        if (!node) continue;
        await page.$eval(selector, (el, v) => {
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, value);
        return selector;
    }
    return '';
}

function toCookieHeader(cookies) {
    return cookies.map(item => `${item.name}=${item.value}`).join('; ');
}

function hasLiveCookieFile() {
    if (!fs.existsSync(COOKIE_FILE)) return false;
    const stat = fs.statSync(COOKIE_FILE);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs < COOKIE_TTL_MINUTES * 60 * 1000;
}

function readCookieFile() {
    if (!fs.existsSync(COOKIE_FILE)) return '';
    return fs.readFileSync(COOKIE_FILE, 'utf8').trim();
}

function writeCookieFile(cookie) {
    fs.writeFileSync(COOKIE_FILE, cookie, 'utf8');
}

async function loginWithPlaywright() {
    if (!USERNAME || !PASSWORD) {
        throw new Error('BOARDLIFE_USERNAME and BOARDLIFE_PASSWORD are required for playwright mode');
    }

    // lazy import so runtime does not require playwright unless enabled
    const { chromium } = require('playwright');
    const launchOptions = { headless: PLAYWRIGHT_HEADLESS };
    if (PLAYWRIGHT_EXECUTABLE_PATH) {
        launchOptions.executablePath = PLAYWRIGHT_EXECUTABLE_PATH;
    }

    const browser = await chromium.launch(launchOptions);

    try {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(PLAYWRIGHT_TIMEOUT_MS);
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
        const loginToggle = await page.$('#member-login');
        if (loginToggle) {
            await page.click('#member-login');
            await page.waitForTimeout(300);
        }

        const idSelector = await fillFirstAvailable(page, [
            'input[name="member_id"]',
            'input#member_id',
            'input[name="mb_id"]',
            'input[name="id"]',
            'input[type="text"]'
        ], USERNAME);

        const passSelector = await fillFirstAvailable(page, [
            'input[name="member_pass"]',
            'input#member_pass',
            'input[name="mb_password"]',
            'input[name="password"]',
            'input[type="password"]'
        ], PASSWORD);

        if (!idSelector || !passSelector) {
            throw new Error(`Login form not found at ${LOGIN_URL}`);
        }

        const formSelector = 'form[name="happy_member_login_form"], #member-login-dropdown form, form[action*="happy_member_login.php"]';
        const loginForm = await page.$(formSelector);
        if (!loginForm) {
            throw new Error(`Login form not found at ${LOGIN_URL}`);
        }

        await page.$eval(formSelector, form => form.submit());
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);

        const cookies = await context.cookies();
        const cookieHeader = toCookieHeader(cookies);
        if (!cookieHeader) {
            throw new Error('Playwright login completed but no cookies were captured');
        }
        writeCookieFile(cookieHeader);
        return cookieHeader;
    } finally {
        await browser.close();
    }
}

async function getBoardlifeCookie() {
    if (LOGIN_MODE === 'cookie') {
        return process.env.BOARDLIFE_COOKIE || readCookieFile();
    }

    if (LOGIN_MODE !== 'playwright') {
        throw new Error(`Unsupported BOARDLIFE_LOGIN_MODE: ${LOGIN_MODE}`);
    }

    if (hasLiveCookieFile()) {
        return readCookieFile();
    }

    return loginWithPlaywright();
}

module.exports = {
    getBoardlifeCookie,
    loginWithPlaywright
};
