from http.server import SimpleHTTPRequestHandler
from unittest.mock import Mock, patch

from jeeves.serve import DeckRequestHandler


def test_deck_handler_disables_browser_cache():
    handler = object.__new__(DeckRequestHandler)
    handler.send_header = Mock()

    with patch.object(SimpleHTTPRequestHandler, "end_headers") as parent_end_headers:
        handler.end_headers()

    handler.send_header.assert_called_once_with("Cache-Control", "no-store")
    parent_end_headers.assert_called_once_with()
