'use strict';

/* ====================================
   Bilingual copy (EN / 中文)
   - elements:  [data-i18n]         → textContent
                [data-i18n-html]    → innerHTML (only our own static strings)
                [data-i18n-content] → content="" (meta tags)
                [data-i18n-attr]    → "aria-label:key,title:key"
   - state:     <html data-lang="en|zh" lang="en|zh-CN">
   - storage:   localStorage 'lzc-lang'  (also honours ?lang=en|zh)
==================================== */

(function () {
    const STORAGE_KEY = 'lzc-lang';
    const HTML_LANG = { en: 'en', zh: 'zh-CN' };

    const DICT = {
        en: {
            'meta.desc': 'Personal portfolio of Laurence L. — engineer, Android enthusiast, photographer. Blog, projects and more.',
            'meta.ogDesc': 'Personal portfolio of Laurence L. — engineer, Android enthusiast, photographer.',
            'meta.ogLocale': 'en_US',

            'a11y.skip': 'Skip to content',
            'a11y.toTop': 'Back to top',
            'logo.home': 'LZC.app home',
            'nav.primary': 'Primary',

            'nav.about': 'About',
            'nav.resume': 'Resume',
            'nav.friends': 'Friends',
            'nav.sites': 'Sites',

            'hero.meta': 'Guangdong, CN',
            'hero.intro': 'Computer Science, Web, Programming... Domain enthusiast',

            'about.title': "What I'm doing",
            'svc.dev.title': 'Software Development',
            'svc.mobile.title': 'Mobile apps',
            'svc.mobile.text': 'Self-taught Android developer.',
            'svc.photo.title': 'Photography',
            'svc.photo.text1': 'Owns a Polaroid Sun 600 LMS.',
            'svc.photo.text2': 'Wishes for a mirrorless camera.',
            'svc.other.title': 'Others',
            'svc.other.text1': 'Build my own PCs',
            'svc.other.text2': 'Movies & Musics, Books, Games …',

            'resume.title': 'Resume',
            'resume.edu': 'Education',
            'resume.experience': 'Experience',
            'resume.downloads': 'Downloads',
            'edu.bnbu': 'Beijing Normal-Hong Kong Baptist University (BNBU)',
            'edu.bnbu.site': 'BNBU website',
            'edu.hkbu': 'Hong Kong Baptist University',
            'edu.hkbu.site': 'HKBU website',
            'edu.degree': 'B.S. in Computer Science and Technology',
            'edu.summerCourse': 'Summer Course: You and Your Health',
            'date.summer2012': 'Summer of 2012',
            'date.summer2018': 'Summer of 2018',
            'date.2025_2026': 'Dec 2025 — May 2026',
            'date.2026present': 'May 2026 — Present',
            'date.2023_2025': 'Aug 2023 — Oct 2025',
            'date.2016present': '2016 — Present',
            'co.embodied': 'Guangdong Embodied Intelligence Technology Co., Ltd.',
            'co.rising': 'Guangdong Rising Holdings Group',
            'co.itran': 'ITran Information System Co., Ltd.',
            'co.ceb': 'China Everbright Bank Co., Ltd.',
            'co.cspa': 'Computer Science Professional Association, UIC',
            'job.embodied': 'Assistant Engineer · Technology Empowerment Department',
            'job.rising': 'Seconded · Embodied Intelligence Training Ground Task Force',
            'job.itran': '.NET Software Development Engineer',
            'exp.founder': 'Founder / Secretary',
            'exp.tedx': 'Technical Team Leader / Stage Manager',
            'exp.intern': 'Intern',
            'exp.cabinet': 'Cabinet Secretary',
            'badge.now': 'Now',
            'dl.cn': '简历 (中文)',
            'dl.en': 'Resume (English)',
            'dl.note': 'All digitally signed with my self-signed X.509 certificate.<br>SHA256 Fingerprint: 90A5C1D81627FD687A17A4C881882DC317292932A1B1FA0FC14EBD5D3C5ED51D.',

            'friends.title': 'Friends',
            'friends.love': 'My Love',
            'friends.friends': 'My Friends',

            'sites.title': 'Sites & Services',
            'sites.status': 'Status Page',
            'sites.statusOpen': 'Open status page',
            'sites.statusIframe': 'Status page of seeleo services',
            'sites.domains': 'Domains',
            'sites.noteSeeleo': '"Seele + O" or "See + Leo"',
            'sites.noteOppor': 'Fake OPPO site for demonstration of <ins>IDN homograph attack</ins>',
            'sites.noteLonglive': 'Long Live the Soviet Union',
            'sites.services': 'Services',
            'sites.more': 'And more',

            'theme.toggle': 'Toggle theme (currently {cur}, click for {next})',
            'theme.title': 'Toggle theme: auto / light / dark',
            'theme.light': 'light',
            'theme.dark': 'dark',

            'lang.switch': 'Switch to Chinese',
            'lang.title': 'Switch language',
            'lang.code': '中'
        },

        zh: {
            'meta.desc': 'Laurence L. 的个人主页 —— 工程师、Android 爱好者、摄影爱好者。博客、项目与更多。',
            'meta.ogDesc': 'Laurence L. 的个人主页 —— 工程师、Android 爱好者、摄影爱好者。',
            'meta.ogLocale': 'zh_CN',

            'a11y.skip': '跳到主要内容',
            'a11y.toTop': '回到顶部',
            'logo.home': 'LZC.app 首页',
            'nav.primary': '主导航',

            'nav.about': '关于',
            'nav.resume': '简历',
            'nav.friends': '友链',
            'nav.sites': '站点',

            'hero.meta': '广东，中国',
            'hero.intro': '计算机科学、Web、编程…… 域名爱好者',

            'about.title': '我在做什么',
            'svc.dev.title': '软件开发',
            'svc.mobile.title': '移动应用',
            'svc.mobile.text': '自学 Android 开发。',
            'svc.photo.title': '摄影',
            'svc.photo.text1': '有一台宝丽来 Sun 600 LMS。',
            'svc.photo.text2': '想要一台微单相机。',
            'svc.other.title': '其他',
            'svc.other.text1': '自己装机',
            'svc.other.text2': '电影与音乐、书籍、游戏……',

            'resume.title': '简历',
            'resume.edu': '教育经历',
            'resume.experience': '工作经历',
            'resume.downloads': '下载',
            'edu.bnbu': '北师香港浸会大学（北师港浸大）',
            'edu.bnbu.site': '北师港浸大官网',
            'edu.hkbu': '浸会大学',
            'edu.hkbu.site': '浸会大学官网',
            'edu.degree': '计算机科学与技术 理学学士',
            'edu.summerCourse': '暑期课程：You and Your Health',
            'date.summer2012': '2012 年夏',
            'date.summer2018': '2018 年夏',
            'date.2025_2026': '2025.12 — 2026.05',
            'date.2026present': '2026.05 — 至今',
            'date.2023_2025': '2023.08 — 2025.10',
            'date.2016present': '2016 — 至今',
            'co.embodied': '广东省具身智能科技有限公司',
            'co.rising': '广晟控股集团',
            'co.itran': '深圳运捷迅信息系统有限公司',
            'co.ceb': '光大银行',
            'co.cspa': 'UIC计算机专业学会',
            'job.embodied': '技术赋能部 · 助理工程师',
            'job.rising': '具身智能训练场建设运营专班成员 · 技术赋能部 / 标准认证部（借调）',
            'job.itran': '.NET 软件开发工程师',
            'exp.founder': '创始人 / 秘书',
            'exp.tedx': '技术组组长 / 场控',
            'exp.intern': '实习生',
            'exp.cabinet': '秘书',
            'badge.now': '在职',
            'dl.cn': '简历（中文）',
            'dl.en': '英文简历',
            'dl.note': '全部文件均使用我的自签名 X.509 证书进行数字签名。<br>SHA256 指纹：90A5C1D81627FD687A17A4C881882DC317292932A1B1FA0FC14EBD5D3C5ED51D。',

            'friends.title': '友链',
            'friends.love': '我的爱人',
            'friends.friends': '我的朋友们',

            'sites.title': '站点与服务',
            'sites.status': '服务状态',
            'sites.statusOpen': '打开状态页',
            'sites.statusIframe': 'seeleo 服务状态页',
            'sites.domains': '域名',
            'sites.noteSeeleo': '“Seele + O” 或 “See + Leo”',
            'sites.noteOppor': '用于演示 <ins>IDN 同形异义攻击</ins> 的仿冒 OPPO 站点',
            'sites.noteLonglive': '苏联万岁',
            'sites.services': '服务',
            'sites.more': '更多',

            'theme.toggle': '切换主题（当前{cur}，点击转{next}）',
            'theme.title': '切换主题：自动 / 亮色 / 暗色',
            'theme.light': '亮色',
            'theme.dark': '暗色',

            'lang.switch': '切换到英文',
            'lang.title': '切换界面语言',
            'lang.code': 'EN'
        }
    };

    const root = document.documentElement;
    let lang = root.getAttribute('data-lang') === 'zh' ? 'zh' : 'en';

    function rawT(key) {
        return DICT[lang] && DICT[lang][key] !== undefined ? DICT[lang][key] : (DICT.en[key] || '');
    }

    // t('theme.toggle', { cur: '暗色', next: '亮色' })  →  "{cur}" placeholders
    function t(key, vars) {
        let out = rawT(key);
        if (vars) {
            Object.keys(vars).forEach((k) => {
                out = out.split('{' + k + '}').join(vars[k]);
            });
        }
        return out;
    }

    function apply() {
        root.setAttribute('data-lang', lang);
        root.setAttribute('lang', HTML_LANG[lang]);

        document.querySelectorAll('[data-i18n]').forEach((el) => {
            const val = rawT(el.getAttribute('data-i18n'));
            if (val) el.textContent = val;
        });

        document.querySelectorAll('[data-i18n-html]').forEach((el) => {
            const val = rawT(el.getAttribute('data-i18n-html'));
            if (val) el.innerHTML = val;
        });

        document.querySelectorAll('[data-i18n-content]').forEach((el) => {
            const val = rawT(el.getAttribute('data-i18n-content'));
            if (val) el.setAttribute('content', val);
        });

        document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
            el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
                const bits = pair.split(':');
                if (bits.length < 2) return;
                const attr = bits[0].trim();
                const val = rawT(bits.slice(1).join(':').trim());
                if (attr && val) el.setAttribute(attr, val);
            });
        });

        // the toggle always offers the *other* language
        document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
            btn.textContent = t('lang.code');
            btn.setAttribute('aria-label', t('lang.switch'));
            btn.setAttribute('title', t('lang.title'));
            btn.setAttribute('lang', HTML_LANG[lang === 'zh' ? 'en' : 'zh']);
        });

        document.dispatchEvent(new CustomEvent('lzc:langchange', { detail: { lang: lang } }));
    }

    function set(next, { persist = true } = {}) {
        lang = next === 'zh' ? 'zh' : 'en';
        if (persist) {
            try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
        }
        apply();
    }

    document.querySelectorAll('[data-lang-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => set(lang === 'zh' ? 'en' : 'zh'));
    });

    apply();

    // public hook: script.js reads the current language for its own labels
    window.lzcI18n = {
        get lang() { return lang; },
        t: t,
        set: set
    };
})();
