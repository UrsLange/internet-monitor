"""Quality score computation matching dashboard/src/utils/parser.ts qualityScore."""

from __future__ import annotations


def quality_score(
    dl: float | None,
    ping: float | None,
    loss: float | None,
) -> int:
    """Compute a 0-100 quality score from download speed, ping, and packet loss."""
    dl = dl if dl is not None else 0
    ping = ping if ping is not None else 200
    loss = loss if loss is not None else 5

    dl_score = 50 * min(max(dl / 100, 0), 1)
    ping_score = 30 * min(max(1 - ping / 200, 0), 1)
    loss_score = 20 * min(max(1 - loss / 5, 0), 1)

    return round(dl_score + ping_score + loss_score)
