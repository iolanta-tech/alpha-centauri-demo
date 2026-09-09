from jeeves.paths import SLIDES


def test_code_slides_fill_the_slide_without_scrollbars():
    css = (SLIDES / "styles.css").read_text(encoding="utf-8")
    frame_start = css.index(".slide.code-slide .code-frame {")
    frame_rule = css[frame_start:css.index("}", frame_start)]
    pane_start = css.index(".slide.code-slide .code-pane {")
    pane_rule = css[pane_start:css.index("}", pane_start)]
    info_start = css.index(".slide.code-slide .code-info {")
    info_rule = css[info_start:css.index("}", info_start)]
    assert "inset: 0;" in frame_rule
    assert "overflow: auto;" in pane_rule
    assert "scrollbar-width: none;" in pane_rule
    assert "line-height: 1.2;" in pane_rule
    assert "padding: 16px 460px 16px 20px;" not in pane_rule
    assert ".slide.code-slide .code-pane::-webkit-scrollbar" in css
    assert "background: rgb(255 255 255 / 90%);" not in info_rule
    assert "background: transparent;" in info_rule
