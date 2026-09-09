"""QR codes on the Questions slide are generated from their visible URLs."""

from jeeves.qr import QR_LINKS, write_qr_codes


def test_questions_qr_codes_are_written_deterministically(tmp_path):
    assert write_qr_codes(tmp_path) == QR_LINKS
    for filename, url in QR_LINKS.items():
        output = (tmp_path / filename).read_text(encoding="utf-8")
        assert output.startswith("<?xml")
        assert "<svg" in output
        assert url not in output
