from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ServerConfig:
    host: str
    http_port: int
    game_port1: int
    game_port2: int
    cache_dir: Path
    jar_path: Path
    rsa_key_path: Path
    accounts_path: Path
    auto_register: bool
    servernum: int
    gamecrc: int
    instanceid: int
    member: str
    lang: int
    affid: int
    simplemode: str
    display_name: str
    player_id: int
    welcome_message: str

    @property
    def applet_params(self) -> dict[str, str]:
        return {
            "gameport1": str(self.game_port1),
            "gameport2": str(self.game_port2),
            "servernum": str(self.servernum),
            "gamecrc": str(self.gamecrc),
            "instanceid": str(self.instanceid),
            "member": self.member,
            "lang": str(self.lang),
            "affid": str(self.affid),
            "simplemode": self.simplemode,
        }
