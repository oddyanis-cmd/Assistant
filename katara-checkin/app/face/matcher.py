"""
Identity matching core — deliberately engine-agnostic.

This module knows nothing about cameras, neural nets, or HTTP. It operates purely
on embeddings (numpy float vectors), which makes the "is this the right person?"
decision logic fully unit-testable without any heavy ML dependency or model files.

The decision policy is intentionally conservative ("reject when in doubt"):

    accept  iff  best_similarity >= accept_threshold
            AND  (best_similarity - runner_up_similarity) >= decision_margin

The margin rule is what protects you against look-alikes / siblings: we only
check a member in when ONE identity is clearly the best, never when two are close.
For an access-control biometric the costly error is a *false accept* (checking in
the wrong person), so the system is tuned to fail safe to "not recognised" and let
the existing QR / manual flow take over.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Optional

import numpy as np


def l2_normalize(vec: np.ndarray) -> np.ndarray:
    """Return the unit-length version of a vector (safe for zero vectors)."""
    vec = np.asarray(vec, dtype=np.float32).ravel()
    norm = float(np.linalg.norm(vec))
    if norm < 1e-10:
        return vec
    return vec / norm


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity in [-1, 1]. Inputs need not be pre-normalised."""
    a = l2_normalize(a)
    b = l2_normalize(b)
    return float(np.dot(a, b))


@dataclass
class Template:
    """One enrolled face vector belonging to a client."""
    client_id: int
    embedding: np.ndarray  # expected L2-normalised


@dataclass
class Candidate:
    client_id: int
    similarity: float


@dataclass
class MatchResult:
    accepted: bool
    client_id: Optional[int]
    similarity: float          # best score seen
    margin: float              # best - runner_up (across DISTINCT clients)
    runner_up_client_id: Optional[int]
    reason: str                # human-readable explanation of the decision
    ranking: list[Candidate]   # best score per client, sorted desc

    def to_dict(self) -> dict:
        return {
            "accepted": self.accepted,
            "client_id": self.client_id,
            "similarity": round(self.similarity, 4),
            "margin": round(self.margin, 4),
            "runner_up_client_id": self.runner_up_client_id,
            "reason": self.reason,
            "ranking": [
                {"client_id": c.client_id, "similarity": round(c.similarity, 4)}
                for c in self.ranking
            ],
        }


def identify(
    probe: np.ndarray,
    templates: Iterable[Template],
    *,
    accept_threshold: float,
    decision_margin: float,
) -> MatchResult:
    """
    Match a probe embedding against all enrolled templates and decide.

    Multiple templates per client are collapsed to that client's BEST score, so
    enrolling several shots only ever helps (it can raise a client's score, never
    add a spurious competitor).
    """
    probe = l2_normalize(probe)

    best_per_client: dict[int, float] = {}
    for t in templates:
        sim = float(np.dot(probe, l2_normalize(t.embedding)))
        prev = best_per_client.get(t.client_id)
        if prev is None or sim > prev:
            best_per_client[t.client_id] = sim

    if not best_per_client:
        return MatchResult(
            accepted=False, client_id=None, similarity=0.0, margin=0.0,
            runner_up_client_id=None, reason="no_templates_enrolled", ranking=[],
        )

    ranking = sorted(
        (Candidate(cid, sim) for cid, sim in best_per_client.items()),
        key=lambda c: c.similarity,
        reverse=True,
    )

    best = ranking[0]
    runner_up = ranking[1] if len(ranking) > 1 else None
    margin = best.similarity - (runner_up.similarity if runner_up else -1.0)

    if best.similarity < accept_threshold:
        reason = f"below_threshold ({best.similarity:.3f} < {accept_threshold:.3f})"
        accepted = False
    elif runner_up is not None and margin < decision_margin:
        reason = (
            f"ambiguous: top two clients too close "
            f"(margin {margin:.3f} < {decision_margin:.3f})"
        )
        accepted = False
    else:
        reason = "match"
        accepted = True

    return MatchResult(
        accepted=accepted,
        client_id=best.client_id if accepted else None,
        similarity=best.similarity,
        margin=margin if runner_up is not None else 1.0,
        runner_up_client_id=runner_up.client_id if runner_up else None,
        reason=reason,
        ranking=ranking,
    )
