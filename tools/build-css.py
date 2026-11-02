#!/usr/bin/env python3
"""把三个 CSS 源文件合并 + 压缩成 assets/css/app.min.css，并同步 index.html 的引用。

为什么这么做
------------
原来 index.html 依次加载 fonts.css / style.css / fa-subset.css，三个都是渲染阻塞
请求，加起来约 24 KB（gzip 后约 9 KB），浏览器要等三份都到齐才能画第一帧。
合并成一份 + 去注释压空白，首屏少两个往返，样式体积也小一截。

同时把 CSS 里 url(...) 指向的字体路径改写成相对 assets/css/ 的位置（fa-subset
原来写在 assets/fontawesome/ 下，用的 ./webfonts/ 会失效），并给每个字体加上
?v=<内容哈希> —— 内容变则 URL 变，这样 assets/ 才能安全地按“永久缓存”下发。

源文件仍然是 assets/css/*.css 和 assets/fontawesome/*.css（注释、缩进都在），
改完样式跑一次本脚本即可；index.html 里只有一个 <link> 指向产物。

用法
----
    python3 tools/build-css.py            # 生成产物并同步 index.html
    python3 tools/build-css.py --check     # 只校验产物与源文件是否同步

改了样式忘了重跑是本脚本最容易踩的坑，所以 --check 会对比产物内容与
index.html 里的哈希，不一致就以非 0 退出，适合放在上线前跑一次。

依赖：仅标准库。
"""

from __future__ import annotations

import argparse
import hashlib
import os
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CSS_OUT = ROOT / "assets" / "css" / "app.min.css"
CSS_REL_TO_ROOT = pathlib.Path("assets") / "css"
INDEX = ROOT / "index.html"

# 合并顺序必须与原来的 <link> 顺序一致：字体声明 → 主样式 → 图标样式
SOURCES = [
    ROOT / "assets" / "css" / "fonts.css",
    ROOT / "assets" / "css" / "style.css",
    ROOT / "assets" / "fontawesome" / "fa-subset.css",
]

# 首屏就要用的字体：正文 + 两个字重的图标字体。
# 衬线标题 / 等宽 / 展示体由 CSS 自行发现即可，不抢关键路径。
PRELOAD_FONTS = [
    ROOT / "assets" / "fonts" / "noto-sans-sc-var.woff2",
    ROOT / "assets" / "fontawesome" / "webfonts" / "fa-solid-subset.woff2",
    ROOT / "assets" / "fontawesome" / "webfonts" / "fa-light-subset.woff2",
]

BANNER = "/*! lzc.app styles — tools/build-css.py 生成，请改 assets/css 下的源文件 */\n"

URL_RE = re.compile(r"url\(([^)]*)\)")
STRING_RE = re.compile(r'"(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'')
PRELOAD_BLOCK_RE = re.compile(r"(<!-- preloads:start -->)(.*?)(<!-- preloads:end -->)", re.S)
CSS_LINK_RE = re.compile(r'(href="\./assets/css/app\.min\.css)\?v=[^"]*(")')


def short_hash(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()[:8]


def rewrite_urls(css: str, src: pathlib.Path) -> str:
    """把 url(...) 解析成真实文件，再写成相对 assets/css/ 的路径 + 内容哈希。"""

    def repl(match: re.Match) -> str:
        raw = match.group(1).strip()
        if len(raw) >= 2 and raw[0] in "\"'" and raw[-1] == raw[0]:
            raw = raw[1:-1]
        if raw.startswith(("data:", "http:", "https:", "//")):
            return match.group(0)  # 外链 / 内联数据不动

        base = raw.split("?", 1)[0].split("#", 1)[0]
        target = (src.parent / base).resolve()
        if not target.is_file():
            sys.exit(f"{src.name}: url({raw}) 指向的文件不存在 -> {target}")

        rel = os.path.relpath(target, CSS_REL_TO_ROOT).replace(os.sep, "/")
        return f'url("{rel}?v={short_hash(target.read_bytes())}")'

    return URL_RE.sub(repl, css)


def minify(css: str) -> str:
    """保守压缩：只做不会改变语义的动作。

    引号里的内容先抽出来占位，避免空格被压掉（content: " " 这种会变形）；
    ':' 只压后面的空格，前面的空格是后代选择器（.a :hover），不能碰。
    """
    stash: list[str] = []

    def keep(match: re.Match) -> str:
        stash.append(match.group(0))
        return f"\x00{len(stash) - 1}\x00"

    css = STRING_RE.sub(keep, css)
    css = re.sub(r"/\*(?!!).*?\*/", "", css, flags=re.S)  # 去注释，保留 /*! 版权行
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};>])\s*", r"\1", css)
    css = re.sub(r"\s*,\s*", ",", css)
    css = re.sub(r":\s+", ":", css)
    css = css.replace(";}", "}")
    css = css.strip()

    return re.sub(r"\x00(\d+)\x00", lambda m: stash[int(m.group(1))], css)


def build() -> tuple[str, str]:
    """返回 (app.min.css 内容, 它的哈希)。"""
    parts = []
    for src in SOURCES:
        if not src.is_file():
            sys.exit(f"缺少源文件：{src}")
        parts.append(minify(rewrite_urls(src.read_text(encoding="utf-8"), src)))
    body = "\n".join(parts) + "\n"
    out = BANNER + body
    return out, short_hash(out.encode("utf-8"))


def preload_block() -> str:
    lines = []
    for font in PRELOAD_FONTS:
        rel = os.path.relpath(font, ROOT).replace(os.sep, "/")
        lines.append(
            f'    <link rel="preload" href="./{rel}?v={short_hash(font.read_bytes())}"'
            ' as="font" type="font/woff2" crossorigin>'
        )
    return "\n".join(lines)


def expected_index(html: str, css_version: str) -> str:
    html, n_block = PRELOAD_BLOCK_RE.subn(
        lambda m: f"{m.group(1)}\n{preload_block()}\n    {m.group(3)}", html, count=1
    )
    if n_block != 1:
        sys.exit("index.html 里找不到 <!-- preloads:start --> 标记块")
    html, n_link = CSS_LINK_RE.subn(rf"\1?v={css_version}\2", html, count=1)
    if n_link != 1:
        sys.exit("index.html 里找不到 app.min.css 的 <link>")
    return html


def main() -> int:
    parser = argparse.ArgumentParser(description="合并压缩 CSS 并同步 index.html")
    parser.add_argument("--check", action="store_true", help="只校验，不写文件")
    args = parser.parse_args()

    css, version = build()
    html = INDEX.read_text(encoding="utf-8")
    want_html = expected_index(html, version)

    if args.check:
        problems = []
        if not CSS_OUT.is_file():
            problems.append(f"{CSS_OUT.relative_to(ROOT)} 不存在")
        elif CSS_OUT.read_text(encoding="utf-8") != css:
            problems.append(f"{CSS_OUT.relative_to(ROOT)} 与源文件不同步")
        if want_html != html:
            problems.append("index.html 的字体预加载 / CSS 版本号与产物不同步")
        if problems:
            print("样式产物已过期：")
            for p in problems:
                print("  -", p)
            print("\n跑一次： python3 tools/build-css.py")
            return 1
        print(f"OK  app.min.css {len(css.encode('utf-8'))} B  v={version}")
        return 0

    tmp = CSS_OUT.with_suffix(".min.css.tmp")
    tmp.write_text(css, encoding="utf-8")
    os.replace(tmp, CSS_OUT)  # 先写临时文件再替换，避免中途失败留下半个文件
    INDEX.write_text(want_html, encoding="utf-8")

    saved = sum(s.stat().st_size for s in SOURCES)
    print(f"app.min.css  {saved} B -> {len(css.encode('utf-8'))} B   v={version}")
    for src in SOURCES:
        print(f"  + {src.relative_to(ROOT)}")
    print("index.html 已同步：CSS 版本号 + 字体预加载")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
