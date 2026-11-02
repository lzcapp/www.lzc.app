#!/usr/bin/env python3
"""按站点实际用字，把 Noto 可变字重字体子集化成 woff2，自托管到 assets/fonts/。

为什么要这么做
--------------
原来 index.html 用一条 <link> 从 fonts.googlefonts.cn 拉 4 个字族 11 个字重，
镜像返回约 188 KB CSS + 20 多个 unicode-range 分片（合计约 1 MB），
且字体二进制在另一个域名字体域名上，每次都要重建连接（实测 TLS 就 0.8 s）。

本脚本把四个字族的**可变字重**字体按站点实际出现的字符子集化：
一个文件覆盖 100–900 全部字重，四个文件合计约 130 KB，全部同源、可被 SW 缓存。

用法
----
    python3 tools/subset-fonts.py            # 生成 assets/fonts/*.woff2
    python3 tools/subset-fonts.py --check     # 只校验现有产物是否覆盖当前文案

文案改动后（尤其新增中文）请重跑一次；漏字会静默回退到系统字体，
表现为个别字字形不一致 —— 所以 --check 会打印缺失字符。

依赖：fonttools（含 brotli 以输出 woff2）、curl
"""

from __future__ import annotations

import argparse
import glob
import pathlib
import re
import subprocess
import sys
import urllib.parse

try:
    from fontTools.ttLib import TTFont
except ImportError:  # pragma: no cover
    sys.exit("缺少 fonttools：pip install fonttools brotli")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "fonts"
CACHE_DIR = pathlib.Path.home() / ".cache" / "lzcapp-fonts"

# 文案来源：只取真正会被渲染的文本，不取 CSS 注释（注释里的汉字不该占字形）
TEXT_SOURCES = ["index.html", "assets/js/*.js"]

# 文案之外再保一批标点/符号，避免 CSS content、分隔符等零星用字缺字形
EXTRA_CHARS = (
    "—–·…“”‘’「」『』《》〈〉、。，；：！？（）【】〔〕～￥°×÷±§¶•→←↑↓↔✓★☆"
    "0123456789"
)

FAMILIES = [
    {
        "name": "Noto Sans SC",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf",
        "out": "noto-sans-sc-var.woff2",
        "cjk": True,
    },
    {
        "name": "Noto Serif SC",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf",
        "out": "noto-serif-sc-var.woff2",
        "cjk": True,
    },
    {
        "name": "Noto Sans Display",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdisplay/NotoSansDisplay%5Bwdth%2Cwght%5D.ttf",
        "out": "noto-sans-display-var.woff2",
        # 站点不用字宽变化，把 wdth 钉死在 100 再子集化，文件小一半
        "pin": {"wdth": 100},
    },
    {
        "name": "Noto Sans Mono",
        "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansmono/NotoSansMono%5Bwdth%2Cwght%5D.ttf",
        "out": "noto-sans-mono-var.woff2",
        "pin": {"wdth": 100},
    },
]


def collect_chars(with_extra: bool = True) -> str:
    """收集站点可能渲染的所有字符。

    刻意**不过滤 HTML 标签和属性**：alt / title / aria-label 里的汉字在悬停、
    读屏、图片加载失败时都会真实渲染，漏掉就会缺字。标签本身只贡献 ASCII
    （字母数字本来就在字符集里），代价近乎为零。

    但注释必须剔除：注释里的汉字永远不渲染，留着会让 --check 报假警，
    逼着每次改注释都重建字体。
    """
    buf = []
    for pattern in TEXT_SOURCES:
        for rel in sorted(glob.glob(str(ROOT / pattern))):
            text = pathlib.Path(rel).read_text(encoding="utf-8")
            if rel.endswith((".html", ".htm")):
                text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
            elif rel.endswith(".js"):
                # 只去块注释；行注释里可能出现 URL 等字符串，误删会丢字形
                text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
            buf.append(text)
    chars = set("".join(buf))
    if with_extra:
        chars |= set(EXTRA_CHARS)
    chars.discard("\n")
    chars.discard("\r")
    chars.discard("\t")
    return "".join(sorted(chars))


def fetch(url: str, dest: pathlib.Path) -> pathlib.Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"  使用缓存 {dest.name} ({dest.stat().st_size / 1048576:.1f} MB)")
        return dest
    print(f"  下载 {dest.name} …")
    # -C - 断点续传：GitHub raw 偶发中断时重跑不会从头再来
    subprocess.run(
        ["curl", "-sSL", "-C", "-", "--retry", "3", "--retry-delay", "2",
         "--max-time", "600", "-o", str(dest), url],
        check=True,
    )
    # raw.githubusercontent.com 对不存在的路径返回 "404: Not Found" 文本（HTTP 200），
    # 直接拿去 subset 会得到一句 pyftsubset 的报错，所以在源头卡一下体积
    if dest.stat().st_size < 1_000_000:
        raise SystemExit(
            f"下载失败：{dest.name} 只有 {dest.stat().st_size} 字节，"
            f"通常说明仓库路径变了：{url}"
        )
    return dest


def pin_axes(src: pathlib.Path, pins: dict[str, float]) -> pathlib.Path:
    """把可变轴钉成固定值（保留其余轴），结果缓存在同一目录。"""
    tag = "-".join(f"{k}{v:g}" for k, v in pins.items())
    dest = src.with_name(f"{src.stem}.pin-{tag}.ttf")
    if not dest.exists():
        print(f"  钉死可变轴 {tag} …")
        subprocess.run(
            ["fonttools", "varLib.instancer", str(src)]
            + [f"{k}={v:g}" for k, v in pins.items()]
            + ["-o", str(dest)],
            check=True,
        )
    return dest


def subset(src: pathlib.Path, out: pathlib.Path, chars_file: pathlib.Path) -> None:
    subprocess.run(
        [
            "pyftsubset", str(src),
            f"--text-file={chars_file}",
            "--flavor=woff2",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
            f"--output-file={out}",
        ],
        check=True,
    )


def axes_of(path: pathlib.Path) -> str:
    f = TTFont(path, lazy=True)
    if "fvar" not in f:
        return "静态字体"
    spans = [f"{a.axisTag} {a.minValue:g}–{a.maxValue:g}" for a in f["fvar"].axes]
    f.close()
    return ", ".join(spans)


def _is_cjk(c: str) -> bool:
    """汉字/假名 + CJK 标点 + 全角形式：拉丁字族本来就没有这些字形，靠 SC 兜底。"""
    o = ord(c)
    return (
        0x2E80 <= o <= 0x9FFF
        or 0x3000 <= o <= 0x303F
        or 0xFF00 <= o <= 0xFFEF
        or 0x20000 <= o <= 0x2FA1F
    )


def coverage(font_path: pathlib.Path, chars: str, cjk_family: bool,
             fallback: frozenset[int] = frozenset()) -> str:
    """校验字形覆盖。

    拉丁字族缺汉字是设计使然（CSS 栈里 'Noto Sans SC' 兜底），所以判定标准是
    「这个字最终能不能渲染出来」—— 本字体没有、但兜底字体有，就算覆盖。
    """
    f = TTFont(font_path, lazy=True)
    cmap = f.getBestCmap()
    f.close()
    pool = chars if cjk_family else "".join(c for c in chars if not _is_cjk(c))
    missing = [c for c in pool if ord(c) not in cmap and ord(c) not in fallback]
    if not missing:
        if cjk_family:
            return "全覆盖"
        via = sum(1 for c in pool if ord(c) not in cmap)
        return f"拉丁全覆盖（{via} 字回退 SC）" if via else "拉丁全覆盖"
    head = "".join(missing[:24])
    more = "" if len(missing) <= 24 else f" …(+{len(missing) - 24})"
    return f"缺 {len(missing)} 字：{head}{more}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只校验现有 woff2 的字符覆盖")
    args = ap.parse_args()

    chars = collect_chars()
    # 校验只看真实文案：EXTRA_CHARS 是预防性补的字，不该在覆盖率里算缺失
    check_chars = collect_chars(with_extra=False)
    cjk = sum(1 for c in chars if "\u4e00" <= c <= "\u9fff")
    print(f"字符集：{len(chars)} 个去重字符（其中汉字 {cjk} 个）")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chars_file = CACHE_DIR / "chars.txt"
    chars_file.parent.mkdir(parents=True, exist_ok=True)
    chars_file.write_text(chars, encoding="utf-8")

    total = 0
    failed = 0
    # 兜底字体（Sans SC）的字形覆盖表：拉丁字族缺的字若它能出，就不算缺
    cjk_out = OUT_DIR / next(f["out"] for f in FAMILIES if f.get("cjk"))
    fallback_cmap: frozenset[int] = frozenset()
    if cjk_out.exists():
        _f = TTFont(cjk_out, lazy=True)
        fallback_cmap = frozenset(_f.getBestCmap())
        _f.close()

    for fam in FAMILIES:
        out = OUT_DIR / fam["out"]
        if args.check:
            if not out.exists():
                print(f"✗ {fam['name']}: 产物缺失 {out.relative_to(ROOT)}")
                failed += 1
                continue
        else:
            src = fetch(fam["url"], CACHE_DIR / urllib.parse.unquote(fam["url"].rsplit("/", 1)[-1]))
            if fam.get("pin"):
                src = pin_axes(src, fam["pin"])
            subset(src, out, chars_file)

        size = out.stat().st_size
        total += size
        cov = coverage(out, check_chars, fam.get("cjk", False),
                       frozenset() if fam.get("cjk") else fallback_cmap)
        if cov.startswith("缺"):
            failed += 1
        print(f"  {fam['name']:<18} {size / 1024:6.1f} KB  [{axes_of(out)}]  {cov}")

    print(f"合计 {total / 1024:.1f} KB，输出目录 {OUT_DIR.relative_to(ROOT)}/")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
