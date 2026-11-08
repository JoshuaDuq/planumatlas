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
]

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
# Figures: numbered per page and captioned as in a journal ("Fig. 1 | Title.")
# ---------------------------------------------------------------------------
numfig = True
numfig_format = {"figure": "Fig. %s |", "table": "Table %s |"}

# ---------------------------------------------------------------------------
# HTML output: furo, coloured from the viewer's own tokens (web/src/styles/tokens.css)
# ---------------------------------------------------------------------------
html_theme = "furo"
html_title = "Planum"
html_baseurl = "https://planumatlas.com/docs/"
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

