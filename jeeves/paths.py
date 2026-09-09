"""Project paths."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUERIES = Path(__file__).parent / "queries"
EXAMPLES = ROOT / "examples"
TEST_FIXTURES = ROOT / "tests" / "fixtures"
GENERATED = ROOT / "generated"
FRAGMENTS = GENERATED / "fragments"
METRICS_DIRECTORY = GENERATED / "metrics"
METRICS_FILE = METRICS_DIRECTORY / "metrics.jsonld"
SLIDES = ROOT / "slides"
QR_CODES = SLIDES / "images" / "qr"
NORWAY_SOURCE = SLIDES / "sources" / "norway.yamlld"
NORWAY_JSONLD = GENERATED / "norway.jsonld"
NORWAY_YAML_11_JSONLD = GENERATED / "norway-yaml-1.1.jsonld"
STAGE_FILES = (
    "01-canonical.jsonld",
    "02-plain.yamlld",
    "03-dollar.yamlld",
    "04-unicode.yamlld",
)


def graph_iri(filename: str) -> str:
    return f"sparqld:{filename}"
