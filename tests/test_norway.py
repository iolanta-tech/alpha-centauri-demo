import json

from jeeves.paths import NORWAY_SOURCE
from jeeves.stages import (
    norway_jsonld,
    norway_yaml_11_jsonld,
    write_norway_jsonld,
    write_norway_yaml_11_jsonld,
)


def test_norway_yamlld_is_deterministically_serialized_as_jsonld(tmp_path):
    destination = tmp_path / "norway.jsonld"

    written = write_norway_jsonld(NORWAY_SOURCE, destination)

    assert written == destination
    assert destination.read_text(encoding="utf-8") == norway_jsonld(NORWAY_SOURCE)
    assert json.loads(destination.read_text(encoding="utf-8"))["country"] == "NO"


def test_norway_yaml_11_interpretation_resolves_no_as_false(tmp_path):
    destination = tmp_path / "norway-yaml-1.1.jsonld"
    written = write_norway_yaml_11_jsonld(NORWAY_SOURCE, destination)
    assert written == destination
    assert destination.read_text(encoding="utf-8") == norway_yaml_11_jsonld(NORWAY_SOURCE)
    assert json.loads(destination.read_text(encoding="utf-8"))["country"] is False
