# Reproducible game naming

Deko owns the naming scripts and one current rule manifest per named game.
`java-tools` owns generic decompiler recovery. `funorb-decompiled` publishes
Java directly in `games/<game>`, with a reading guide
beside the sources. There is no second published Java tree or committed stub
JAR. One current `decompilation/<game>-naming.json` dictionary records reverse
edits, source/compiler identities, symbol verification and export provenance.

Use sibling checkouts or set `FUNORB_DECOMPILED_DIR`, then run:

```sh
env -u JAVA_TOOL_OPTIONS node readable/build-geoblox-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-geoblox.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-dekobloko-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-dekobloko.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-dekobloko.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-armiesofgielinor-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-armiesofgielinor.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-armiesofgielinor.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/build-steelsentinels-rules.mjs --check
env -u JAVA_TOOL_OPTIONS node readable/reproduce-steelsentinels.mjs --update
env -u JAVA_TOOL_OPTIONS node readable/reproduce-steelsentinels.mjs --check
node readable/restore-game.mjs dekobloko /tmp/restored-dekobloko
node scripts/check-source-catalog.mjs /absolute/path/to/funorb-decompiled
node --test scripts/test-publish-decompiled-games.mjs readable/tests/test-game-publication.mjs
```

The exporter reads raw Java from its exact pinned Git commit, builds signature
stubs from tracked `stubs/src` into temporary storage, compiles both complete
corpora and verifies every resolved declaration, reference and override. It
stages Java, guide, dictionary and catalog receipt before replacing the current
game; failed metadata installation restores the previous game and receipt.
Checks and reverse reconstruction also use temporary storage, never `.work`.
The frozen generic naming dependency remains under `tools`, bound by `PIN.json`.

## Steel Sentinels

The current pass names 27 reviewed classes: world/sentinel state, gameplay,
engineering, terrain, projectiles, explosions, effects, commands, articulated
parts and the supporting packet/rendering/collection roots. One current
`steelsentinels-rules.json` records evidence and exact input/workflow identities.
Unresolved meanings remain opaque or carry qualified role names. Physics
velocity is distinct from armour; module alias encodings and charge edge cases
remain unchanged. Command scheduling, target coordinates and aim angles now
have reviewed names; scheduling is separate from ability activation.

Every export compares raw and named module checks/bonuses, armour and charge
mutations, terrain boundaries, recursive part armour and synchronization checksums
against independent expectations. Command probes cover duration/activation,
queue routing and ordering, equal-tick replacement, stale command removal and
queue clearing. Controlled fixtures bypass game constructors
and Applet initialization; they do not establish full gameplay, projectile
simulation or server compatibility. Three dispatcher files and large methods
remain. Java is published only in `games/steelsentinels` in FunOrb.

## Armies of Gielinor

The current pass names 80 reviewed classes around battlefield state, units, map
tiles, teams, gameplay coordination, movement, AI, tutorial, events and packet
decoding, including unit/action/global spells and prepared battlefield actions. This pass
also names event presentations, combat camera/characters, per-unit AI candidates,
selection strategies, influence maps and campaign overrides. All five action-request
subclasses and ten prepared-action subclasses now have reviewed names.
ActionRequest/PreparedAction replace the misleading SpellArea names: the same
contract handles movement, attacks, summoning, deployment and spell casts.
AI summoningPlayer and summonUnitType describe the actual SummonRequest arguments;
teleport offsets are signed deltas. PreparedAction.playerFlags has one entry per
player. Turn markers retain canonical no-op application and unused constructor
arguments stay unused. CombatSandbox and UnitInfoPopup identify the
standalone combat controls and animated unit popup.

Combat prediction and its power/cover helpers now have reviewed method,
parameter and local names. The result tuple holds defender damage, attacker
damage and two death flags. Flying eligibility, anti-flying bonuses, structure
capture and Sea Slug parasitism have distinct capability names. Terrain damage
percentages, status masks and team tile effects retain their original encodings.
Summoning permission, local god favour and affordability are separate checks.

Combat event payloads and the main consequence routine have reviewed field, parameter
and local names. SpellCastEvent corrects the earlier trinket label using the
actual spell-table dispatch. Reviewed fields and operations carry evidence in
the one current `armiesofgielinor-rules.json` manifest. Unknown names remain unknown;
packed flags use bit-position names until their gameplay meanings are proved.
Override names propagate through resolved contracts, and label targets remain
unchanged. The frozen Java compiler input is read from Git, not the current
named export.

Every export compares raw and named core execution with independent expected
results for rectangular map lookup, alliances, unit flags/damage, equipment and
ranges, spell wire bytes, combat payloads/consequence queues, and tile metadata.
Additional fixtures check best-score selection, candidate recycling/reset,
single-candidate weighted selection and presentation completion acknowledgement.
Packed movement request fixtures cover partial four-direction groups and signed
target offsets. Prepared-action fixtures check queued movement/attack, deployment,
growth, teleport and spell payloads; all four marker classes preserve no-op
application. These checks inspect queued events without applying later game state.
Combat fixtures independently specify complete damage/counterattack/death tuples,
including range rejection, minimum damage, the 255 cap and protected statuses.
Additional checks cover terrain/status scaling, team-effect projection, summoning
permissions/favour, parasite eligibility and popup fade animation. They do not
exercise rendering, sandbox controls or a complete match.
The probe bypasses battlefield construction and Applet initialization,
so it is not a full gameplay or multiplayer-server test. Three dispatcher files
and large methods remain; this is a semantic naming pass, not control-flow recovery.

## Deko Bloko

The first pass covers all 343 classes and the opaque member/parameter/local
names. Reviewed names identify the board, session, pieces, sprites, packets,
client and platform/UI/audio roots. Other names describe only a structural
category or declaration type; their finer purposes remain explicitly unresolved.
Numbered labels are deterministic, with original spellings in the dictionary.

The board fields and main operations use the existing original-bytecode
multiplayer differential as evidence. Every export also compares 160 synthetic
snapshot states against the pinned raw Java, with independent expectations for
board geometry, lives, controls, countdowns and decoded cells. Both variants
use the same headless client boundary. This checks snapshot decoding, not full
multiplayer execution or whole-game equivalence.

## GeoBlox

The layout migration preserves all 303 reviewed Java files byte for byte and
all 20,133 complete naming rules. Its source pin still identifies the reviewed
raw compiler snapshot in Git history. The current workflow and source-built
stub dependency are explicitly pinned by the migration manifest.

Existing native GeoBlox probes obtain their raw/named source pair and compilation
stubs through a temporary compatibility view in `layout.mjs`; no compatibility
folder exists in the publication. Historical structural proof scripts and
compiler opt-in settings describe frozen prior passes and must be replayed from
their recorded Git tool/input commits. Their pass narratives remain in Git
history, rather than accumulating in this current README.

Generic readability runs by default. Game naming maps and specific relocations
remain explicit integration inputs. Browser/phone memory and presented-FPS
acceptance remain unverified.
