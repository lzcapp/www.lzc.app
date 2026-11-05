#!/usr/bin/env python3
"""按站点实际用到的图标，重新子集化 Font Awesome 字体。

为什么要有这个脚本
------------------
图标字体原本是手跑 pyftsubset 出来的，命令没留在仓库里：加一枚图标就要重新
回忆一长串 unicode 列表，而且**加错了不会报错**——缺字形只会渲染成一个空白方块，
肉眼很容易漏掉。本脚本把「站点用哪些图标」变成一份显式清单 MANIFEST，并在
四端之间互相对账：

    MANIFEST  ←→  assets/fontawesome/fa-subset.css 的 .fa-*:before 规则
    MANIFEST  ←→  index.html 里实际用到的 fa-light / fa-solid / fa-brands
    MANIFEST  ←→  三个 woff2 的 cmap（--check 时逐码点核对）

任何一处对不上都直接报错退出，而不是悄悄生成一个缺字形的字体。

用法
----
    python3 tools/build-icons.py                 # 重新生成三个 woff2
    python3 tools/build-icons.py --check         # 只校验，不写文件
    python3 tools/build-icons.py --src <dir>     # 指定 FA 源字体目录

加图标的标准动作：MANIFEST 加一行 → fa-subset.css 加一条 :before →
index.html 加 <i class="fa-light fa-xxx"> → 跑本脚本 → 跑 tools/build-css.py。

源字体
------
Font Awesome Pro 是商业字体，二进制不进仓库。脚本按 --src > 环境变量
LZC_FA_SRC > 本机 static.lzc.app 仓库副本 的顺序找，需要 fa-light-300.ttf /
fa-solid-900.ttf / fa-brands-400.ttf。

依赖：fonttools（含 brotli，用于输出 woff2）。
"""

from __future__ import annotations

import argparse
import os
import pathlib
import re
import subprocess
import sys

try:
    from fontTools.ttLib import TTFont
except ImportError:  # pragma: no cover
    sys.exit("缺少 fonttools：pip install fonttools brotli")

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEBFONTS = ROOT / "assets" / "fontawesome" / "webfonts"
CSS = ROOT / "assets" / "fontawesome" / "fa-subset.css"
INDEX = ROOT / "index.html"
STYLE = ROOT / "assets" / "css" / "style.css"

# 图标清单：名字 → (字重, 码点)。名字必须与 fa-subset.css 里的 .fa-<name> 一致。
MANIFEST: dict[str, tuple[str, str]] = {
    "adjust": ("light", "f042"),
    "arrow-up": ("light", "f062"),
    "award": ("light", "f559"),
    "books": ("light", "f5db"),
    "briefcase": ("light", "f0b1"),
    "calendar-xmark": ("light", "f273"),
    "camera": ("light", "f030"),
    "clock": ("light", "f017"),
    "code": ("light", "f121"),
    "code-branch": ("light", "f126"),
    "download": ("light", "f019"),
    "earth-asia": ("light", "f57e"),
    "envelope": ("light", "f0e0"),
    "file-pdf": ("light", "f1c1"),
    "gear": ("light", "f013"),
    "heart": ("light", "f004"),
    "key": ("light", "f084"),
    "lock": ("light", "f023"),
    "location-dot": ("light", "f3c5"),
    "mobile-screen": ("light", "f3cf"),
    "mug-hot": ("light", "f7b6"),
    "shield-check": ("light", "f2f7"),
    "user-group": ("light", "f500"),
    "warehouse": ("light", "f494"),
    "ellipsis": ("solid", "f141"),
    "up-right-from-square": ("solid", "f35d"),
    "moon": ("solid", "f186"),
    "sun": ("solid", "f185"),
    "github": ("brands", "f09b"),
}

# 只在 CSS 里出现、HTML 搜不到的图标：主题按钮靠 --theme-icon 变量切日/月。
CSS_ONLY = {"moon", "sun"}

# 字重 → (源字体, 产物)
FONTS = {
    "light": ("fa-light-300.ttf", "fa-light-subset.woff2"),
    "solid": ("fa-solid-900.ttf", "fa-solid-subset.woff2"),
    "brands": ("fa-brands-400.ttf", "fa-brands-subset.woff2"),
}

DEFAULT_SRC = pathlib.Path.home() / "Coding" / "static_lzc_app" / "fontawesome" / "webfonts"

NAME_LABEL = {"light": "light", "solid": "solid", "brands": "brands"}

HEADER_RE = re.compile(r"^/\*! Font Awesome 6 Pro — lzc\.app subset:.*?\*/", re.M)
USED_RE = re.compile(r"fa-(light|solid|brands)\s+fa-([a-z0-9-]+)")
CSS_RULE_RE = re.compile(r'\.fa-([a-z0-9-]+):before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"')
STYLE_ESCAPE_RE = re.compile(r"\\([0-9a-fA-F]{4})")


def source_dir(cli_arg: str | None) -> pathlib.Path:
    candidates = [
        pathlib.Path(cli_arg) if cli_arg else None,
        pathlib.Path(os.environ["LZC_FA_SRC"]) if os.environ.get("LZC_FA_SRC") else None,
        DEFAULT_SRC,
    ]
    for cand in candidates:
        if cand and (cand / "fa-light-300.ttf").is_file():
            return cand
    sys.exit(
        "找不到 Font Awesome 源字体目录（里面应有 fa-light-300.ttf 等 *.ttf）。\n"
        "用 --src 指定，或设环境变量 LZC_FA_SRC。FA Pro 是商业字体，不进仓库。"
    )


def used_icons() -> dict[str, set[str]]:
    """index.html 里每个图标用了哪个字重。"""
    html = INDEX.read_text(encoding="utf-8")
    out: dict[str, set[str]] = {}
    for weight, name in USED_RE.findall(html):
        out.setdefault(weight, set()).add(name)
    return out


def css_rules() -> dict[str, str]:
    """fa-subset.css 里已声明的 .fa-*:before → 码点。"""
    text = CSS.read_text(encoding="utf-8")
    return {name: cp.lower() for name, cp in CSS_RULE_RE.findall(text)}


def validate() -> list[str]:
    """清单 ↔ CSS ↔ HTML 三方对账。"""
    problems: list[str] = []
    rules = css_rules()
    used = used_icons()

    for name in sorted(set(MANIFEST) - set(rules)):
        problems.append(f"fa-subset.css 缺 .fa-{name}:before 规则")
    for name in sorted(set(rules) - set(MANIFEST)):
        problems.append(f"fa-subset.css 里的 .fa-{name} 不在 MANIFEST，重新生成会丢字形")
    for name, (_, cp) in MANIFEST.items():
        if name in rules and rules[name] != cp:
            problems.append(f".fa-{name} 码点不一致：MANIFEST={cp} CSS={rules[name]}")

    for weight, names in sorted(used.items()):
        if weight not in FONTS:
            problems.append(f"index.html 用了未知字重 fa-{weight}")
        for name in sorted(names):
            if name not in MANIFEST:
                problems.append(f"index.html 用了 fa-{name}，MANIFEST 里没有")
            elif MANIFEST[name][0] != weight:
                problems.append(
                    f"fa-{name} 在 HTML 里是 {weight}，MANIFEST 写的是 {MANIFEST[name][0]}"
                )

    html_names = {name for names in used.values() for name in names}
    for name in MANIFEST:
        if name not in html_names and name not in CSS_ONLY:
            problems.append(
                f"MANIFEST 里的 fa-{name} 没被 index.html 用到"
                "（若由 CSS 驱动，请加入 CSS_ONLY）"
            )

    style_cps = {cp.lower() for cp in STYLE_ESCAPE_RE.findall(STYLE.read_text(encoding="utf-8"))}
    for name in sorted(CSS_ONLY):
        if name not in MANIFEST:
            problems.append(f"CSS_ONLY 里的 fa-{name} 不在 MANIFEST")
        elif MANIFEST[name][1] not in style_cps:
            problems.append(
                f"fa-{name} 标了 css_only，但 style.css 里找不到 \\{MANIFEST[name][1]}"
            )

    return problems


def check_fonts() -> list[str]:
    """产物 woff2 的 cmap 与清单逐码点核对。"""
    problems: list[str] = []
    for weight, (_, out_name) in FONTS.items():
        want = {cp for _, (w, cp) in MANIFEST.items() if w == weight}
        path = WEBFONTS / out_name
        if not path.is_file():
            problems.append(f"缺少产物 {out_name}")
            continue
        font = TTFont(path, lazy=True)
        have = {format(code, "04x") for code in font.getBestCmap()}
        font.close()
        missing = sorted(want - have)
        extra = sorted(have - want)
        if missing:
            problems.append(f"{out_name} 缺字形：{', '.join(missing)}")
        if extra:
            problems.append(f"{out_name} 有多余字形（清单已瘦身，重跑生成）：{', '.join(extra)}")
    return problems


def build(src: pathlib.Path) -> None:
    groups: dict[str, list[str]] = {}
    for weight, cp in MANIFEST.values():
        groups.setdefault(weight, []).append(cp)

    WEBFONTS.mkdir(parents=True, exist_ok=True)
    for weight in sorted(groups):
        src_name, out_name = FONTS[weight]
        src_path = src / src_name
        if not src_path.is_file():
            sys.exit(f"缺少源字体 {src_path}")
        out = WEBFONTS / out_name
        subprocess.run(
            [
                "pyftsubset", str(src_path),
                "--unicodes=" + ",".join(sorted(groups[weight])),
                "--flavor=woff2",
                "--no-hinting",
                "--desubroutinize",
                "--layout-features=",
                f"--output-file={out}",
            ],
            check=True,
        )
        print(f"  {out_name:<26} {len(groups[weight]):2d} 图标  {out.stat().st_size / 1024:5.1f} KB")


def sync_header() -> bool:
    """把 CSS 头部那行计数改成与清单一致，避免注释随清单漂移。"""
    counts: dict[str, int] = {}
    for weight, _ in MANIFEST.values():
        counts[weight] = counts.get(weight, 0) + 1
    parts = []
    for weight in ("light", "solid", "brands"):
        n = counts.get(weight, 0)
        if not n:
            continue
        # 只有 brands 需要单复数（1 brand / 2 brands），light/solid 本身就是单数形式
        label = NAME_LABEL[weight] if weight != "brands" else ("brand" if n == 1 else "brands")
        parts.append(f"{n} {label}")
    line = "/*! Font Awesome 6 Pro — lzc.app subset: " + " + ".join(parts) + " icons */"

    text = CSS.read_text(encoding="utf-8")
    if not HEADER_RE.search(text):
        print("! fa-subset.css 头部没有可识别的计数注释，跳过同步")
        return False
    new_text = HEADER_RE.sub(lambda _: line, text, count=1)
    if new_text == text:
        return False
    CSS.write_text(new_text, encoding="utf-8")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="按站点实际用到的图标子集化 Font Awesome")
    parser.add_argument("--check", action="store_true", help="只校验清单 / HTML / CSS / 字体是否一致")
    parser.add_argument("--src", help="Font Awesome 源字体目录（含 fa-light-300.ttf 等）")
    args = parser.parse_args()

    problems = validate()
    if problems:
        print("图标清单与源文件不一致：")
        for p in problems:
            print("  -", p)
        return 1

    if args.check:
        problems = check_fonts()
        if problems:
            print("字体产物与清单不一致：")
            for p in problems:
                print("  -", p)
            print("\n跑一次： python3 tools/build-icons.py")
            return 1
        print(f"OK  {len(MANIFEST)} 个图标，三个 woff2 与清单逐码点一致")
        return 0

    src = source_dir(args.src)
    print(f"源字体：{src}")
    build(src)

    problems = check_fonts()
    if problems:
        print("生成后复核失败：")
        for p in problems:
            print("  -", p)
        return 1

    if sync_header():
        print("fa-subset.css 头部计数已更新 —— 记得接着跑 python3 tools/build-css.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
