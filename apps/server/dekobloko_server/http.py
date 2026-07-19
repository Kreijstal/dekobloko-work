from __future__ import annotations

import html
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .config import ServerConfig


class DekoblokoHTTPServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], config: ServerConfig) -> None:
        super().__init__(server_address, DekoblokoHTTPRequestHandler)
        self.config = config


class DekoblokoHTTPRequestHandler(BaseHTTPRequestHandler):
    server: DekoblokoHTTPServer

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/", "/index.html"):
            self._send_text("text/html; charset=utf-8", self._index_html())
            return

        if path in ("/dekobloko-compiled.jar", "/dekobloko-rsa-client.jar"):
            self._send_file(self.server.config.jar_path)
            return

        if path.endswith(".ws") or ".ws" in path:
            self._send_ws(path)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[http] {self.client_address[0]}:{self.client_address[1]} " + fmt % args)

    def _index_html(self) -> str:
        params = "\n".join(
            f'      <param name="{html.escape(name)}" value="{html.escape(value)}">'
            for name, value in self.server.config.applet_params.items()
        )
        return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Dekobloko local server</title>
    <style>
      body {{ background: #111; color: #eee; font-family: sans-serif; }}
      .frame {{ width: 640px; margin: 24px auto; }}
      applet {{ border: 1px solid #555; background: #000; }}
      code {{ color: #b8e7ff; }}
    </style>
  </head>
  <body>
    <div class="frame">
      <h1>Dekobloko local server</h1>
      <applet code="client.class" archive="/dekobloko-rsa-client.jar" width="640" height="480">
{params}
      </applet>
      <p>
        TCP game/cache ports: <code>{self.server.config.game_port1}</code>,
        <code>{self.server.config.game_port2}</code>.
      </p>
      <p>
        The client still needs matching JS5 cache files in the server cache directory.
      </p>
    </div>
  </body>
</html>
"""

    def _send_ws(self, path: str) -> None:
        if path.endswith("countrylist.ws"):
            body = "0|Local\n276|Germany\n826|United Kingdom\n840|United States\n"
            self._send_text("text/plain; charset=utf-8", body)
            return

        if path.endswith("toserverlist.ws"):
            self._send_text("text/html; charset=utf-8", self._simple_page("Server list", "Local Dekobloko server"))
            return

        if path.endswith("tosupport.ws"):
            self._send_text("text/html; charset=utf-8", self._simple_page("Support", "Local server support placeholder"))
            return

        if path.endswith("quit.ws"):
            self._send_text("text/html; charset=utf-8", self._simple_page("Quit", "You can close this page."))
            return

        if path.endswith("reload.ws"):
            self._send_text("text/html; charset=utf-8", self._simple_page("Reload", '<a href="/">Return to game</a>'))
            return

        if "clienterror.ws" in path:
            self._send_bytes("application/octet-stream", b"\n")
            return

        if "error_game_" in path:
            self._send_text("text/html; charset=utf-8", self._simple_page("Game error", html.escape(path)))
            return

        self._send_text("text/plain; charset=utf-8", "ok\n")

    def _simple_page(self, title: str, body: str) -> str:
        return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{html.escape(title)}</title></head>
<body>{body}</body></html>
"""

    def _send_file(self, path: Path) -> None:
        if not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, f"Missing file: {path}")
            return
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        data = path.read_bytes()
        self._send_bytes(content_type, data)

    def _send_text(self, content_type: str, text: str) -> None:
        self._send_bytes(content_type, text.encode("utf-8"))

    def _send_bytes(self, content_type: str, data: bytes) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
