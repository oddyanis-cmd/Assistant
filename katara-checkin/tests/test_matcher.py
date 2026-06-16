"""
Unit tests for the identity-decision core.

These are the most important tests in the project: they prove the "bullet-proof"
policy — accept only on a high score AND a clear margin over the runner-up — with
no cameras, models, or network involved.
"""
import numpy as np

from app.face.matcher import Template, cosine_similarity, identify, l2_normalize


def _vec(*vals) -> np.ndarray:
    return l2_normalize(np.array(vals, dtype=np.float32))


def test_cosine_basics():
    a = _vec(1, 0, 0)
    assert cosine_similarity(a, a) == 1.0
    assert abs(cosine_similarity(a, _vec(0, 1, 0))) < 1e-6   # orthogonal
    assert cosine_similarity(a, _vec(-1, 0, 0)) == -1.0      # opposite


def test_identical_face_is_accepted():
    emb = _vec(0.2, 0.5, 0.84)
    templates = [Template(client_id=1, embedding=emb)]
    res = identify(emb, templates, accept_threshold=0.45, decision_margin=0.10)
    assert res.accepted and res.client_id == 1
    assert res.similarity > 0.99


def test_stranger_is_rejected_below_threshold():
    enrolled = _vec(1, 0, 0)
    stranger = _vec(0, 1, 0)  # orthogonal -> sim ~0
    res = identify(stranger, [Template(1, enrolled)], accept_threshold=0.45, decision_margin=0.10)
    assert not res.accepted and res.client_id is None
    assert "below_threshold" in res.reason


def test_ambiguous_lookalikes_are_rejected_by_margin():
    """Two clients both score high and close together -> refuse to guess."""
    probe = _vec(1, 0, 0)
    c1 = _vec(1.0, 0.05, 0.0)   # very close to probe
    c2 = _vec(1.0, 0.07, 0.0)   # also very close
    res = identify(
        probe,
        [Template(1, c1), Template(2, c2)],
        accept_threshold=0.45,
        decision_margin=0.10,
    )
    assert not res.accepted
    assert "ambiguous" in res.reason
    assert res.margin < 0.10


def test_clear_winner_with_margin_is_accepted():
    probe = _vec(1, 0, 0)
    near = _vec(1.0, 0.1, 0.0)    # high score
    far = _vec(0.2, 1.0, 0.0)     # clearly lower
    res = identify(
        probe,
        [Template(1, near), Template(2, far)],
        accept_threshold=0.45,
        decision_margin=0.10,
    )
    assert res.accepted and res.client_id == 1
    assert res.margin >= 0.10
    assert res.runner_up_client_id == 2


def test_multiple_templates_take_best_per_client():
    probe = _vec(1, 0, 0)
    # Client 1 has a bad and a great shot; the great one should represent them.
    templates = [
        Template(1, _vec(0, 1, 0)),     # bad angle
        Template(1, _vec(1, 0.02, 0)),  # good angle
        Template(2, _vec(0.3, 0.9, 0)),
    ]
    res = identify(probe, templates, accept_threshold=0.45, decision_margin=0.10)
    assert res.accepted and res.client_id == 1
    # Only one entry per client in the ranking.
    assert len({c.client_id for c in res.ranking}) == len(res.ranking)


def test_no_templates_returns_no_match():
    res = identify(_vec(1, 0, 0), [], accept_threshold=0.45, decision_margin=0.10)
    assert not res.accepted
    assert res.reason == "no_templates_enrolled"


def test_threshold_is_strict_boundary():
    probe = _vec(1, 0, 0)
    # Construct an embedding with cosine ~0.4 (just under a 0.45 threshold).
    partial = _vec(0.4, np.sqrt(1 - 0.4**2), 0)
    res = identify(probe, [Template(1, partial)], accept_threshold=0.45, decision_margin=0.0)
    assert not res.accepted
    res2 = identify(probe, [Template(1, partial)], accept_threshold=0.35, decision_margin=0.0)
    assert res2.accepted
