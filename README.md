# www.lzc.app
 
![GitHub last commit](https://img.shields.io/github/last-commit/lzcapp/www.lzc.app?style=for-the-badge) &ensp; ![GitHub deployments](https://img.shields.io/github/deployments/lzcapp/www.lzc.app/github-pages?style=for-the-badge)

![Website](https://img.shields.io/website?url=https%3A%2F%2Fwww.lzc.app%2F&style=for-the-badge&label=www.lzc.app) &ensp; ![Website](https://img.shields.io/website?url=https%3A%2F%2Fseeleo.com%2F&style=for-the-badge&label=seeleo.com) &ensp; ![Website](https://img.shields.io/website?url=https%3A%2F%2Fseeleo.cn%2F&style=for-the-badge&label=seeleo.cn)

![](https://github.com/lzcapp/www.lzc.app/assets/12462465/82859009-2620-4e45-a8bf-518fd7cfe427)

## 维护

纯静态站，没有打包器和依赖，只有三个构建脚本（前两个只用标准库，图标子集那个需要
fonttools）。**改源文件后要重跑对应脚本再提交**，否则线上还是旧产物。

### 改文案之后

```bash
python3 tools/subset-fonts.py          # 重新子集化四个 Noto 可变字重字体
python3 tools/subset-fonts.py --check  # 校验现有字体是否覆盖当前用字
```

漏字不会报错，只会静默回退到系统字体（个别字形对不上），所以 `--check` 值得跑。

字体文件一变，`app.min.css` 里引用它的 `?v=<内容哈希>` 就跟着变——**所以重跑字体之后
必须接着跑一次 `tools/build-css.py`**，否则 CSS 还指着旧哈希，浏览器会重新下载旧字体。

### 改图标之后

```bash
python3 tools/build-icons.py          # 按 MANIFEST 重新子集化三个 woff2
python3 tools/build-icons.py --check  # 校验清单 / fa-subset.css / index.html / 字体 cmap
```

图标清单在 `tools/build-icons.py` 的 `MANIFEST` 里（名字 → 字重 + 码点）。加一枚图标：
`MANIFEST` 加一行 → `assets/fontawesome/fa-subset.css` 加一条 `.fa-xxx:before` →
`index.html` 用上 → 跑脚本 → 再跑 `tools/build-css.py`。少任何一步都会报错而不是
静默生成缺字形的字体（缺字形在页面上只表现为一个空白方块）。

`moon` / `sun` 只在 CSS 里出现（`--theme-icon` 变量按主题切换），已在脚本的 `CSS_ONLY`
里标注，不算“没人用”。

FA Pro 是商业字体、二进制不进仓库。脚本按 `--src` > 环境变量 `LZC_FA_SRC` > 本机
`~/Coding/static_lzc_app/fontawesome/webfonts` 的顺序找 `fa-light-300.ttf` 等源文件。

### 改样式之后

```bash
python3 tools/build-css.py          # 合并压缩成 assets/css/app.min.css，并同步 index.html
python3 tools/build-css.py --check  # 校验产物与源文件是否同步
```

`assets/css/fonts.css`、`assets/css/style.css`、`assets/fontawesome/fa-subset.css` 是**源文件**，
线上只加载合并后的 `assets/css/app.min.css`（一次请求而不是三次渲染阻塞请求）。
脚本顺带做两件事：把 `url(...)` 里的相对路径改成相对 `assets/css/`，并给每个字体
挂上 `?v=<内容哈希>` —— 内容变则 URL 变，所以 `assets/` 可以安全地按永久缓存下发。
`index.html` 里的字体预加载区块和 CSS 版本号也由它重写，别手改。

### 改 JS 之后

`assets/js/*.js` 在 `index.html` 里带 `?v=` 版本号，而 `sw.js` 对带 `?v=` 的资源是
**cache-first 永不回源**。所以改了脚本必须同时做两件事，否则老访客会一直跑旧代码：

1. `index.html` 里把对应的 `?v=` 加一；
2. `sw.js` 里的 `VERSION` 加一（顺带清掉旧缓存），`CORE_ASSETS` 同步改。

### 建议的 Cloudflare 缓存规则

GitHub Pages 给静态资源的 `Cache-Control` 只有 10 分钟，字体回来一趟就要重下。
域名在 Cloudflare 后面，可以加一条 Cache Rule 补上（仓库里改不了，得在面板点）：

- 匹配：`URI Path starts with /assets/`
- `Browser Cache TTL`：**1 年**
- `Edge Cache TTL`：**1 个月**

敢设 1 年的前提是上面那套内容哈希：字体和 CSS 的 URL 已经跟着内容变，不会拿到旧版本。
`html` 和 `sw.js` 不要纳入这条规则。

