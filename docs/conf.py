from __future__ import annotations

import sys
import tomllib
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
# The Pygments styles live beside this file.
sys.path.insert(0, str(Path(__file__).resolve().parent))

# ---------------------------------------------------------------------------
# Project metadata
# ---------------------------------------------------------------------------
project = "Planum"
author = "Joshua Duquette"
copyright = "2026, Joshua Duquette"
# The Python package's version, so the site cannot name another one. The
# viewer's web/package.json is private and versioned separately, and is not used.
with (PROJECT_ROOT / "pyproject.toml").open("rb") as handle:
    version = release = tomllib.load(handle)["project"]["version"]

# ---------------------------------------------------------------------------
# Extensions
# ---------------------------------------------------------------------------
extensions = [
    "sphinx.ext.mathjax",
    "myst_parser",
    "sphinx_copybutton",
    "sphinx_sitemap",
    "sphinxext.opengraph",
]

# MathJax is served from _static/mathjax, not from a CDN, so the pages make no third-party request.
# It is MathJax 4.1.3 (npm `mathjax`) and its New Computer Modern font (npm
# `@mathjax/mathjax-newcm-font` 4.1.3), both Apache-2.0 (_static/mathjax/LICENSE), cut to what
# the pages can load: tex-mml-chtml.js, the TeX packages it autoloads (input/tex/extensions), the
# two accessibility parts its menu loads (a11y), the speech worker with English speech and Nemeth
# braille (sre), and the font's CHTML files. The menu's SVG renderer and other speech languages
# are not served. MathJax 4 looks for its fonts on cdn.jsdelivr.net even when self-hosted, hence
# the fonts path.
mathjax_path = "mathjax/tex-mml-chtml.js"
mathjax4_config = {"loader": {"paths": {"fonts": "[mathjax]/fonts"}}}

# ---------------------------------------------------------------------------
# Source / build
# ---------------------------------------------------------------------------
source_suffix = {".md": "markdown"}
exclude_patterns = [
    "_build",
    "superpowers",
    # Local working notes, not part of the site.
    "reference/circuit-additions-2026-10-30.md",
    "reference/circuit-classification-audit-2026-10-30.md",
    "Thumbs.db",
    ".DS_Store",
]

# ---------------------------------------------------------------------------
# MyST (Markdown support)
# ---------------------------------------------------------------------------
myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "dollarmath",
    "amsmath",
    "substitution",
]
myst_heading_anchors = 4
myst_substitutions = {"release": release}

# ---------------------------------------------------------------------------
# Link check
# ---------------------------------------------------------------------------
# A legend links the view it shows. The viewer keeps that view after the "#" of its address, so the
# fragment is state to restore, not an anchor to find in the page.
linkcheck_anchors_ignore_for_url = [r"https://planumatlas\.com/"]

# ---------------------------------------------------------------------------
# HTML output: furo, coloured from the viewer's own tokens (web/src/styles/tokens.css)
# ---------------------------------------------------------------------------
html_theme = "furo"
html_title = "Planum"
html_baseurl = "https://planumatlas.com/docs/"
# The pages are neither versioned nor translated, so each sitemap entry is html_baseurl plus the page.
sitemap_url_scheme = "{link}"
sitemap_excludes = ["search.html", "genindex.html"]
# Each page's description and share preview, from its opening paragraph (sphinxext-opengraph).
ogp_site_url = html_baseurl
ogp_site_name = "Planum"
ogp_image = "https://planumatlas.com/preview.png"
ogp_description_length = 160
ogp_social_cards = {"enable": False}
html_static_path = ["_static"]
html_css_files = ["custom.css"]
html_js_files = ["docs.js"]
html_permalinks_icon = "#"
html_show_sphinx = False
html_copy_source = False
html_favicon = "_static/favicon.svg"
templates_path = ["_templates"]
html_sidebars = {
    "**": [
        "sidebar/search.html",
        "sidebar/scroll-start.html",
        "sidebar/overview.html",
        "sidebar/navigation.html",
        "sidebar/scroll-end.html",
    ],
}
highlight_language = "none"
pygments_style = "planum_style.Light"
pygments_dark_style = "planum_style.Dark"
copybutton_prompt_text = r"\$ |>>> |\.\.\. "
copybutton_prompt_is_regexp = True
copybutton_line_continuation_character = "\\"

html_theme_options = {
    # Light: --surface-base, --surface-navigation, --text-primary, --accent, ...
    "light_css_variables": {
        "color-background-primary": "#ffffff",
        "color-background-secondary": "#f7f8f9",
        "color-background-hover": "#f1f4f4",
        "color-background-border": "#e0e5e7",
        "color-foreground-primary": "#232a30",
        "color-foreground-secondary": "#555f68",
        "color-foreground-muted": "#606a72",
        "color-foreground-border": "#77828c",
        "color-brand-primary": "#28615d",
        "color-brand-content": "#28615d",
        "color-brand-visited": "#1d4d49",
        "color-highlight-on-target": "#edf3f1",
        "color-highlighted-background": "#edf3f1",
        "color-admonition-background": "#f7f8f9",
        "color-api-name": "#28615d",
        "color-api-pre-name": "#606a72",
        "color-api-background": "#f7f8f9",
        "color-api-background-hover": "#f1f4f4",
        "color-accent-surface": "#edf3f1",
        "color-on-accent": "#ffffff",
        "color-primary-fill": "#28615d",
        "color-primary-fill-hover": "#1d4d49",
        "color-danger": "#a61b1b",
        "font-stack": '"Source Sans 3 Variable", -apple-system, "Segoe UI", sans-serif',
        "font-stack--monospace": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    },
    # Dark: the graphite variant of tokens.css.
    "dark_css_variables": {
        "color-background-primary": "#1b1e21",
        "color-background-secondary": "#191c1f",
        "color-background-hover": "#25272b",
        "color-background-border": "#303338",
        "color-foreground-primary": "#e9ebee",
        "color-foreground-secondary": "#b6bcc3",
        "color-foreground-muted": "#9ca3ab",
        "color-foreground-border": "#7d848c",
        "color-brand-primary": "#7fd0cc",
        "color-brand-content": "#7fd0cc",
        "color-brand-visited": "#a3e0dc",
        "color-highlight-on-target": "#25272b",
        "color-highlighted-background": "#1f3637",
        "color-admonition-background": "#191c1f",
        "color-api-name": "#7fd0cc",
        "color-api-pre-name": "#9ca3ab",
        "color-api-background": "#191c1f",
        "color-api-background-hover": "#25272b",
        "color-accent-surface": "#1f3637",
        "color-on-accent": "#ffffff",
        "color-primary-fill": "#2a7678",
        "color-primary-fill-hover": "#24686a",
        "color-danger": "#f1928f",
    },
    "sidebar_hide_name": True,
    "navigation_with_keys": False,
    "top_of_page_buttons": [],
    "source_repository": "https://github.com/JoshuaDuq/planumatlas",
    "source_branch": "main",
    "source_directory": "docs/",
}

html_context = {"viewer_url": "https://planumatlas.com/"}


# ---------------------------------------------------------------------------
# Figures: numbered per page, captioned as in a journal ("Fig. 1 | Title.") and drawn in both themes
# ---------------------------------------------------------------------------
def journal_figures(app, doctree):
    """Number each page's figures from 1 and give each `-light.webp` image its `-dark.webp` twin.

    Sphinx's own numbering (`numfig`) counts figures across the whole site, so a page's second
    figure would not be its Fig. 2. A page names the light image once, so the figure is numbered
    once; furo's `only-light` and `only-dark` classes show the image of the theme in use.
    scripts/figures.mjs writes both files.
    """
    from docutils import nodes

    for number, figure in enumerate(doctree.findall(nodes.figure), start=1):
        for caption in figure.findall(nodes.caption):
            caption.insert(
                0, nodes.inline("", f"Fig. {number} | ", classes=["caption-number"])
            )
        for image in list(figure.findall(nodes.image)):
            if not image["uri"].endswith("-light.webp"):
                continue
            dark = image.deepcopy()
            dark["uri"] = image["uri"].removesuffix("-light.webp") + "-dark.webp"
            image["classes"].append("only-light")
            dark["classes"].append("only-dark")
            image.parent.insert(image.parent.index(image) + 1, dark)


def setup(app):
    # Before Sphinx collects the images (priority 500), so the twin is copied with the build.
    app.connect("doctree-read", journal_figures, priority=400)
    return {"parallel_read_safe": True, "parallel_write_safe": True}
