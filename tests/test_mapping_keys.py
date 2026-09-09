"""The mapping-key slide is backed by a real YAML-LD rejection."""

from jeeves.paths import TEST_FIXTURES
from jeeves.sparqld import load_errors, serve


def test_non_string_mapping_key_is_rejected_by_the_loader():
    with serve(TEST_FIXTURES, materialize_plain_yamlld=False) as endpoint:
        errors = load_errors(endpoint)

    assert errors
    assert any("expected string scalar" in message for _, message in errors), errors


def test_values_are_declared_with_their_intended_json_ld_types():
    fixture = (TEST_FIXTURES / "invalid-mapping-key.yamlld").read_text(encoding="utf-8")

    assert 'dbp:discovered: { "@type": xsd:date }' in fixture
    assert 'dbp:star: { "@type": "@id" }' in fixture
    assert 'dbp:discoverer: { "@type": "@id" }' in fixture
    assert "dbp:star: dbr:Proxima_Centauri" in fixture
    assert "dbp:discoverer: dbr:Guillem_Anglada-Escudé" in fixture
