"""Project commands for Jeeves (run with `j <command>`)."""

from pathlib import Path

import sh


PROJECT_ROOT = Path(__file__).parent


def render():
    """Render article.j2 into article.md."""
    article = PROJECT_ROOT / "article.md"
    rendered = sh.iolanta(
        "--render-template",
        PROJECT_ROOT / "article.j2",
        _cwd=PROJECT_ROOT,
        _encoding="utf-8",
    )
    article.write_text(str(rendered), encoding="utf-8")
    print(f"Rendered {article.name}")
