"""
broken_module.py
Contains TWO intentional bugs that ClawOps will autonomously detect and repair.

Bug 1 (line ~18): process_user_data() — no None guard → AttributeError
Bug 2 (line ~49): calculate_stats()   — counter += 2 causes infinite loop on odd targets
"""
import logging

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
#  BUG 1 ─ NULL POINTER
#  Fix: add `if user_data is None: return {...}` guard before .get()
# ──────────────────────────────────────────────────────────────
def process_user_data(user_data):
    """Process a user dict and return normalised fields."""
    # BUG: no None-check — crashes with AttributeError when user_data is None
    result = user_data.get("name")
    email  = user_data.get("email", "unknown")
    return {
        "processed_name": result.upper(),
        "email": email,
        "status": "processed",
    }


# ──────────────────────────────────────────────────────────────
#  BUG 2 ─ INFINITE LOOP
#  Fix: change `counter += 2` → `counter += 1`
# ──────────────────────────────────────────────────────────────
def calculate_stats(target: int):
    """Return cumulative squares from 0 up to (but not including) target."""
    counter = 0
    results = []

    while counter != target:          # can never be reached if target is odd
        results.append(counter * counter)
        counter += 2                   # BUG: skips odd numbers → infinite loop

        # Safety guard so tests don't hang forever
        if counter > 10_000:
            raise MemoryError(
                "Process killed — memory limit exceeded (infinite loop detected)"
            )

    return {"count": len(results), "sum": sum(results)}
