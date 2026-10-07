# Wonderwood: The Lantern Club — Game Design

A local-first browser game center for two young children (a 4-year-old and a 6-year-old) played on a
tablet or laptop. The player joins a small club of woodland creatures getting ready for a lantern
festival. The festival is a story destination, never a deadline.

**Player fantasy:** "I am an explorer, inventor, storyteller, and valued member of this place. My ideas
change what happens."

## Design pillars

1. **Play first.** Every activity has a physical verb that feels good on its own: launching, bouncing,
   squishing, building, steering, performing. Learning goals are invisible in the mechanics.
2. **Many valid ways.** Each problem has a mechanical route, a social route, and a quiet route. The
   rewards are the same whichever route the child takes.
3. **Gentle social practice.** Children can watch first, gesture, try a small step, ask for help, or
   say "not now." NPCs also start conversations, ask, decline, apologise, and help.
4. **Ownership.** What a child makes keeps its real appearance and behaviour, and it shows up in the
   clubhouse.
5. **Easy to stop.** "Save and finish" is always one tap away, nothing decays while you're away, and
   finishing never shows a teaser.

## Core loop (shared by every game)

Notice something intriguing → choose what to try → move/build/perform → playful complication →
adjust → meaningful result → keep something you made or changed.

## World

| Place | What happens there | Game |
| --- | --- | --- |
| Lantern Oak clubhouse | Displays creations and souvenirs, plus a wardrobe | Hub |
| Windmill Hill | Breezy hilltop, Pip's launcher, windmill | Lantern Trail: Windmill Kite |
| Whistle Stream | Picnic Meadow's stream and the old waterwheel | Lantern Trail: Picnic Bridge, Waterwheel Mix-Up |
| Tinker Grove | Moss's workshop in a hollow tree | Tinker Grove |
| Picnic Meadow | Blanket, kitchen cart, guests | Picnic Parade |
| Puppet Theater | A tiny theater in a tree stump | Story Stage |
| Festival Glade | Lantern launch site | Lantern Trail: Lantern Launch |

You get around with an illustrated **map**: tap a landmark to travel there. There is also a **Quick
Jump** tray (the map button in the top-left), so navigating is never a repeated chore. All four games are
open after the short first-run onboarding. Story beats unlock more Lantern Trail adventures, but the
other games never depend on social choices.

## Cast

| Character | Interests and abilities | Flaw or growth | Typical emotions |
| --- | --- | --- | --- |
| **Pip** (squirrel) | Inventions, launching things, speed | Starts too many projects; needs help finishing | Excited, frustrated, proud, embarrassed |
| **Moss** (turtle) | Engineering, measuring, snails, slow rides | Wants time to watch first; can over-plan | Curious, cautious, delighted, worried |
| **Fizz** (rabbit) | Music, dancing, hats, being first | Sometimes interrupts; learns to repair it | Thrilled, impatient, sorry, silly |
| **Luma** (moth) | Stories, lanterns, night sky, costumes | Sometimes prefers a quieter spot (not shyness as identity: she also performs boldly) | Dreamy, nervous, brave, giggly |
| **Rowan** (badger) | Fixing, gardening, cooking soup | Overly tidy; can learn to let mess happen | Calm, amused, tired, warm |

NPCs act in ways that change from scene to scene. Quietness is never a character's whole identity. Moss
watches first in Windmill Kite but leaps in at the Waterwheel, and Luma narrates loudly at the Puppet
Theater.

## Assistance presets

Age is only a starting assumption. Each profile has a preset, and each game can override it in the adult
area. The labels are friendly: **More help** and **More exploring**. The game never compares siblings.

| Dimension | More help (younger default) | More exploring (older default) |
| --- | --- | --- |
| Directions | One demonstrated action at a time (ghost hand) | Short demonstrated sequences |
| Choices | Two clear options | Three options or a small open set |
| Movement | Tap to move, path assistance, large forgiving hit areas | Tap or arrow keys, optional routes |
| Building | Large snap zones, starter parts only | More parts, rotation, extra constraints |
| Social | Concrete needs, immediate consequences | Misunderstandings, competing preferences, repair |
| Story | Three-scene strip, expressive actions | Up to six scenes, intentions, alternate endings |
| Hints | Idle hint after ~12 s | Idle hint after ~30 s |

These are design hypotheses to test, not developmental cutoffs.

## Game A — Lantern Trail (exploration adventure)

**Verbs:** walk, inspect, carry, place, pull, rotate, launch, signal, ask for help.
**Appeal:** hidden paths, funny machines, creature reactions.

### A1. The Windmill Kite (first slice; the standard for everything else)

1. **Hook.** The player taps the glider. The avatar runs to it, lifts it, and throws it. It sails down
   the hill (with optional steering through dandelion rings) and passes Pip's loose kite, which snags on
   the windmill.
2. **Explore Windmill Hill.** Funny objects: dandelion puffs (their seeds show the wind), a frog on a
   lily pad, a flapping sock on a line, a bouncy mushroom that springs the avatar up to see the kite, and
   a pumpkin patch.
3. **Social encounter (Pip at the launcher).** The child can:
   - **Watch** a launch. The puff ball curves in the wind, which reveals useful information.
   - **Wave** for a turn. Pip says "One more go, then it's yours!" (accepting *not yet*) and suggests a
     useful step meanwhile: "Can you move the nest?"
   - **Ask** "Can I try?" or "Can we do it together?". Together, the roles are aimer and pumper.
   - (More exploring) **Ask** "What are you making?" This starts a conversation.
   - **Walk away** to investigate the windmill. This is the solo or quiet route.
   - Decline Pip's invitation ("Not now"). Pip says "Okay! I'll be here."
4. **Main puzzle (wind + landing nest).** The kite must drift down into the soft nest wagon. Wind blows
   it sideways, and the dandelion seeds and weathervane show which way. Ways to free the kite:
   - **Launcher route:** pick an angle (2 with More help, 3 with More exploring). The dotted preview
     shows the curve the wind will push the puff ball along. A correct choice works first time; there is
     no fake failure.
   - **Windmill route:** the brake lever is stiff. Carry a pumpkin into the lever bucket (solo), or ask
     Rowan for help ("You pull, I'll hold it steady"). The sails turn and drop the kite from lower down,
     so the right nest spot is different.
   - If the kite misses the nest, the windmill's bounce-back breeze lifts it back onto a sail. A flag
     marks where it touched down. Move the nest and try again.
5. **Mix-up.** The first time the nest is moved, the wagon rolls down the slope into Pip's ribbon spool.
   Ribbon wraps the wheels. Pip: "Eep! My ribbon!" The child can say sorry, start untangling, or ask Pip
   to help. Either way, the repair is an action: tap each loop while Pip winds the spool. Pip owns their
   part ("I left it right on the slope!"). Apologising is available, but it is not a password.
6. **Resolution.** The freed kite lands in the nest. The kite's tail is repaired with the rescued ribbon,
   and the player chooses a tail pattern (stars, stripes, dots, leaves) and a colour. The child and Pip
   run, and the kite flies; the player can swoop it around the sky.
7. **World change.** The kite flies over Windmill Hill from now on, and the chosen tail hangs in the
   clubhouse.
8. **Ending choices:** fly again, explore, or save and finish.

Different routes get different lines but the same welcome and the same reward.

### A2. The Picnic Bridge (`PicnicBridgeScene`)
The bridge over Whistle Stream washed away, and the picnic is on the far bank. Three friends show
(picture bubble) and say what they need:
- Moss needs a flat, slow way with no steps.
- Fizz would love stepping stones to hop on, but will walk a flat way too. That's a preference, not a
  requirement.
- Rowan's wagon needs something wide and steady.

**Beats:**
- Gather planks: one by the shed, one hidden under a leaf pile, one by the bank.
- Gather stones from a pile.
- Carry each piece and put it on the faint outlines across the stream: long outlines for planks, round
  ones for stones.

**Complication:** the first plank floats away downstream. Moss offers the idea of tying the planks
together. Fish the plank back with the long stick, then tie the planks with the rope. Rowan's wagon
needs the tied planks, and says so kindly if they're not tied yet.

**Alternate route:** roll the old logs back onto the rocks upstream. The log bridge suits all three
friends.

**Resolution:** tap each friend to try crossing. If something's missing, they say what they need. Once
everyone is across, there's a picnic on the far bank.

**World change:** the bridge stays built and the far bank opens for walking. The bridge flag goes up
in the clubhouse.

### A3. The Waterwheel Mix-Up (`WaterwheelScene`)
The waterwheel stopped and the mill lanterns went dark. Rowan wonders why.

**Exploring:** follow the dry streambed uphill. There are optional clues along the way: a leaf in the
mud, small wet footprints, and a bucket of leaves. Getting near the pool is enough to find the cause;
no clue is required.

**Fizz's mistake:** Fizz built a leaf dam for a splash pool and forgot to tell anyone. Fizz is
embarrassed, owns it, apologises, and offers to help. The apology doesn't fix anything; the repair is
an action. Choices:
- Fix it together: carry stones with Fizz to make a side channel, so the pool and the wheel both get
  water.
- Do it alone: Fizz watches, the child clears the dam leaf by leaf, and the pool empties. Fizz is a
  little sad, which is okay.
- (More exploring) Ask Moss where the water should go. Moss measures and marks the spots.
- (More exploring) "How are you feeling?" Fizz answers honestly.

**World change:** the water returns and the camera follows it down to the wheel. The wheel turns and
the mill windows glow. A paddle-wheel souvenir goes in the clubhouse.

### A4. The Lantern Launch (`LanternLaunchScene`)
A group project at dusk. Luma explains that everyone has a job. The child picks one:
- fold the paper (tap the fold lines);
- light the lantern (carry the flame from the post);
- (More exploring) hold the line (let it out bit by bit);
- ring the countdown bell;
- (More exploring) the quiet job: light the path lanterns. This still counts as part of the launch.

The friends do the other jobs, and nobody is left out.

**Complication:** the first launch rises, wobbles, and drifts down onto Pip's head ("Too heavy?").
It's playful, not a failure, and the rules guarantee it happens only once. The group fixes it by
trimming the paper, adding a second balloon, or swapping jobs (Luma refolds it thinner), then tries
again.

**Resolution:** the lantern rises and the club's lanterns fill the evening sky. They stay there
afterwards. Luma: "Every job helped. Even the quiet ones." A lantern souvenir goes in the clubhouse.

All three adventures share `TrailScene`: tap to walk, carrying, friends, checkpoints that survive a
refresh, and a calm ending ("Look around" or "Back to the map"). Each adventure's rules are pure
functions in `src/content/trail/adventures.ts` with unit tests. The tests show that every route can be
finished.

## Game B — Tinker Grove (construction sandbox)

**Verbs:** select, place, connect, rotate, test, undo, rebuild.

- A deterministic **toy-physics** model (circles against segments, force zones). It is not a scientific
  simulator.
- **Parts:** plank ramp, curved track, bouncy mushroom (bumper), leaf fan, block platform, basket,
  spring pad, moss pad (brake), chime bars, spinning log (wheel), plus decorations (flag, flower,
  bell, ribbon).
- **Challenges:** Cloud Mail (soft parcel to a chosen pad), Snail Express (gentle ride with a stable
  arrival), Acorn Crossing (cross the stream; several solutions), Festival Music Machine (trigger a short
  sound sequence).
- **Preferences:** Snail likes a slow ride (arrival speed shown as a gauge with snail and rabbit
  icons). Fizz wants room for a big hat (a clearance zone is drawn). The child can **negotiate** a
  simpler design or make a **different project**.
- **Free build** is always available. There are 12 saved inventions per profile, each with a preview,
  edit, and replay. Undo, reset (with confirmation), and a one-tap test lever.
- **Shared building:** a turn badge and a "pass the tools" button. Solo play is complete.
- **Discovery notes** are marked "Real world" (for example, ramps make things roll faster) or "Wonderwood
  magic" (for example, the breeze-mill blows wind).

## Game C — Picnic Parade (preparation and cooperation)

**Verbs:** knead, combine, arrange, decorate, carry, serve, swap roles, repair.

The kitchen cart is on the left and the picnic blanket is on the right, so the friends and their wishes
stay in view while the child cooks. Content lives in `src/content/picnic/` (pure, unit-tested) and the
scene is `src/game/scenes/picnic/`.

- **Four prep mechanics, each a different action:**
  1. **Dough** (cookies): tap to squish the dough (3 squishes on More help, 5 on More exploring). Watch
     it roll flat, press a cutter, then choose "a little bake" (soft) or "a long bake" (crunchy). Soft
     and crunchy look different in shape detail, not only colour: crunchy cookies have cracks.
  2. **Sandwich stacking**: on More help each filling drops in the middle. On More exploring the child
     taps where to drop it, and a toy balance rule (`dropLayer`) decides whether it stays. A layer that
     lands too far off, or a stack that leans too much, slides off and bounces onto the table. One tap
     pops it back on. There are at most 6 fillings. Three or more makes a big sandwich.
  3. **Juice**: put fruit in the blender (2 on More help, up to 3), blend, choose a big or small cup,
     then tap to pour one glug at a time. Colours mix like paint. Some mixes come out a funny muddy
     colour, which gets its own reaction. Overfilling spills into the saucer, and nothing is lost.
  4. **Decorate**: pick a dish from the tray and a topping (sprinkles, dots, little leaves, or an icing
     swirl). Tap where it goes. The swirl can also be drawn by dragging, but a tap works too.

  Finished dishes go on a three-slot tray. To serve, tap a dish and then a friend. Tapping your own
  avatar keeps it as your own snack.
- **Scenarios (each with a setup step and a social moment):**
  - **Windy Picnic** (Pip hosts). Put things on the flapping blanket corners. Heavy things hold. Light
    things blow away and drift back, with a real-world note. Then choose a windbreak: an umbrella (it
    flips inside out, then Rowan holds it), a cushion wall, or Moss sitting still (More exploring).
    Later Rowan chases a napkin and bumps the tray. He apologises, but his apology doesn't fix
    anything by itself. The child can make it again together with him (Rowan comes to help), say it's
    okay, or say they feel a bit cross (More exploring). Rowan accepts that feeling and offers to help.
  - **Music Picnic** (Fizz hosts with a drum). Seat the friends: tap a friend, then a cushion. Rings
    and icons show which cushions are quiet and which are by the music. If Luma ends up somewhere
    loud, she says so. The child can ask Fizz to play softer, find Luma a quiet seat, or (More
    exploring) ask Luma what would help. Rowan likes being close to the music and can ask to move. A
    seat that already suits a friend means no problem at all, so listening pays off.
  - **Lantern Picnic** (Luma hosts at dusk). Hang the lanterns first. When the child picks the lantern
    cutter, Luma and Fizz both want it. The child can take turns (Fizz waits), make one big cookie
    together to share, offer Fizz a different cutter (Fizz may say "not that one", and that's fine),
    or say "I'd like a turn too" (then everyone takes turns, child first). Moss is watching fireflies
    under the tree. Inviting him gets "not yet, thank you". He may come over by himself later, and he
    joins the parade either way.
- **Preferences** are written per picnic and shown in a bubble as a picture of the dish the friend
  wants, plus a seat icon when it matters. They are never derived from species or appearance: the same
  friend wants different things on different days (this is unit-tested).
- **No clock.** A dish that isn't quite right stays on the tray. The friend says what they'd like ("I
  like soft cookies best"). The child can make another, offer it to a friend who wants it, keep it,
  or (More exploring) ask "could you try it?". Some friends will try it and some politely won't.
  Friends can be flexible about details they don't mind.
- **The child's needs count.** Your own snack is yours. When Pip asks for a bite, "No thanks, it's
  mine" gets "Okay! Thanks for telling me."
- **Ending.** The bell appears once anyone has something, so nobody is forced to satisfy every wish.
  Ringing it takes a picnic photo (saved to the album, 12 per player, with view, show in the
  clubhouse, and delete with confirmation). Then everyone eats, and a short parade puts bunting up.
  Each finished picnic leaves something behind in the meadow (an umbrella, a drum, lanterns).
- **Sibling mode** (Play together button). Pick the other player. One is chef, one is server, and
  the turn badge shows whose turn it is. Making a dish passes the turn to the server; serving passes it
  back. "Swap jobs" swaps them. "My helper left" asks who is still playing, and that picnic's helper
  (never one of the guests) takes the other job. The helper serves dishes to friends who want them, or
  makes whatever the child picks. Nothing depends on a second player.

## Game D — Story Stage (puppet theater)

A tiny theatre in a tree stump. Content is in `src/content/stage/` (pure, unit-tested). The scene is
`src/game/scenes/stage/` and playback is `src/game/displays/StagePlayer.ts`.

- **What's on offer:** 5 backdrops (Forest, Pond, Moon Sky, Lantern Oak, an empty stage), 7 puppets (the
  five friends, the child's own explorer, and Newt, a spare puppet anyone can be), and 14 props. Eight
  of the props switch on and stay on when used: an invitation that opens, a cake whose candles light, a
  chest that opens, an umbrella that opens, a lantern that lights, a map that unrolls, a telescope that
  extends, a flower that blooms. The rest do a little animation (a ball bounces, a drum booms, an
  invention puffs).
- **Arranging:** the left toolbar adds a backdrop, puppets, props, or sounds from big picture drawers.
  Tap a puppet to pick it. Then drag it, or tap the stage floor and it walks there (no dragging
  needed). Arrow keys move it too. The picked puppet's bar has actions (wave, jump, dance, hide; the
  full stage adds eight more), faces drawn as that puppet's own face, lines, turn around, take off,
  and on the full stage "what do they want?" (intentions).
- **Acting it out:** press the red button and act. The stage records game events only: moves, actions,
  lines, faces, turns, and sounds. There is no microphone or camera. Long pauses are shortened so
  playback never drags. A tape bar shows how much room is left (45 seconds per scene). Acting again
  asks first, with "keep what I made" as the safe choice.
- **Lines** come from a curated library of 28 short lines, each with an icon (8 on the simple strip).
  Any puppet can say any line, in its own voice, with a caption.
- **More help** uses a three-scene strip. Untouched later scenes keep following on from the scene
  before, so the cast is already in place. **More exploring** allows up to six scenes, reordering by
  adding and removing, two alternate endings, and intentions shown as thought bubbles. Either child can
  switch to the simpler strip at any time.
- **Starters** (each plays its opening and stops there): an invitation arrives at the wrong house; two
  explorers want different adventures; an invention does something unexpected; someone wants to join a
  game. There is also an empty stage. Nothing scores a moral or requires a happy ending; "The end!" is
  just one of the lines.
- **Watching:** play one scene, or the whole show with curtains between scenes. If there are alternate
  endings, the audience picks one at the end; then everyone bows.
- **Saving:** 12 stories per player on a shelf with previews: watch, change, show in the clubhouse,
  or throw away (asks first). The clubhouse poster is the opening scene in miniature, and tapping it
  plays that scene. A grown-up can optionally type a title in the grown-up area. It's read out before
  the show and is never needed to make a story.

## Emotional and social rules (enforced in content review)

- All feelings are allowed. A facial expression is a clue, so the child can ask instead of guessing.
- Both the child and NPCs have boundaries. Declining is fine, and quiet participation counts.
- No friendship meter, no empathy score, no rankings, and no sibling comparison.
- No forced eye contact, disclosures, or "correct" emotion copying. No humiliation, no threats of
  isolation, and no distress used to compel action.
- Misunderstandings can always be repaired. No permanent labels.

## Engagement and stopping

- **Rewards** are earned and predictable: souvenirs and displays. Social responses are never currency.
- **None of these:** streaks, loot boxes, purchases, ads, energy, expiring rewards, notifications,
  or characters who are sad that you left.
- **Save and finish** is always available. A short closing sequence shows what was made, and then the
  game rests on a calm screen. Next time, the game resumes at the last place.
- **Caregiver reminders** (off or 10–45 min) are shown with an immediate stop option. An optional grace
  period is bounded (2 or 5 minutes) and cannot be chained.

## Design context sources

The brief lists the UNICEF RITEC Design Toolbox, AAP HealthyChildren *Shyness in Children*, Harvard
Center on the Developing Child *Brain-Building Through Play*, and the Phaser docs. **This build
environment's network policy blocked all four sites**, so they could not be inspected here. The design
uses the brief's own summary of their implications:

- Autonomy and competence come from real choices and visible mastery.
- Children get time to warm up and can participate gradually.
- Off-screen suggestions are age-banded play invitations.

None of these sources validate this product or promise outcomes. The Phaser API was verified from the
installed `phaser@4.2.1` package's bundled skills, type definitions, and source.

## Scope boundaries (v1)

Browser only. No backend, accounts, payments, or online features. Narration uses an on-device speech
voice only when the browser reports a local voice. Otherwise the game uses captions and visual
demonstrations.
