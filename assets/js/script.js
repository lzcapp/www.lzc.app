'use strict';

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ====================================
   Scroll spy — highlight active section
==================================== */
const sections = Array.from(document.querySelectorAll('.section[data-page]'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const SECTION_ORDER = ['about', 'resume', 'friends', 'sites'];

const linkForPage = (name) => navLinks.find((l) => l.getAttribute('href') === '#' + name);

const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const name = entry.target.dataset.page;
        navLinks.forEach((l) => {
            l.classList.toggle('active', l.getAttribute('href') === '#' + name);
        });
    });
}, { rootMargin: '-30% 0px -55% 0px' });

sections.forEach((s) => spyObserver.observe(s));

// at the very bottom, force-highlight the last section
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
        const last = '#' + SECTION_ORDER[SECTION_ORDER.length - 1];
        navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === last));
    }
}, { passive: true });

/* ====================================
   Back to top
==================================== */
const toTopBtn = document.querySelector('[data-to-top]');

if (toTopBtn) {
    window.addEventListener('scroll', () => {
        toTopBtn.hidden = window.scrollY < 400;
    }, { passive: true });

    toTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
}

/* ====================================
   Scroll reveal (IntersectionObserver)
   Show anything already in viewport (or close to it) immediately,
   then animate the rest as the user scrolls in.
==================================== */
const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('in');
            obs.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });

function initReveals() {
    const all = document.querySelectorAll('.reveal');
    const vh = window.innerHeight;
    let below = 0;
    all.forEach((el) => {
        const top = el.getBoundingClientRect().top;
        if (top < vh + 80) {
            // near or in viewport — show immediately
            el.classList.add('in');
        } else {
            el.classList.remove('in');
            revealObserver.observe(el);
            below++;
        }
    });
    return below;
}

// run on load and after fonts settle (font swap changes layout)
initReveals();
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initReveals);
}

/* ====================================
   Keyboard navigation (← / →)
==================================== */
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

    const activeLink = document.querySelector('.nav-link.active');
    if (!activeLink) return;

    const activeIdx = SECTION_ORDER.indexOf(activeLink.getAttribute('href').slice(1));
    if (activeIdx === -1) return;

    // only handle when focus is on the page chrome, not inside text/iframe
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'].includes(tag)) return;

    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const nextName = SECTION_ORDER[(activeIdx + dir + SECTION_ORDER.length) % SECTION_ORDER.length];
    const target = document.getElementById(nextName);

    if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        const nextLink = linkForPage(nextName);
        if (nextLink) nextLink.focus({ preventScroll: true });
    }
});

/* ====================================
   Theme toggle (light / dark, auto-follow)
==================================== */
const THEME_KEY = 'lzc-theme';
const themeRoot = document.documentElement;
const themeBtn = document.querySelector('[data-theme-toggle]');

const THEME_COLORS = { light: '#f6f5f1', dark: '#0b0b0c' };

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
