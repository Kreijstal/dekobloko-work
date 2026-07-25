"""Regression tests for the bot control-feed rate.

Pins the fix for a disconnect observed live on 2026-07-25: the human client
dropped out mid-match with ``Error: T5: 2 3 true`` while its own board was
perfectly healthy (3 lives, ``field_y=false``).

The chain, read off the injected client trace plus the server log:

  * bots fed ``[FAST_DROP] * 5`` per 0.4s turn; the real client fed 20.  Over
    one window the server logged 16 batches x 5 = 80 ticks for each bot slot
    against ~220 for the human's.
  * so the engine advanced a bot bucket ~3-4x slower than the client drew it.
    The client's replica landed the piece and sat waiting for the authoritative
    transition (S2C 64) that had not been computed yet.
  * ``lk.c(30000, 0, 0)`` grants that wait a 20-tick grace, then sets
    ``field_y``; on the *next* expiry with ``field_y`` still set it latches
    ``field_Bb``.  Captured verbatim, on both opponent boards:

        LOCK board=34c1ff58 at=(4,16) y=true Bb=false args=(30000,0,0)
        LOCK board=4aba01a  at=(1,16) y=true Bb=false args=(30000,0,0)

  * nothing short of a full board reset clears ``field_Bb`` -- notably the
    install path (``lk.a(int,int,rf)``) clears ``field_y`` only -- so the late
    S2C 64 could not rescue it.  ``qc`` then reported T5 and called
    ``si.a(107)``, which closes ``qc.field_s``: a deliberate self-disconnect.

The invariant worth defending is the first bullet: a bot must supply one
control sample per client frame of wall-clock it lets pass.
"""

from __future__ import annotations

import unittest

from time import monotonic as _monotonic_now

from dekobloko_server.bots import (
    CLIENT_FPS,
    MAX_CATCHUP_SAMPLES,
    BotManager,
)


class _StubLobby:
    """BotManager only touches ``_lock``/``_games`` during a tick."""

    def __init__(self) -> None:
        import threading

        self._lock = threading.Lock()
        self._games: dict = {}


class BotTickRateTest(unittest.TestCase):
    def test_samples_per_turn_matches_client_frame_rate(self) -> None:
        """The whole point: samples must cover the elapsed wall clock.

        At the default 0.4s poll this is 20 -- exactly what the real client
        was observed uploading per batch.
        """
        runner = BotManager(_StubLobby(), poll_interval=0.4)
        self.assertEqual(runner.samples_per_turn, 20)
        self.assertEqual(runner.samples_per_turn, round(0.4 * CLIENT_FPS))

    def test_sample_count_scales_with_poll_interval(self) -> None:
        """Re-tuning the poll interval must not silently re-starve the boards.

        This is the regression proper: the old code hardcoded 5, so any change
        to ``poll_interval`` widened or narrowed the gap invisibly.
        """
        for interval, expected in ((0.2, 10), (0.4, 20), (1.0, 50)):
            with self.subTest(poll_interval=interval):
                runner = BotManager(_StubLobby(), poll_interval=interval)
                self.assertEqual(runner.samples_per_turn, expected)

    def test_starved_feed_would_exceed_the_client_grace_window(self) -> None:
        """Guards the margin, not just the arithmetic.

        ``lk.c`` appears to tolerate a 20-tick stall before setting ``field_y``
        and to disconnect on the expiry after that.  The old 5-sample feed fell
        15 ticks short per turn, so the deficit crossed that window within two
        turns.  Anything that leaves a per-turn deficit at all reopens the bug,
        so require the feed to fully cover the interval.

        Treat the 20 below as the nominal figure only.  Measured 2026-07-25,
        ``field_e`` collapses 20 -> 1 in a single tick, so the usable window is
        a couple of frames -- see
        test_default_batch_fits_inside_the_client_grace_window, which is what
        actually defends the margin.
        """
        client_grace_ticks = 20
        runner = BotManager(_StubLobby(), poll_interval=0.4)
        ticks_client_renders = round(runner.poll_interval * CLIENT_FPS)

        deficit = ticks_client_renders - runner.samples_per_turn
        self.assertEqual(deficit, 0, "bot board must not fall behind the replica")

        legacy_deficit = ticks_client_renders - 5
        self.assertGreater(
            legacy_deficit * 2,
            client_grace_ticks,
            "the pre-fix feed is expected to blow the grace window; if this "
            "no longer holds, re-derive the window from lk.c before relaxing",
        )

    def test_bot_never_sends_an_empty_batch(self) -> None:
        """A zero-length batch would stall the slot outright."""
        runner = BotManager(_StubLobby(), poll_interval=0.001)
        self.assertGreaterEqual(runner.samples_per_turn, 1)

    def test_samples_bill_against_elapsed_wall_clock(self) -> None:
        """A stretched turn must pay for the frames it actually missed.

        The poll loop's sleep is a floor, not a promise. A fixed batch per turn
        makes every stretched turn a permanent deficit, and the replica the
        client renders has no matching shortfall -- lk.d ticks its gravity
        every rendered frame whether or not input arrived. So the replica ends
        up AHEAD, reaches a landing the engine has not, waits for the S2C 64
        that finalizes it, and latches field_Bb when the grace runs out. That
        grace is a couple of frames, so the deficit does not need to be large
        to be fatal.
        """
        runner = BotManager(_StubLobby(), poll_interval=0.4)
        bot = runner.bots[0]

        # A turn that took three times as long owes three intervals of frames
        # (60), clamped to what the server's control credit will actually
        # accept in one batch.
        runner._fed_through[bot.display_name] = _monotonic_now() - 1.2
        self.assertEqual(MAX_CATCHUP_SAMPLES, runner._samples_owed(bot))

        # A turn that arrived on time owes exactly one interval of frames.
        runner._fed_through[bot.display_name] = _monotonic_now() - 0.4
        self.assertEqual(20, runner._samples_owed(bot))

    def test_unspent_frame_fraction_carries_to_the_next_turn(self) -> None:
        """Rounding the leftover away would re-create the deficit slowly."""
        runner = BotManager(_StubLobby(), poll_interval=0.4)
        bot = runner.bots[0]
        # 0.41s is 20.5 frames: pay 20 now, and the half-frame must survive.
        start = _monotonic_now() - 0.41
        runner._fed_through[bot.display_name] = start
        self.assertEqual(20, runner._samples_owed(bot))
        self.assertAlmostEqual(
            start + 20 / CLIENT_FPS, runner._fed_through[bot.display_name]
        )

    def test_leaving_a_match_clears_the_clock(self) -> None:
        """Otherwise the first turn of the NEXT match bills the idle gap."""
        runner = BotManager(_StubLobby(), poll_interval=0.4)
        bot = runner.bots[0]
        runner._fed_through[bot.display_name] = _monotonic_now() - 30.0

        class _GameWithoutTheBot:
            state = "playing"

            @staticmethod
            def active_players() -> list:
                return []

        runner._play_turn(bot, _GameWithoutTheBot())
        self.assertNotIn(bot.display_name, runner._fed_through)
        # A fresh start bills one nominal interval, not the 30s it sat idle.
        self.assertEqual(20, runner._samples_owed(bot))

    def test_default_batch_fits_inside_the_client_grace_window(self) -> None:
        """A relayed batch is queued input the replica must work through.

        It cannot apply a pending authoritative landing (S2C 64) until it
        reaches the end, so a batch worth more frames than the grace lets the
        replica land first, set field_y, and latch field_Bb -- the "T5"
        self-disconnect, which kills the human's connection over an OPPONENT's
        bucket.

        The grace is nothing like the 20 ticks lk.c appears to promise.
        Measured 2026-07-25, field_e collapses 20 -> 1 in one tick, so treat
        the usable window as a couple of frames and keep the batch near it.
        """
        runner = BotManager(_StubLobby())
        self.assertLessEqual(
            runner.samples_per_turn,
            5,
            "a larger default batch re-opens the T5 race; if this has to grow, "
            "re-measure field_e in lk.d first",
        )
        self.assertGreaterEqual(runner.samples_per_turn, 1)


if __name__ == "__main__":
    unittest.main()
