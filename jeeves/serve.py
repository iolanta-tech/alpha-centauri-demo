"""HTTP server for the Shower deck."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from rich.console import Console

from .paths import SLIDES

console = Console()
DEFAULT_PORT = 8765
HOST = "0.0.0.0"


class DeckRequestHandler(SimpleHTTPRequestHandler):
    """Serve the mutable local deck without retaining stale assets."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def serve(port: int = DEFAULT_PORT) -> None:  # pragma: nocover
    """Serve the Shower deck.

    The deck will be available at http://127.0.0.1:8765/index.html
    """
    console.print(f"http://{HOST}:{port}/index.html")
    request_handler = partial(
        DeckRequestHandler,
        directory=str(SLIDES),
    )
    ThreadingHTTPServer((HOST, port), request_handler).serve_forever()
