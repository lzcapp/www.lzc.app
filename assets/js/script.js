'use strict';

/* ====================================
   Helpers
==================================== */
const elementToggleFunc = (elem) => elem.classList.toggle('active');

/* ====================================
   Sidebar (mobile contacts accordion)
==================================== */
const sidebar = document.querySelector('[data-sidebar]');
const sidebarBtn = document.querySelector('[data-sidebar-btn]');

if (sidebarBtn && sidebar) {
    sidebarBtn.addEventListener('click', () => {
        elementToggleFunc(sidebar);
        sidebarBtn.setAttribute('aria-expanded', sidebar.classList.contains('active') ? 'true' : 'false');
    });
}

/* ====================================
   Page navigation (About / Resume / Friends / Sites)
==================================== */
const navigationLinks = document.querySelectorAll('[data-nav-link]');
const pages = document.querySelectorAll('[data-page]');
const PAGE_ORDER = ['about', 'resume', 'friends', 'sites'];

const btnPageName = (btn) => btn.textContent.trim().toLowerCase();

function setActivePage(pageName) {
    let activeEl = null;

    pages.forEach((page) => {
        const match = page.dataset.page === pageName;
        page.classList.toggle('active', match);
        if (match) activeEl = page;
    });

    navigationLinks.forEach((btn) => {
        const match = btnPageName(btn) === pageName;
        btn.classList.toggle('active', match);
        btn.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    if (activeEl) {
        // jump to top instantly when switching panels
        window.scrollTo(0, 0);
        resetReveals(activeEl);
    }
}

navigationLinks.forEach((btn) => {
    btn.addEventListener('click', () => setActivePage(btnPageName(btn)));
});

/* ====================================
   Scroll reveal (IntersectionObserver)
==================================== */
const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });

function resetReveals(container) {
    // panels that are hidden cannot intersect — clear them so they animate again later
    pages.forEach((page) => {
        if (page !== container) {
            page.querySelectorAll('.reveal').forEach((el) => {
                el.classList.remove('in');
                revealObserver.unobserve(el);
            });
        }
    });

    // (re)observe the visible panel's reveals; ones already in viewport fire immediately
    container.querySelectorAll('.reveal').forEach((el) => {
        if (!el.classList.contains('in')) revealObserver.observe(el);
    });
}

/* ====================================
   Keyboard navigation (← / →)
==================================== */
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    const activeBtn = document.querySelector('.navbar-link.active');
    if (!activeBtn) return;

    const activeIdx = PAGE_ORDER.indexOf(btnPageName(activeBtn));
    if (activeIdx === -1) return;

    // only handle when focus is on the page chrome, not inside text/iframe
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'].includes(tag)) return;

    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const nextName = PAGE_ORDER[(activeIdx + dir + PAGE_ORDER.length) % PAGE_ORDER.length];
    const nextBtn = [...navigationLinks].find((b) => btnPageName(b) === nextName);

    if (nextBtn) {
        e.preventDefault();
        setActivePage(nextName);
        nextBtn.focus({ preventScroll: true });
    }
});

/* ====================================
   Theme toggle (light / dark, auto-follow)
==================================== */
const THEME_KEY = 'lzc-theme';
const themeRoot = document.documentElement;
const themeBtn = document.querySelector('[data-theme-toggle]');

const THEME_COLORS = { light: '#f7f7f4', dark: '#0c0c11' };

const currentTheme = () => themeRoot.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

function syncThemeColor() {
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.removeAttribute('media'); // manual choice overrides media matching
        meta.setAttribute('content', THEME_COLORS[currentTheme()]);
    });
}

function updateThemeBtn() {
    if (!themeBtn) return;
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    themeBtn.setAttribute('aria-label',
        `切换主题（当前${currentTheme() === 'light' ? '亮色' : '暗色'}，点击转${next === 'light' ? '亮色' : '暗色'}）`);
}

function applyTheme(theme, { user = false, persist = true } = {}) {
    themeRoot.setAttribute('data-theme', theme);
    if (user) {
        themeRoot.removeAttribute('data-theme-auto'); // stop following the system
        if (persist) {
            try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
        }
    }
    syncThemeColor();
    updateThemeBtn();
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light', { user: true });
    });
}

// keep following the OS only while the user hasn't chosen manually
const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
if (prefersLight) {
    const onSystemChange = (e) => {
        if (themeRoot.hasAttribute('data-theme-auto')) {
            applyTheme(e.matches ? 'light' : 'dark', { persist: false });
        }
    };
    if (prefersLight.addEventListener) prefersLight.addEventListener('change', onSystemChange);
    else if (prefersLight.addListener) prefersLight.addListener(onSystemChange); // Safari < 14
}

syncThemeColor();
updateThemeBtn();

/* ====================================
   Init
==================================== */
function init() {
    const activePage = document.querySelector('article.active');
    if (activePage) resetReveals(activePage);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
