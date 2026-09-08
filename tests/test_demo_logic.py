"""Run the dependency-free Alpha Centauri demo math tests."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "slides" / "demo"


def test_demo_coordinate_lod_and_flight_logic():
    tests = sorted(DEMO.glob("*.test.mjs"))
    assert tests, "demo tests are missing"
    result = subprocess.run(
        ["node", "--test", *map(str, tests)],
        check=False,
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    assert result.returncode == 0, result.stdout + result.stderr
