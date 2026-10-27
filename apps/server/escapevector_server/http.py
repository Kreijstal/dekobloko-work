from __future__ import annotations

from urllib.parse import urlparse

from dekobloko_server.http import DekoblokoHTTPRequestHandler


class EscapeHTTPRequestHandler(DekoblokoHTTPRequestHandler):
    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/escapevector-rsa-client.jar":
            self._send_file(self.server.config.jar_path)
        elif path.endswith("countrylist.ws"):
            # Country-list handling is a no-op in this Escape client (jk.C).
            self._send_bytes("application/octet-stream", b"")
        elif path.endswith("toserverlist.ws"):
            self._send_text("text/html; charset=utf-8", self._simple_page("Escape Vector", '<a href="/">Local Escape Vector server</a>'))
        elif path.startswith("/dekobloko-"):
            self.send_error(404)
        else:
            super().do_GET()

    def _index_html(self) -> str:
        # Same launcher parameters and service endpoints as Deko. Original and
        # regenerated gamepacks both use EscapeVector as their entry class.
        return (super()._index_html().replace("Dekobloko", "Escape Vector")
                .replace("client.class", "EscapeVector.class")
                .replace("/dekobloko-rsa-client.jar", "/escapevector-rsa-client.jar"))
