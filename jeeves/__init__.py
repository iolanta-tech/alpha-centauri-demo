"""Project commands for Jeeves (run with `j <command>`)."""

from .render import render as _render
from .serve import serve as serve


def render() -> None:
    """Regenerate slide fragments, metrics, graph data, and the Shower deck."""
    _render()
    print("Rendered slides/index.html")
