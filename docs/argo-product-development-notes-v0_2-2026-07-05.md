# Argo Product Development Notes / Backlog
**v0.2 · July 5, 2026 · Supersedes v0.1**

This version folds in the synthesis pass across eight of Mo's scattered
notes (2018 to 2020, "Pop Interview" era, plus the BHAG and Contagious
brainstorm files). Two things changed from v0.1:

1. **The core object is now called a QStack, not a Deck.** QStack (short
   for Question Stack) is Mo's own original term, in the 2019 to 2020
   notes as "Q-Stacks." "Deck" was an interim word used only because the
   original name had been temporarily forgotten. QStack is canonical from
   here. Card and deck stay as visual metaphors (a QStack still looks and
   behaves like a stack of cards), but the object is a QStack.
2. A large amount of product thinking that predates this sprint got
   pulled forward from the raw notes, so it's clear which ideas are
   actually six-plus years old and load-bearing versus new this week.

Everything not directly about the Argo product (fundraising strategy,
hiring philosophy, VC frameworks, org design, the reading list) is
captured separately at the bottom in Section 10, the parking lot, so it's
not lost but also not confused with product spec. A short kill list of
what was deliberately dropped is in Section 11.

More notes are still coming. Add to this document, don't replace it.

---

## 1. Core Object Model: QStacks

The interview question set is a **QStack** (Question Stack), the same
mental model as a stack of cards. A QStack moves from high-level to
granular: broad category down to a specific question, its rubric, and its
follow-ups. This is the central object Argo is organized around, not a
feature bolted onto some other primary structure. Everything else in this
document (surfaces, marketplace, sharing, intelligence) is built around a
QStack being the unit that gets created, viewed, organized, shared,
starred, and sold.

This is not a new idea. It's in Mo's 2019 to 2020 notes verbatim as
"Trello/Kanban like organizing of Q-Stacks to follow a user's recruiting
flow," which means the QStack-as-Kanban-card concept and the name both
predate this sprint by six years. Worth stating plainly because it means
the current vision isn't a fresh pivot, it's the crystallization of
something that's been circling for a long time.

## 2. Surfaces

**2.1 Navigation.** A side panel for getting around the app.

**2.2 Two ways to view a collection of QStacks.** A standard list view,
and a graphical "stack view" where QStacks render as stacked cards. Same
underlying data, two surfaces.

**2.3 Direct manipulation.** Shuffle, reorder, and organize QStacks with
drag and drop. QStacks organize Kanban-style, grouped per role or per job
(a "Customer Service Rep Screening QStack" next to an "In-Person
Interview QStack," moved between columns the way a Kanban card moves
between stages). The 2020 note flagged its own open question here, "would
I really want a kanban styled ATS UI?", and the answer in 2026 is that
this is organizing the interview layer, not trying to be an applicant
tracking system (ATS), so the concern doesn't apply the way it did then.

**2.4 Opening a QStack.** Two nested views:
1. **Standard view.** All questions, rubrics, potential follow-up
   questions, and rating systems, visible at once.
2. **Detail view.** A dropdown per question for deeper context, why this
   question matters, what it's actually screening for, so the standard
   view doesn't get bloated with explanation nobody needs most of the
   time.

QStacks carry a named methodology (structured behavioral, STAR
[Situation, Task, Action, Result], case-based, and so on). The plan is to
eventually ingest a real range of interviewing methodologies into the
system using deep research, so QStacks aren't just a pile of questions
with no theory behind them.

**2.5 Interview mode, the live surface.** When it's time to actually
interview, the QStack unfurls into a live mode: real-time answer and note
entry against each question as the interview happens, not after. This is
the Locality-First surface from the build philosophy in its purest form,
the scorecard, notes field, and next question live in the same visual
neighborhood as the question being answered, because a control that's one
click away from the moment it's needed is a control that fails during a
live interview.

## 3. In-Interview Interactions (from the original feature notes)

Pulled forward from `Pop_Interview_4`, these were specced years ago and
still fit:

1. **@ mentions.** Directly bring a specific team member's attention to a
   question or a response with an @ mention, the same interaction pattern
   people already know from Slack and every modern collaboration tool.
2. **Highlighting and starring of responses.** Mark a candidate's
   specific answer as notable, good or concerning, in the moment, so the
   candidate brief later isn't reconstructed from memory.
3. **Running-late notification.** A one-button notification to the
   candidate that the interviewer is running late, two to three clicks to
   set by how much, default five minutes. Email is free; SMS (short
   message service) carries a per-message cost and would need an
   admin-level cap. Minor, but it's a real Locality-First courtesy
   feature and it's already thought through, so it's logged.

## 4. Marketplace and Social Layer

**4.1 Company QStacks.** QStacks themed around specific real companies (a
"Netflix QStack," for example), sourced from public information about how
those companies actually interview.

**4.2 Marketplace, clone and remix.** Public, shareable, downloadable
QStacks, similar in spirit to cloning a repo, or how Lovable lets someone
remix a public build from a builder's profile. This is also in the old
notes as "Argo Ark, the first and only crowdsourced HR platform," and as
"every time a user creates a new question, they can opt-in to contribute
to the database and share and swap." The crowdsourced-contribution
mechanic is the supply side of the marketplace, and it's another idea
that predates this sprint.

**4.3 Public creator profiles.** Interviewers and recruiters get a public
profile. The explicit intent, stated the same way across both the old
notes and this week's vision, is to make this feel personal and a little
special, a place that's theirs, which nothing in the current ATS category
does. Profiles support short posts, old-Twitter-length, not
LinkedIn-length. Daily observations and what someone learned interviewing
or recruiting, not essays. The old notes add texture worth keeping: a
profile picture, and a few display-name font options that "show
personality," small touches that signal this is a place for a person, not
a database record.

**4.4 Stars.** A GitHub-style star and like system, scoped to individual
QStacks. The explicit model is GitHub's own virality mechanic: a QStack
with 200 stars reads as obviously worth downloading, and that signal
drives the platform's own discovery, the same way star count drives repo
discovery on GitHub.

**4.5 Follow and notify.** Follow specific recruiters or talent
acquisition people and get notified when they release a new QStack. The
target emotional register, in Mo's own words: "someone screaming, 'Oh my
god, XYZ just dropped a new QStack, we must download it now.'"

**4.6 Contribution recognition.** From the old notes, worth building into
the social layer: when an early adopter contributes a question that gets
accepted into the shared database, send them a "contribution stamp," a
snapshot of the question with their name and the date. This is cheap,
it's a genuine status reward, and it feeds the "make contributors feel
like part-owners" strategy that runs through every version of these
notes.

## 5. Monetization

**5.1 Paid and limited-time QStacks.** Some QStacks are gated behind a
one-time fee (a "Netflix QStack" for $2 was the working example) or a
limited availability window. Real, named-company QStacks, like a Google
QStack built by an actual talent acquisition team, are a plausible
premium category. Creators can set their own rates, likely with a
platform-imposed cap, and the platform takes a commission on top of
whatever the creator earns.

**[DECISION NEEDED, Kellan's call, timeline-driven]** Real payment
processing, creator payouts, and commission splitting is a materially
bigger build than the rest of this document, closer to standing up a
second product than a feature of this one. With well under 36 hours of
Fable access left, the recommendation is to build the entire free layer
(QStacks, stars, follows, public profiles, sharing) for real, and treat
the paid tier as UI only in this pass, a visible price tag and a "buy"
button that doesn't yet move real money, rather than wiring actual
payment processing into a build this compressed. Scope call, not caution.

**5.2 IP protection, explicitly deprioritized, on purpose.** Mo's own
framing: the platform won't hard-gatekeep QStack content. Someone who
buys or accesses a QStack could screenshot it or transcribe it with an AI
tool and rebuild it elsewhere, even if the QStack itself stays locked to
the platform. This is a known, accepted risk at this stage, prioritizing
full functionality and a genuinely great experience over content
protection. On the record as a decision, not an oversight.

## 6. Intelligence Layer

**6.1 Capture.** During a live interview conducted through the platform,
similar in spirit to how Granola and comparable tools work, Argo can
capture audio from the interviewer's computer during a call (Zoom or
similar). No hardware devices (no Plaud-style recorder) in this phase;
computer-based capture only, with in-person capture as a possible later
expansion.

**6.2 Both sides captured.** Both the interviewee's responses and the
interviewer's own notes and remarks get captured, not just the
candidate's side.

**6.3 Candidate brief.** The session gets summarized into a candidate
brief: exportable, and shareable both inside and outside the platform (as
a PDF [Portable Document Format], among other formats).

**[NOTED, Priya and Nadia's territory, framed as a build item, not a
gate]** Recording a real person's voice during an interview crosses into
two-party consent recording law in a real number of US states. This isn't
a hypothetical compliance question, it's a live legal exposure tied
directly to this specific feature. The fix is cheap and costs the
timeline nothing: a consent step at the start of interview mode, before
recording starts, confirming all parties agree to being recorded and that
responses may be summarized and shared with the hiring team. That's a UI
element and a stored consent flag in the schema, not a review process.
Build it into interview mode from the first version, because retrofitting
consent capture after real interviews have already happened without it is
the kind of problem that can't be fixed after the fact.

## 7. PLG Land-and-Expand Loop

The candidate brief is also the growth mechanic. When someone shares a
brief or its link, that share acts as an invite:

1. An external recipient (someone outside the org, or a colleague without
   an account) can view the shared content without an account.
2. To interact with it (comment, save, take any action beyond reading),
   they're prompted to create a free account.
3. The prompt is deliberately minimal: first name and email only. Sample
   framing: "Kathy invited you to view the candidate responses. Create a
   free account in five seconds to view."

This is the clearest example in the whole vision of GTM (go-to-market)
being built directly into product functionality rather than sitting on
top of it as a separate marketing layer, and the old notes back this up
repeatedly: "push value up the funnel," "must they sign up?", "can it
take 1, 2, or 3 less steps?", "low touch activation and onboarding." The
instinct to strip signup friction to almost nothing is consistent across
six years of Mo's own thinking. Treat this loop as a first-class PRD
requirement, not an add-on.

## 8. Product Principles Worth Encoding (from the old notes)

These are durable design and product convictions that showed up
repeatedly across the notes and should shape how the whole thing gets
built, not just individual features:

1. **Do one thing extremely well.** "We need to focus on one thing we do
   extremely well (interview questions database)." The whole positioning
   depends on Argo being unmistakably the best at the interview layer,
   not a broad mediocre suite. Every scope decision should be tested
   against this.
2. **Additive by use.** "With every use or interaction point, there is
   input data that makes the platform even more useful." Every
   interview run, every contributed question, every star should make the
   product better for the next user. This is the data-flywheel argument
   for why the crowdsourced database is a moat, not just a feature.
3. **Delight at every turn.** "Find a way to delight at every turn,
   unique message at signup and sign out." "Sleek, boring in appearance
   but a pure pleasure in design, interaction, and use." This is the same
   consumer-grade-craft-in-a-B2B-tool instinct that's now in the business
   model doc's visual identity section, and it's been consistent since
   2019.
4. **Four key activities to stick.** "Users have to get to 4 key
   activities to usually stick." Worth defining, early, what Argo's four
   activation activities actually are, since the whole onboarding and PLG
   design should be built to get a new user to those four things with the
   least friction possible.
5. **Excavate feature requests five layers deep.** When a user asks for a
   feature, dig past the surface request to the real underlying pain, and
   check whether that deeper need connects to a larger pool of users.
   This is Teresa-Torres-style continuous discovery stated in Mo's own
   words years before this sprint framed it that way, and it's exactly
   the discipline Marcus and Priya are here to enforce.

## 9. Positioning and Narrative (feeds the business model doc)

Captured here from the notes, to be folded into the business model and
positioning document rather than living here long-term:

1. **The BHAG (Big Hairy Audacious Goal):** "to be the Salesforce or
   Microsoft of HR and People Tech, but more of a pleasure to use." Also
   framed as "the OS of People Ops" and "the operating system of People
   Ops."
2. **The radical message.** The notes explicitly reference the pattern of
   Salesforce ("No More Software"), Drift ("No More Forms"), Slack ("Kill
   Emails") and ask what Argo's version is. A working candidate from the
   notes: "We're unbundling from the ATS." Worth developing into a real
   one-line radical message.
3. **The verified-question-bank story, already drafted.** The notes
   contain finished-sounding marketing language for exactly the
   retrieval-based verification now planned: filtering tens of thousands
   of questions down to a top-performing set across industries, roles,
   functions, and job levels, with expert review and years of refinement.
   This is the narrative spine for the "verified, not just fluent" value
   proposition. It should be revisited for honesty (the specific numbers
   were aspirational, not real), but the shape of the story is right.
4. **"Rate My Interview Questions" and "Quality of Hire calculator"**
   as lead-magnet concepts, both consistent with the PLG motion and worth
   keeping in the GTM pipeline.

## 10. Parking Lot: Not Product Spec, Kept on Purpose

None of this belongs in the PRD or in a Fable prompt. It's real thinking
worth keeping, filed here so it's captured but can't contaminate the
build. Most of it is fundraising, hiring, org design, and long-range
company-building, relevant someday, irrelevant to shipping a first
version of the product.

1. **Fundraising and VC frameworks.** Extensive notes on Vinod Khosla,
   Jason Lemkin, Christoph Janz, Cowboy Ventures, Satya Patel, unit
   economics benchmarks, SAFE (Simple Agreement for Future Equity)
   structures, board composition. Useful when Argo actually raises. Not
   now.
2. **Hiring and team-building philosophy.** The "recruit your Argonauts"
   hiring approach, the rocket-booster analogy for early hires, the
   "acquire the diversity of failure experiences" thesis, the
   "interview me to see if I deserve to be CEO" idea. This is Mo's
   philosophy of building a company, and it's genuinely good, but it's
   about running Poprouser and Argo the companies, not building Argo the
   product.
3. **Old technical stack notes.** A 2019-era stack list (Node, MongoDB,
   AWS, and so on) that is explicitly obsolete and should not influence
   the greenfield 2026 build. Logged only so it's clearly marked as dead,
   not accidentally treated as a constraint.
4. **Marketing campaign ideas.** "Dear Microsoft"-style love letters to
   clients, invented holidays, the "Anti-Persona" campaign, podcast and
   newsletter concepts, influencer outreach. Real GTM material for when
   there's a product to market. Parked.
5. **Contact names worth keeping:** Michael Litt (Vidyard), Patrick
   Barnes (formerly Advocately, for old email templates). Logged as
   people, not tasks.

## 11. Kill List: Deliberately Dropped

Named so nothing gets silently discarded. If any of these should come
back, say so:

1. The RPG-map / avatar-walking-to-portals interface overlay idea. Fun,
   but it fights the "sleek and professional B2B" direction and the PLG
   simplicity goal. Dropped unless it's a much later Easter-egg-tier
   flourish.
2. The "Golden Phalanx" internal crisis-team concept. Company-operations
   idea, not a product feature, and not near-term. Dropped from product
   scope.
3. The internal-Reddit / internal-Quora / MOOC-directory / gamified-RPG
   learning platform. This is a whole separate product. It contradicts
   principle 8.1 (do one thing extremely well). Dropped from Argo's
   scope, worth revisiting only as a distant, separate idea.
4. Assorted alternate product names (Elixir, Balm, Candid, Kure, DaQCo,
   The Question Company). Argo won. Logged as dead.

## 12. Source

Eight of Mo's scattered notes, 2018 to 2020, synthesized July 5, 2026:
`Contagious_Notes.md`, `I'm not here to give purpose.md`, `PI_-_Early_
Adopter.md`, `Try_best_to_hire_from_wn_network.md`, `Whats_my_ultimate_
BHAG_vision.md`, `Pop_Interview_2.md`, `Pop_Interview_4_-_Argo.md`,
`Pop_Interview_5_-_Argo.md`. Plus this conversation for the QStack naming
correction and the synthesis structure.

---

*v0.2. Add to this document as more GTM, sales, and design notes come in,
rather than starting a second backlog file. Section 9 material is queued
to move into the business model and positioning doc on its next revision.*
