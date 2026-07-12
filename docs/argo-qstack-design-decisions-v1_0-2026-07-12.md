# QStack visual and interaction identity: locked decisions
Version 1.0, July 12, 2026. Author: Mohales Deis (mohalesdeis@gmail.com).

This records the product and visual decisions locked during the QStack
visual identity pass (`tasks/todo.md`, Theme 1), each with the reasoning
behind it, not just the conclusion. These are decisions, not a design
system: corrections surface as a new version of this file, not by
reopening this one.

## QDeck is a first-class entity

A QDeck has its own identity, its own star count, and its own membership
list. The relationship to a QStack is one-to-many: a QStack belongs to at
most one QDeck. Adding a stack that already lives in another deck is a
copy, not a shared reference, so the deck it already belonged to keeps
its own instance untouched.

Two alternatives were considered and rejected. Derived grouping, where a
deck is just a shared tag or computed label on a set of stacks with no
entity of its own, was rejected because a derived grouping can never be
independently starred, shared, or forked as a unit. That is fatal given
marketplace plans: a QDeck has to be a marketplace-listable object in its
own right, the same way a QStack already is, and a derived label cannot
carry that weight. Many-to-many membership, where a stack could belong to
several decks at once, was rejected for lack of any demonstrated use
case. One-to-many is also the safer base to build from: migrating from
one-to-many to many-to-many later, if a real need appears, is a clean
addition, while collapsing an existing many-to-many relationship back
down would be a lossy migration nobody wants to run.

## Stage is real data, not a parsed string

Stage lives as a real field on the stack record. It is never parsed or
inferred from the stack's title text. Every stage pill in the interface,
the QDeck page's pipeline view, and any future customizable pipeline
(stage sequences that differ by department or by position) all depend on
stage being queryable, filterable data from day one. If stage were baked
into a title string instead, none of that would be possible without
fragile string parsing, and the entire idea of a deck reading as a
pipeline would be structurally out of reach.

## The seal and the fleece edge mean different things

The fleece edge means in rotation. It is a status: reversible, and it
disappears the moment the role closes. The gold seal means twenty-five
stars or more. It is an achievement: durable, and it does not go away
when the role closes. A card can carry both at once, and when it does
that correctly reads as in use now, and has earned its place.

The original design collapsed both markers onto a single OR condition,
stars at or above twenty-five or in rotation, driving the same visual
treatment. That mistake matters because it merged two genuinely different
kinds of meaning, a temporary operational state and a permanent earned
mark, into one signal that ended up meaning only "something good is
happening here." That is not a meaning. Splitting the trigger condition
was the fix, not a restyle.

## Star integrity is enforced by the database

One star per user per stack, enforced by a unique constraint in the
database, never by UI logic alone. UI-only enforcement can be bypassed by
a direct API call, a race condition, or the same user starring from two
open tabs, and any of those would let a single person's opinion count
more than once.

This is load-bearing, not cosmetic, because the gold seal's
twenty-five-star threshold is meaningless if stars can be spammed or
duplicated. The credibility of that achievement mark depends entirely on
each star representing one real, distinct person's endorsement. A count
that looks authoritative but is not backed by real integrity underneath
it is worse than no count at all.

## Gold never carries meaning alone

Gold on cream measures near 2.1 to 1 contrast, which fails the 3 to 1
standard required for a meaningful interface element, not decoration.
Darkening the gold to fix that would mean losing the locked palette, so
the fix is architectural instead: gold is always decorative
reinforcement of something already legible in dark ink, never the sole
carrier of a state.

Concretely, the star count renders as an ink numeral, not gold text. The
status renders as a plain ink word inside a button, not a gold highlight
standing alone. The seal carries an actual text tooltip, not just a gold
glyph a reader has to decode. The test this has to pass: nothing is lost
if the gold cannot be perceived at all, whether from color blindness, a
poorly calibrated screen, or bad lighting, because every gold element has
a fully legible ink-based twin carrying the same information.

## A QDeck opens its own page

A hover panel cannot do two jobs at once: reveal what is inside a deck,
and let someone manage it. It also fails outright at real scale, since
twenty stacks in one deck cannot be browsed usefully inside a small hover
panel. The fix splits those two jobs across two different surfaces
instead of asking one surface to do both.

On the canvas, unfurling a deck is a purely physical, non-navigating
gesture: a hover or a focused Enter reveals a glimpse of what is inside
and nothing more, no click required. Clicking a deck's title, in any
view, opens a dedicated page instead, where the real work lives: every
member rendered as a full card in stage order, reordering stacks within
the deck, removing a stack from the deck (which makes it loose again, it
is never deleted), and adding an existing loose stack to the deck.

## Canvas position is spatial memory only

Canvas x and y coordinates exist purely as a spatial memory aid for the
person arranging their own library. They must never feed ordering,
ranking, sorting, or any scored or assessed output, now or in any future
pass.

This ties directly to a hard constraint already governing the rest of
the product. The moment a coordinate on a canvas could influence a ranked
output, even indirectly, an unaudited and unexplainable input would exist
inside an assessment system, which is precisely the class of thing
Argo's hard constraints exist to prevent: every scoring or assessment
feature carries an audit trail and a human override path from its first
migration, and a canvas position has neither. It cannot be allowed
anywhere near a scored outcome.

## The approved prototype

`prototypes/qstack-library/06-fleece-ledger-deckpage.html`, direction 02,
The Fleece Ledger, was chosen by independent three-way consensus between
Mo, the advisory chat, and Claude Code's own QA review, each arriving at
the same direction separately.
