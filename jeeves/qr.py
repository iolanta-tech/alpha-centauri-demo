"""Deterministic QR assets for the final presentation slide."""

from __future__ import annotations

from pathlib import Path

import qrcode
from qrcode.image.svg import SvgPathImage

QR_LINKS = {
    "json-ld-working-group.svg": "https://www.w3.org/groups/wg/json-ld/",
    "yaml-ld-specification.svg": "https://www.w3.org/TR/yaml-ld/",
    "yaml-ld-repository.svg": "https://github.com/w3c/yaml-ld",
}


def write_qr_codes(destination: Path) -> dict[str, str]:
    """Write the fixed QR codes used by the Questions slide."""
    destination.mkdir(parents=True, exist_ok=True)
    for filename, url in QR_LINKS.items():
        image = qrcode.make(url, image_factory=SvgPathImage, border=1)
        image.save(destination / filename)
    return QR_LINKS.copy()
