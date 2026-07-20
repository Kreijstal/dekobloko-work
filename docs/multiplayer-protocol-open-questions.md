# Multiplayer protocol — open questions and unproven claims

Adversarial review of `multiplayer-protocol.md`, produced alongside it.
Read this BEFORE trusting any layout in that document: it lists the claims
marked PROVEN that the underlying evidence does not actually support.

# Adversarial Review — Dekobloko Protocol Spec Punch-List

Ranked most-severe first. "Findings" = the raw per-feature validation blocks; "spec" = the synthesized consolidated document.

---

## 1. [BLOCKER / DEADLOCK] The `te.field_v[]` enable-gate + `bd.f` dispatch was bypassed in *every* inbound harness — the entire reply-delivery assumption is unproven

Every inbound proof called the handler **directly** and skipped the real dispatch path:
- high-scores: `ke.e((byte)48)` invoked directly ("bypasses the te.v gate")
- achievement-sync: `ke.e((byte)48)` direct ("te.v enable-table gating was bypassed by calling ke.e directly, so not re-verified")
- create-unrated: "I validated the handler ul.a directly rather than the bd.f dispatch offset"
- ignore-list: "harness invokes oe.c directly … te.v[13] dispatch gate not tested here"
- quick-chat: `ki.a(0,true)` direct

The governing rule makes this load-bearing: op 7, op 3/sub05, and op 3/sub01 are **proven blocking/re-draining requests**. Their answers (op 6, op 2/sub0, op 2/sub1) are dispatched by `bd.f` **only if `te.field_v[opcode]` is true**. If the server's login/bootstrap does not set `te.field_v[2]/[6]/[13]/[12]` before the client issues those requests, **every reply is silently dropped and every "fully PROVEN" feature stalls forever** — the exact failure mode this project keeps hitting. The spec files this as Still-Unverified #12 and rates it low-risk, but it is the single biggest unproven assumption underpinning the three features the spec calls fully coherent (create-unrated, high-scores, achievement-sync). Nothing in the findings demonstrates a real login stream flips those bits.

## 2. [BLOCKER] Opcode-3 collision — contradictory source table entries; peek-disambiguation is unproven synthesis; can storm two blocking features at once

Both writers were execution-proven to emit plaintext opcode 3 with **incompatible framing**:
- high-scores `wb.a`: no length byte, fixed 6 bytes, `03 05 00 00 00 0A 01`
- achievement-sync `fm.a`: u8 length byte, `f6 24 01 …`

Two problems the consolidated spec papers over:
- The **two source specs give directly contradictory static table entries**: high-scores spec says `CLIENT_PACKET_LENGTHS[3] = 6` ("MUST be added"); achievement spec says `CLIENT_PACKET_LENGTHS[3] = -1` ("MUST be added"). They cannot both hold.
- The consolidated "peek `0x05`" resolution (Step 0) is a **new invention that was never executed against the client**, and it was **never confirmed that both writers even fire opcode 3 in the same session** (flagged in 1.4.1, but the spec's own Section 4 implementation plan treats the peek as settled). Because both are re-draining blocking requests, a wrong peek makes **both** high-scores and achievement-sync storm.

## 3. [HIGH — could-not-run → guess dressed as spec] play-rated inbound op-58 body

The findings are explicit: "INBOUND NOT EXECUTED … Reconstructing that byte layout and driving it headless … was not attempted." Yet the consolidated spec ships a fully concrete `build_match_start()` (u16 settings, u16 game_id, u8 theme, …) that reads as implementable. It is a reverse-guess from `qc` field order; the `qc` ctor "pulls ~20 interleaved locals from prior in-game state" and "can throw." Outbound opcode number is also unknown (11 vs 124, both threaded, no literal). Correctly tagged HYPOTHESIS in prose, but the byte-level `build_pseudocode` invites someone to trust it. Keep it strictly behind the "do last / guarded" gate.

## 4. [HIGH — PROVEN overclaim] winning op62/op69/op60 inbound handler *effects* are bytecode-only, not executed

The consolidated table 1.3 tags op60 "PROVEN (ran `wl.d`, bytecode)" and Section 2.6 lists the full state mutations (`field_p[i]=null`, `field_d` bit clear, `field_i--`, defeat UI `cd.a(true)+ob.field_k=true`, teardown clearing `fm.field_b/am.field_c/fa.field_n`) under a "PROVEN via `wl.d` reader" heading. What the findings actually executed: `wl.d` decoding `[player][result]` bytes and a manual `qc.field_T` store. The findings state plainly: "the inline monolithic in-game handler … was NOT executed end-to-end." Two specific overclaims:
- **op60 has no body**, so `wl.d` was *not run for op60* at all — its row's "ran `wl.d`" citation is false; it is bytecode-only.
- The elimination/teardown/defeat-UI effects are **bytecode-read**, not run. Byte *layout* is proven; handler *behavior* is not.

## 5. [MEDIUM — framing inventory incomplete] 58/59/60 are also bidirectional with different framing; only 62 is called out

Section 1.4 lists only opcode 62 as "exists in BOTH directions." In fact:
- 58: client fixed-0 (ready) vs server −2 (start game)
- 59: client fixed-1 (move ACK) vs server −2 (spectator start)
- 60: client −1 (move batch) vs server **fixed-0** (teardown)

These are not table conflicts (separate client/server dicts) but the spec must not conflate them, and the 60 case is exactly the "add `60:0` to SERVER while CLIENT stays `-1`" split that Step 0/Step 2 depend on. Document 58/59/60 alongside 62.

## 6. [MEDIUM — internal contradiction] play-rated: "no storm" vs "stalls forever re-firing"

Consolidated Section 2.2/3 assert play-rated submit is fire-and-forget, "registers nothing on a `vj` queue," "No storm." The raw play-rated finding's own risk item says an unanswered submit means "the client stalls forever re-firing (the classic failure mode)." Unresolved — decide which is true before relying on "safe to ignore if unimplemented."

## 7. [MEDIUM] Three outbound opcode numbers are unknown and menu-threaded; quick-chat spec even guesses the *inbound* echo path around an unknown *outbound* opcode

`sn.a` (social add/remove), `ce.a` (quick-chat), `ad.a` (play-rated) all take the opcode as a runtime menu-action parameter with **no literal anywhere in the traced chains** (sn.a traced 5 levels deep). All fire-and-forget, so no storm — but the features silently never populate. Specific hazard: the quick-chat spec tells the server to "broadcast op 12 back including sender," but the server cannot recognize the inbound quick-chat request at all until its opcode is captured, and the spec's `game.py` branch is keyed on `QUICKCHAT_OPCODE = TBD`. Also note the ignore-list correction that the outbound opcode byte **is ISAAC-encrypted** (hypothesis said raw) — good catch, but reinforces that any guessed `CLIENT_PACKET_LENGTHS` key added prematurely will desync the keystream.

## 8. [MEDIUM] lobby-player-list end-to-end timing unproven; likely wrong model

The `qb.a` parse was proven by **injecting bytes straight into `de.V`'s buffer**, bypassing the socket and, critically, the login→ISAAC transition. The finding calls this "the single biggest open risk": if the client switches to the ISAAC `bd.f` reader immediately after login-success rather than re-entering `qb.a` state `kb.c`, a raw frame sent afterward is mis-read and desyncs. Plus the **5-name hard cap** (frameCode 100–105) strongly suggests this is a friends/online preview, not the lobby roster — the real occupant list may be `cl.x` (op 6) or `kc.r` (op 2). Shipping this as "the lobby player list" may implement the wrong feature.

## 9. [MEDIUM] create-unrated: only q=0/z=10 driven; N≥1 unresolved; create-vs-join unknown

`pn.a` per-occupant layout for `N>=1` was never reversed — the spec ships `N=0` only, which finalizes an **empty room where the host may not appear**. The create-vs-join / rated-vs-unrated meaning of q/z was never isolated (screen-entry auto-request was driven, not the actual "Create Unrated" button). Reply routing `bd.f→op6→ul.a` is read-only (ul.a executed directly — see #1). All honestly tagged, but "cleanest fully-proven template" oversells it: it's proven for the empty-room degenerate case only.

## 10. [LOW] quick-chat 0x8000 bit and untested sub-branches

Whether the server must strip the `0x8000` id bit on echo is HYPOTHESIS ("`ki.a` does not mask on read" → relay verbatim, unproven that `sm.a` tolerates it). The channel==2, var4==1, and channel 1|4 inbound sub-branches are **bytecode-read only, never executed** — the tested case was channel 0 / var4 0.

## 11. [LOW — blanket] No renderer was driven for any inbound feature

Every inbound proof is field-decode / state-advance (`ib.pb`, `kc.field_p`, `cl.field_A`, `ph.Eb`, `md.field_Z`, `qc.field_T`). Painting (`mb.a`, `cl.b`, `gf.a`, `ke`, `qc` loop) needs AWT and was not run. The `qc.field_T` result-code→text mapping is entirely opaque. The spec says this (Still-Unverified #13) but it should temper every "reaches the intended state" claim: decode ≠ paint.

---

## Single highest-value next harness

**Replay the server's actual login-success + bootstrap byte stream through the client's real `bd.f`/`te.field_v` initialization, then assert `te.field_v[2] == te.field_v[6] == te.field_v[13] == true` (and read `te.field_v[12]`).**

Rationale: this is the one experiment that de-risks *three* of the "fully PROVEN" load-bearing features simultaneously (create-unrated op6, high-scores op2/0, achievement-sync op2/1), because all three are blocking requests whose replies `bd.f` will **drop** unless those enable bits are set — and that gate is the single assumption every inbound harness bypassed (#1). It directly tests the governing request/reply rule end-to-end rather than one feature's byte layout. If the bits are not set by the current login bootstrap, the whole reply scheme deadlocks regardless of how correct the individual payloads are — so this removes more remaining uncertainty than reversing any one unknown layout (op-58 `qc` body, `pn.a`, or the menu-threaded outbound opcodes), each of which only unblocks a single, already-deferred feature.

Runner-up (if the login stream can't be reconstructed headless): drive the lobby/menu widget-action descriptor init and read the stored action-opcode constants — one harness could pin the unknown outbound opcodes for play-rated, social add/remove, and quick-chat at once (all originate from the same menu-action descriptor pattern).