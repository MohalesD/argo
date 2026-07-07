# Mo's Design and Voice Philosophy (Production Builds)

Added July 3, 2026, replacing the nano-app assumption in
`build-philosophy.md` for anything that isn't a small single-page tool.
This file governs interaction design and voice for RecruiterOS, Argo,
CrackedHR, and any other build meant for real, paying, or externally
visible users.

**How to use this file, read this part first:** this is Mo's point of
view, developed through real product work, not a compliance checklist.
Fable 5 should consult it the way a strong designer consults a design
system they respect: as a starting position with real reasoning behind
it, open to being overridden when the specific situation calls for
something different. If a task doesn't clearly fall under a rule here,
default to Fable 5's own judgment rather than searching for a rule to
force-fit. The goal is a product that feels like Mo's taste, not a
product built by someone executing a checklist.

## Contents

1. Locality-First Interaction Design Philosophy (Mo's own doctrine, full
   text, sections 1 to 23 below). This is the primary reference. It
   covers control placement, interaction travel cost, redundancy rules,
   anti-patterns, AI-native interaction rules, accessibility, and a
   reusable review checklist.
2. Voice and microcopy principles (distilled, de-branded). Extracted from
   Mo's Poprouser voice guide, with anything Poprouser-brand-specific
   removed. Covers tone, error and empty states, and the no-blame
   framework.
3. General microcopy doctrine, with a sourcing caveat. Extracted from a
   third-party microcopy playbook Mo has referenced across projects,
   with a note on which parts are well-established practice versus
   uncited anecdotes.

---

# Part 1: Locality-First Interaction Design Philosophy

*Full text follows, unedited from Mo's original v1.0 document
(conceptualized April 11, 2026, created July 3, 2026). This is Mo's own
authored doctrine. Treat it as the authoritative source; if any summary
elsewhere in Mo's other files disagrees with this, this file wins.*

---
title: "The Locality-First Interaction Design Philosophy"
subtitle: "A cross-project doctrine for control-to-object proximity, interaction travel cost, contextual continuity, and operational UX"
author: "Mohales Deis"
conceptualized: "April 11, 2026"
created: "July 3, 2026"
last_updated: "July 3, 2026"
version: "1.0"
status: "Foundational cross-project design doctrine"
---

# The Locality-First Interaction Design Philosophy

## A cross-project doctrine for control-to-object proximity, interaction travel cost, contextual continuity, and operational UX

**Author:** Mohales Deis  
**Conceptualized:** April 11, 2026  
**Created:** July 3, 2026  
**Last updated:** July 3, 2026  
**Version:** 1.0  

> **Date note:** The underlying design instinct developed through earlier product work. April 11, 2026 is used as the conceptualization date because that is when the principles of Cost of Distance and Locality of Action were first formally codified as cross-surface design rules in Recruiter OS.

---

## 1. Purpose

This document defines a reusable interaction design philosophy for software products built by or under the direction of Mohales Deis.

It is intended to carry across:

- recruiter and HR technology
- operational software
- AI-assisted products
- internal tools
- client portals
- dashboards
- workflow applications
- mobile and responsive web products
- future products whose domains have not yet been defined

The central idea is simple:

> **A control should be placed as close as practical to the object, decision, or consequence it affects.**

The deeper philosophy is broader:

> **Every unit of physical movement, visual search, cognitive interpretation, context switching, and recovery adds interaction travel cost. Good design reduces that total cost without sacrificing clarity, safety, accessibility, or user control.**

This is not a rule that every button must sit directly beside every object. It is a decision system for choosing where actions belong, when redundant paths are helpful, when duplication becomes noise, how transitions should preserve context, and how a product should feel fast without becoming twitchy.

---

## 2. Executive Thesis

Most friction is not caused by one dramatic design failure. It is created by dozens of small decisions:

- a close control placed at the edge of the viewport instead of the edge of the content
- an Edit action separated from the record it changes
- a Clear action placed far from the filters it clears
- a local task that sends the user to another page
- a success message that appears far from the change
- a count that looks actionable but does nothing
- two nearby actions with the same label but unclear scope
- a hidden hover action with no click, keyboard, or touch equivalent
- a modal that preserves the page visually but loses the user’s working context functionally

Each decision seems small. Together, they determine whether a product feels fluid or exhausting.

The Locality-First philosophy treats these micro-decisions as part of the product’s operating quality. Speed is not only server response time. Speed is also:

- how quickly the user understands what can be done
- how little the pointer or finger must travel
- how few regions the eyes must scan
- how confidently the user can predict the scope of an action
- how rarely the user must remember information from another surface
- how easily the user can return to the exact context they left
- how clearly the interface confirms that the intended change occurred

The design goal is therefore not merely fewer clicks.

The goal is **lower total interaction travel cost**.

---

## 3. Core Definitions

### 3.1 Control-to-object proximity

**Control-to-object proximity** is the degree to which an action is physically and conceptually located near the object it affects.

Examples:

- Optimize belongs near the job description it will revise.
- Copy belongs inside or immediately beside the artifact it will copy.
- Add Candidate belongs inside the Job Candidates surface.
- Save Changes belongs at the end of the form being changed.
- A modal close control belongs to the modal or media container, not an unrelated corner of the viewport.

Proximity has two dimensions:

1. **Spatial proximity**, how physically close the control is.
2. **Semantic proximity**, how clearly the control’s placement communicates what it affects.

A control can be physically close but semantically ambiguous. For example, two nearby Optimize buttons can still be poor design if one affects the whole record and the other affects only the description, but neither explains the difference.

### 3.2 Locality of action

**Locality of action** means that a task should begin, progress, and complete within the surface that provides the task’s context whenever practical.

Examples:

- Creating a Job from a Company dossier should open an in-place creation dialog with the Company already selected.
- Adding Candidates from a Job should open a Job-scoped picker over the Job surface.
- Adding a Job from a Candidate should open a Candidate-scoped picker over the Candidate surface.
- Editing content should occur on or over the content surface, not after an unnecessary route change.

Locality does not forbid navigation. It requires navigation to earn its cost.

### 3.3 Interaction travel cost

**Interaction travel cost** is the total burden required to move from intent to successful completion.

It includes:

- pointer, finger, or hand movement
- eye movement and visual search
- interpretation of action scope
- working memory demands
- route changes and context switching
- waiting and loading
- error correction
- recovery after interruption
- effort required to return to the prior context

The useful question is not only, “How many clicks does this take?”

The better question is:

> **How much total travel must the user complete, physically and mentally, before the task is safely done?**

### 3.4 Cost of distance

**Cost of distance** is the portion of interaction travel cost created by separation between:

- a control and its object
- related controls
- a trigger and its feedback
- a source and its destination
- a detail and the context needed to interpret it
- an origin surface and the route back to it

Distance is not measured only in pixels. A one-click route to another page may carry more cost than a longer pointer movement inside the current page because it creates context loss.

### 3.5 Action geography

**Action geography** is the intentional placement of controls across a page, panel, drawer, modal, or workflow.

It asks:

- Which region owns the action?
- What does the user believe the action will affect?
- Is the action local, page-wide, or application-wide?
- Are related actions grouped together?
- Does the layout force repeated travel across axes or screen regions?
- Is the primary action where the user’s attention naturally ends?

### 3.6 Scope legibility

**Scope legibility** is how clearly an action communicates the size and boundary of its effect.

Examples:

- Optimize beside a description implies description-level scope.
- Edit Profile in a record header implies record-level scope.
- Save Workspace in Settings implies workspace-level scope.
- Apply Selected in a comparison panel implies the action affects reviewed selections, not the whole page.

Local placement is valuable partly because it makes scope legible without requiring extra copy.

### 3.7 Contextual continuity

**Contextual continuity** is the preservation of the user’s origin, current task, and return path across surfaces.

It includes:

- opening local workflows in place
- carrying return context when navigation is necessary
- returning to the exact tab, filter, record, or scroll position when practical
- preserving unsaved selections during local search or pagination
- keeping briefings, drafts, and review states stable across navigation

### 3.8 Intent-sensitive redundancy

**Intent-sensitive redundancy** is the deliberate provision of more than one route to the same destination when each route reduces travel from a different point of attention.

Useful redundancy:

- Candidate count in a tab and Candidate count in a right rail both open the same Candidate surface.
- A Company name in a header and a Company card in the companion rail both open the Company dossier.
- A row click and a visible open icon both open the same detail view.

Harmful redundancy:

- Two nearby Optimize buttons with the same label and no meaningful difference in scope.
- Multiple Save actions that can produce inconsistent results.
- Duplicate destructive actions with different confirmation behavior.

The principle is:

> **Duplicate navigation when it lowers travel from distinct attention zones. Avoid duplicate mutation controls when they create scope ambiguity or inconsistent behavior.**

---

## 4. The Locality-First Design Laws

### Law 1: Place the action near the consequence

The user should not have to infer which object an action affects.

The closer the action is to its consequence, the more the interface can communicate through structure rather than explanation.

### Law 2: Let local controls outrank global controls

When a task affects one object, prefer a local control. Use a page-level or global control only when the action truly affects the page, collection, or application.

A global control should not exist merely because the header has empty space.

### Law 3: Group related controls into one action neighborhood

Filters, clear actions, saved views, and filter feedback should share a visual band.

Review choices, Apply, Dismiss, and comparison mode should share a review toolbar.

Form navigation, validation, and submission should feel like one workflow, not unrelated pieces scattered across the page.

### Law 4: Navigation must earn its cost

Do not move the user to another page for a task that can be completed safely in context.

Route changes are appropriate when:

- the destination is a full operating surface
- the task requires substantially more space or context
- the destination has its own durable URL or collaboration value
- staying local would create a cramped or unstable experience

When navigation is necessary, preserve a contextual return path.

### Law 5: Put exits on the container being exited

Close, Cancel, Dismiss, and Back controls should be attached to the surface they affect.

A media viewer’s close control should be at the media or viewer container edge. A small image centered in a large overlay should not force the user to travel to the viewport corner to close it.

The user’s attention is on the content. The exit should be in the same attention field.

### Law 6: Feedback returns to the source of action

Success, failure, loading, and changed-state feedback should appear near the trigger or affected object whenever possible.

Examples:

- A Copy icon changes to a checkmark locally.
- A refreshed briefing shows a compact updated indicator inside the briefing.
- An applied field change updates the field and nearby state.
- A validation error appears at the field, not only in a distant toast.

Toasts remain useful for cross-surface or durable confirmation, but should not be the only signal for a local change.

### Law 7: Preserve spatial memory

Users learn where things live. Stable action placement reduces search cost over time.

Repeated patterns should retain:

- the same action order
- the same icon meaning
- the same placement relationship
- the same keyboard behavior
- the same close and cancel conventions

Consistency is not visual sameness for its own sake. It protects learned movement.

### Law 8: Locality must survive responsive layout changes

On smaller screens, controls may stack or move, but their relationship to the object must remain clear.

A description action that sits at the description header on desktop should remain attached to that section on mobile. It should not migrate to a distant global menu solely because the layout narrowed.

### Law 9: Never rely on hover alone

Hover can accelerate desktop workflows, but it cannot be the only way to reveal or operate an action.

Every high-frequency control must also support:

- click or tap
- keyboard focus
- visible focus treatment
- clean close behavior
- an understandable non-hover state when the action is important

### Law 10: Every visible element must earn its surface area

Metadata should be actionable, informative, or visually clarifying.

A status chip with no way to change or inspect the status may be dead metadata. A candidate count that cannot open the Candidate surface wastes an opportunity. A decorative action row that does not move work forward adds visual travel without operational value.

---

## 5. A Model for Interaction Travel Cost

This philosophy uses the following heuristic model:

```text
Total Interaction Travel Cost
=
Motor Distance
+ Visual Search
+ Scope Interpretation
+ Context Switching
+ Working Memory
+ Waiting
+ Error Recovery
+ Return Cost
```

This is not a scientific formula or analytics metric by itself. It is a product review model.

### 5.1 Motor distance

How far must the pointer, finger, or focus travel?

Questions:

- Is the action on the opposite side of the screen from the object?
- Does the user repeatedly cross the same distance?
- Does the action require precision on a small target?
- Is the action reachable by keyboard without excessive tabbing?

### 5.2 Visual search

How much scanning is required to locate the control?

Questions:

- Is the control where users expect it?
- Is it grouped with related actions?
- Does it disappear until hover?
- Is it visually lost among low-value metadata?

### 5.3 Scope interpretation

How much thought is required to understand what the action will affect?

Questions:

- Does Edit affect the field, the section, or the whole record?
- Does Optimize affect the description, the briefing, or everything?
- Does Clear remove one filter, all filters, or saved view settings?

### 5.4 Context switching

Does the action require leaving the current surface or mental task?

Questions:

- Must the user open a separate module for a local action?
- Does the destination preserve the originating record?
- Can the user complete the task without rebuilding context?

### 5.5 Working memory

What must the user remember while moving between regions or pages?

Questions:

- Must the user remember a candidate name while opening another module?
- Must the user compare two versions by scrolling between separate views?
- Must the user remember which filter was active after navigating away?

### 5.6 Waiting

How much delay is introduced, and does the interface communicate it locally?

Questions:

- Does a local action trigger a full-page reload?
- Does the interface keep prior results visible during a refresh?
- Is loading shown where the user expects the result?

### 5.7 Error recovery

How difficult is it to reverse or correct an action?

Questions:

- Is Cancel near the workflow?
- Are unsaved selections protected?
- Does Dismiss preserve the ability to return?
- Are destructive controls local but appropriately guarded?

### 5.8 Return cost

How hard is it to return to the exact origin?

Questions:

- Does Back return to the prior tab or only the parent module?
- Are search, filters, and scroll preserved?
- Does a contextual return control identify the source record?

---

## 6. The Control Placement Decision Framework

Before placing a control, classify it across five dimensions.

### 6.1 Frequency

- **High frequency:** used repeatedly during normal work
- **Medium frequency:** used regularly but not continuously
- **Low frequency:** administrative, exceptional, or setup-oriented

High-frequency actions deserve lower travel cost.

### 6.2 Scope

- **Field-level:** affects one field
- **Object-level:** affects one card, document, candidate, job, invoice, or record
- **Section-level:** affects one tab or panel
- **Page-level:** affects the current page or collection
- **Workspace-level:** affects shared settings or behavior
- **Application-level:** affects the entire product or account

The control should usually live at the smallest accurate scope.

### 6.3 Reversibility

- easily reversible
- reversible with effort
- destructive or difficult to reverse

Destructive actions still benefit from locality, but they need stronger separation, labeling, confirmation, and error prevention.

### 6.4 Consequence

- informational
- navigational
- state-changing
- externally visible
- financially consequential
- legally or reputationally consequential

Higher-consequence actions require greater clarity and review, not arbitrary physical distance.

### 6.5 Context dependency

- can be understood globally
- requires the current object
- requires multiple selected objects
- requires comparison or source evidence
- requires a separate operating surface

The more context-dependent an action is, the more strongly it should remain attached to that context.

### Placement matrix

| Action type | Preferred placement | Typical pattern |
|---|---|---|
| High-frequency, object-specific, reversible | Directly on or beside the object | Inline button, compact toolbar, row action |
| High-frequency, multi-object | Beside the selection or filter band | Bulk action bar, sticky selection toolbar |
| Section-specific | Section header or section footer | Local header action, sticky section footer |
| Page-wide | Page header or command bar | New record, export page, page-level status |
| Workspace-wide | Settings or admin surface | Defaults, permissions, integrations |
| Destructive object action | Local action group with guard | Archive/Delete menu, confirmation dialog |
| Comparison decision | Review toolbar near compared content | Apply, Dismiss, Synced/Independent |
| Exit from modal or media | Container edge | Local close icon, Escape support, scrim |
| Cross-surface navigation | Nearest meaningful entity reference | Clickable name, count, chip, open icon |

---

## 7. Locality Patterns to Reuse Across Products

### 7.1 Local editing

The Edit control should be attached to the content or record it changes.

Use:

- inline edit for simple fields
- section-level edit for grouped fields
- object-level edit in the object header
- a focused dialog for multi-field changes

Avoid sending users to a separate edit page unless editing is a substantial workflow in its own right.

### 7.2 Local AI assistance

AI actions should sit near the artifact they assist.

Examples:

- Optimize near a job description
- Generate Summary inside a summary surface
- Draft Reply inside the message composer
- Extract Fields inside the uploaded document area
- Refresh Briefing inside the briefing band

The AI action should not appear as a generic global sparkle button whose scope is unclear.

### 7.3 In-surface creation

When a user initiates creation from a record, open the creation workflow over that record and prefill implied context.

Examples:

- Company to New Job, prefill Company
- Job to Add Candidates, scope to Job
- Candidate to Add to Job, scope to Candidate
- Invoice to Add Line Item, scope to Invoice

### 7.4 Actionable metadata

Metadata can also be a shortcut.

Examples:

- candidate count opens Candidates
- company name opens Company
- stage chip opens the focused pipeline position
- status chip opens status controls
- source opens source details when useful

Do not make every piece of text clickable. Make the elements that represent meaningful destinations or actions clickable.

### 7.5 Artifact-owned copy controls

A Copy control copies the artifact that visually owns it.

- Summary card copies the summary.
- Analysis panel copies the analysis.
- Briefing band copies the briefing.
- Contact field copies the field.

Never place a Copy icon inside one artifact that copies a different artifact.

### 7.6 Sticky local actions

Long forms and review surfaces should keep their primary decisions reachable without detaching them from the workflow.

Use:

- sticky footers inside the panel
- sticky section toolbars
- bounded internal scrolling when appropriate
- local validation and completion state

Avoid floating actions that overlap content or appear disconnected from the panel.

### 7.7 Contextual return continuity

When the user must navigate away, carry the origin into the destination.

A contextual return control should:

- identify the origin by name
- return to the exact tab or state when practical
- coexist with permanent navigation
- appear near the normal back control

Example:

- Candidate dossier opened from Senior Full Stack Engineer shows “Back to Senior Full Stack Engineer” in addition to the permanent Candidates navigation.

### 7.8 Local exits

Close and Dismiss controls belong to the surface being closed.

For a centered image viewer:

- place Close at the image or content container edge
- retain Escape support
- allow a scrim click when safe
- do not depend on a far viewport corner

For a modal:

- place Close in the modal header
- place Cancel near the primary action
- protect unsaved work when closing

### 7.9 Local success feedback

Use compact state changes when the result is obvious.

Examples:

- Copy icon becomes a checkmark
- Saved label appears beside the Save action
- Applied row changes state in place
- Refreshed timestamp updates near Refresh

Use toasts as supplemental confirmation when the action has broader effects or the user may no longer be looking at the source.

---

## 8. Useful Redundancy Versus Harmful Duplication

### 8.1 Useful redundant navigation

Redundancy is useful when users can begin from different attention zones.

Example:

A recruiter may be looking at the Candidates tab near the center of a Job page or at the Candidate count in the right rail. Both can open the same Candidate surface. This reduces travel without creating state risk.

### 8.2 Harmful duplicate mutation controls

Duplication becomes harmful when controls:

- sit near each other
- have the same or similar labels
- appear to affect the same object
- can trigger different code paths
- create uncertainty about the correct action

Example:

A top-right Optimize button and a description-level Optimize button are too close in geography and too ambiguous in scope. The local control should remain. The global duplicate should be removed or repurposed into a genuinely broader action.

### 8.3 The redundancy test

Keep two routes only when all of the following are true:

1. They serve distinct points of attention.
2. They lead to the same reliable destination or behavior.
3. Their scopes are equally clear.
4. They do not introduce conflicting state.
5. Each route materially lowers travel cost.

---

## 9. Anti-Patterns

### 9.1 Corner exile

A control is placed in a distant viewport corner even though the affected object is centered or small.

Example: a close control in the browser corner for a small centered image.

### 9.2 Orphan control

An action appears without a clear visual owner.

Example: Optimize in a page header with no indication of whether it affects the Job, description, briefing, or candidates.

### 9.3 Route detour

A local task sends the user to another module or page unnecessarily.

Example: leaving a Company dossier to create a Job that already belongs to that Company.

### 9.4 Detached feedback

The result appears only in a distant toast or unrelated region.

Example: a field fails validation, but the only error appears at the bottom of the page.

### 9.5 Dead metadata

A chip, count, or label looks actionable but cannot be used.

Example: an Active chip with no status-changing path anywhere nearby.

### 9.6 Footer burial

Primary actions are available only at the bottom of a long form, forcing repeated travel or making completion hard to find.

### 9.7 Hover-only workflow

A critical action appears only on hover and has no keyboard or touch path.

### 9.8 False symmetry

Controls are placed symmetrically for visual balance even though the placement increases travel or obscures scope.

Locality outranks decorative symmetry.

### 9.9 Global menu dumping

Every action is placed in one page-level overflow menu, forcing the user to search and infer scope repeatedly.

### 9.10 Toast dependence

The interface uses transient toasts as the sole feedback for local state changes.

### 9.11 Ambiguous duplicate labels

Two actions use the same label but affect different scopes.

### 9.12 Context amnesia

The product navigates correctly but forgets where the user came from, which tab was active, what was selected, or what had already been generated.

---

## 10. AI-Native Interaction Rules

AI can increase productivity, but it can also increase ambiguity. Locality is especially important on AI-assisted surfaces.

### 10.1 AI should act on a visible object

The user should be able to identify the input, proposed output, and affected record.

### 10.2 AI suggestions require local review

Generated changes should appear beside or over the source artifact with clear Apply, Dismiss, and comparison controls.

### 10.3 Do not silently overwrite important content

The user should retain judgment for meaningful mutations, especially when content is externally visible, financially consequential, legally sensitive, or reputation-bearing.

### 10.4 Keep AI labeling mature and quiet

Once the interaction is understood, prefer concise labels such as:

- Optimize
- Briefing
- Suggested Revision
- Draft Reply
- Extract
- Refresh

Use explicit AI disclosure where source transparency, policy, trust, or compliance requires it. Do not add theatrical AI labels to every assisted action.

### 10.5 Put provenance near the suggestion

When grounding matters, place source context, freshness, mismatch, or confidence cues near the output they qualify.

### 10.6 Put staleness near Refresh

A stale-state warning should appear in the briefing or beside its Refresh control, not in an unrelated page banner.

### 10.7 Feedback should not interrupt the flow

Prefer local indicators and stable content updates. Avoid unnecessary full-screen thinking states, decorative streaming, or success notifications that steal focus.

---

## 11. Responsive and Mobile Guidance

### 11.1 Preserve ownership when stacking

When two columns become one, keep each control inside the header or footer of the section it owns.

### 11.2 Avoid long cross-screen reach

On mobile, frequent actions should be reachable without forcing repeated movement between the top and bottom of the screen.

Use:

- sticky local action bars
- bottom sheets for focused choices
- section-level actions
- touch-sized controls
- progressive disclosure for low-frequency actions

### 11.3 Keep close controls attached

A full-screen mobile modal can place Close at the modal’s top edge because the modal owns the screen. A smaller card or image inside an overlay should keep Close visually attached to that card or image.

### 11.4 Preserve keyboard and touch parity on responsive web

A desktop hover accelerator must not remove the click, focus, and touch path.

---

## 12. Accessibility Requirements

Locality should reduce effort for all users, not merely pointer users.

### 12.1 Visual grouping must have semantic grouping

Controls that appear grouped should also be grouped in markup, focus order, naming, and screen-reader relationships.

### 12.2 Focus order follows visual order

Keyboard travel should not jump unpredictably across distant regions.

### 12.3 Never rely on color alone

Use labels, icons, patterns, or supporting text in addition to color.

### 12.4 Provide visible focus treatment

Every actionable chip, count, link, icon, and row must show where keyboard focus is located.

### 12.5 Use clear accessible names

An icon-only control must explain both action and object when necessary.

Examples:

- Close image preview
- Copy job briefing
- Open Alex Rivera profile
- View Jordan Wu in Product Manager pipeline

### 12.6 Protect unsaved work

Escape, scrim click, Cancel, and Close should respect pending selections or edits.

### 12.7 Do not make proximity depend on precision

A nearby control that is too small or difficult to target still carries high interaction cost.

---

## 13. Applying the Philosophy Across Product Types

### 13.1 Operational software

Priority patterns:

- command bars with local filters and Clear
- actionable metadata
- quick preview instead of unnecessary route changes
- contextual return controls
- sticky review and save actions

### 13.2 Content editors

Priority patterns:

- local formatting controls
- section-level AI assistance
- inline comments and annotations
- local validation
- preview beside editing when comparison matters

### 13.3 Dashboards

Priority patterns:

- metrics that open the records behind them
- filters grouped with Clear and Save View
- actions attached to cards or tables they affect
- avoid decorative cards with no operational destination

### 13.4 Portals and intake flows

Priority patterns:

- progressive steps
- validation at the field
- Save and Continue near the current step
- preserved draft state
- clear return and resume behavior

### 13.5 Mobile products

Priority patterns:

- one-hand reach where practical
- bottom sheets for local choices
- local sticky actions
- clear container-owned exits
- minimal mode switching

### 13.6 AI transformation tools

Priority patterns:

- input, suggestion, and decision in one review neighborhood
- transparent source context
- local Apply and Dismiss
- no silent mutation
- stable output across navigation

---

## 14. The Mohales Locality Review

Use this review during product critique, design QA, or implementation planning.

### A. Object and scope

- What object does the action affect?
- Is that scope obvious from placement alone?
- Is the control located at the smallest accurate scope?
- Is a page-level control being used for an object-level task?

### B. Travel

- How far must the eyes move?
- How far must the pointer, finger, or keyboard focus move?
- Is the user forced to cross the screen repeatedly?
- Can the action be reached from the current attention zone?

### C. Context

- Does the task stay within the current surface?
- If not, why is navigation necessary?
- Is origin context preserved?
- Can the user return to the exact tab or record?

### D. Feedback

- Does feedback appear near the trigger or result?
- Is the state change persistent enough to notice?
- Is a toast being used to compensate for missing local feedback?

### E. Redundancy

- Is there another control that performs the same action?
- Does the duplicate serve a distinct attention zone?
- Could the duplicate create scope confusion or divergent behavior?

### F. Accessibility

- Can the action be used by mouse, keyboard, and touch?
- Is the target large and clear enough?
- Is meaning available without color?
- Does focus order follow the visual grouping?

### G. Recovery

- Can the user cancel or undo locally?
- Are unsaved choices protected?
- Is the exit attached to the surface being exited?

---

## 15. Interaction Travel Cost Scorecard

Score each dimension from 0 to 2.

- **0:** low cost, clear and local
- **1:** acceptable cost, some friction
- **2:** high cost, redesign or justification needed

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Motor distance | Same action neighborhood | Moderate travel | Opposite region or repeated long travel |
| Visual search | Immediately discoverable | Requires brief scan | Hidden, ambiguous, or lost |
| Scope interpretation | Obvious | Requires label or thought | Unclear or misleading |
| Context switching | None | Local overlay or minor shift | Route change with context rebuilding |
| Working memory | No remembered data needed | One simple fact | Multiple facts or comparison across surfaces |
| Feedback locality | In place | Nearby supplemental feedback | Distant or toast-only |
| Recovery | Immediate and local | Requires one secondary step | Hard to reverse or return |
| Accessibility parity | Mouse, keyboard, touch | One path weaker | Hover-only or inaccessible |

### Interpretation

- **0 to 4:** strong locality
- **5 to 8:** acceptable, review high-frequency actions
- **9 to 12:** meaningful friction
- **13 to 16:** redesign recommended

This score is a heuristic for discussion, not a substitute for usability testing.

---

## 16. Product and Engineering Documentation Rules

This philosophy should not remain only in a vision document. It should be translated into implementation artifacts.

### 16.1 Product briefs

State:

- the object being acted upon
- the intended local action surface
- the reason navigation is or is not required
- the expected feedback location
- preservation and return behavior

### 16.2 User stories

Example:

> As a recruiter reviewing a Job description, I want the Optimize control beside the description so I can understand its scope and review changes without searching the page.

### 16.3 Acceptance criteria

Example:

- Optimize appears in the Description section header.
- No second ambiguous Optimize action appears in the page header.
- Suggested Revision opens in the same Job surface.
- Apply and Dismiss remain visible within the comparison panel.
- Closing the review returns the user to the unchanged Job description.
- Mouse, keyboard, and touch paths are supported.

### 16.4 Design specifications

Specify:

- action owner
- placement region
- responsive behavior
- focus order
- hover and active states
- local loading, success, and error treatment
- close and cancel behavior

### 16.5 Engineering rules

Prefer shared components when the interaction contract is the same.

Examples:

- shared entity picker patterns
- shared contextual return behavior
- shared local close and discard guards
- shared copy controls
- shared sticky review footer

Do not create multiple implementations of the same action if they can diverge in behavior.

### 16.6 QA requirements

Every pass should test:

- trigger placement
- scope clarity
- success feedback
- cancel and dismiss
- Escape and scrim behavior
- keyboard navigation
- touch behavior
- responsive stacking
- return continuity
- persistence across navigation
- duplicate action regression

---

## 17. Reusable Acceptance Criteria Library

### Local control

- The control appears in the section or object it affects.
- The action scope is understandable without opening documentation.
- No nearby duplicate control creates competing scope.
- The action remains reachable at supported breakpoints.

### In-surface modal

- The modal opens over the originating surface.
- Implied fields are prefilled.
- The underlying route does not change.
- Success updates the originating surface without a full reload.
- Unsaved selections trigger a discard guard.
- Escape, scrim, Cancel, and Close behave consistently.

### Contextual navigation

- Entity references are clickable where useful.
- Navigation carries origin context.
- The destination offers a contextual return path.
- Permanent navigation remains available.

### Local feedback

- Loading appears in the action neighborhood.
- Success is visible at the source or result.
- Validation appears at the affected field or section.
- Toasts are supplemental, not the sole local signal.

### Responsive locality

- Controls remain attached to their object after stacking.
- High-frequency actions do not move into a distant generic menu.
- Touch and keyboard paths remain complete.

---

## 18. Vocabulary for Product, Design, and Engineering Conversations

Use these terms when speaking with product managers, designers, and engineers.

### Primary terms

- **Control-to-object proximity:** how close an action is to the object it affects
- **Locality of action:** completing a task within its originating context
- **Interaction travel cost:** total physical and cognitive effort from intent to completion
- **Cost of distance:** friction created by separation between related elements
- **Spatial locality:** grouping related controls and objects in the same region
- **Action geography:** intentional placement of controls across a surface
- **Scope legibility:** clarity about what an action will affect
- **Contextual continuity:** preserving origin and task context across transitions
- **Intent-sensitive redundancy:** duplicate routes that reduce travel from distinct attention zones
- **Target acquisition:** locating and activating a control
- **Visual search cost:** effort required to find a control or state
- **Cognitive load:** mental effort required to understand and remember the workflow
- **Context switching:** moving between tasks, modules, or mental models
- **Direct manipulation:** acting on visible objects rather than through distant abstract commands
- **Progressive disclosure:** revealing complexity only when needed
- **Affordance:** a cue that suggests how an element can be used
- **Feedback:** the system response that confirms state or action
- **Information scent:** cues that help users predict where a control or link will lead
- **Spatial memory:** learned knowledge of where controls and content live
- **Focus order:** keyboard navigation sequence
- **Interaction loop:** trigger, processing, result, feedback, and recovery

### Adjacent established concepts

This philosophy is compatible with several established human-computer interaction concepts:

- Fitts’s Law, target acquisition becomes harder as distance increases and target size decreases
- Gestalt proximity, nearby elements are perceived as related
- spatial contiguity, related information is easier to understand when presented together
- direct manipulation, users act on visible objects and receive immediate feedback
- cognitive load reduction, interfaces should reduce unnecessary memory and interpretation
- progressive disclosure, advanced options should appear when relevant rather than crowding the default state

These concepts support the philosophy, but the Locality-First doctrine is a broader product operating system. It combines motor distance, semantic scope, context continuity, feedback, recovery, and cross-surface workflow design.

---

## 19. Canonical Examples

### Example 1: Local Optimize

**Weak:** Optimize appears in the top-right page header, far from the description, with unclear scope.

**Strong:** Optimize appears in the Description section header. The comparison opens directly below. Apply, Dismiss, and scroll mode controls remain attached to the comparison.

### Example 2: Image viewer close control

**Weak:** A small centered image opens inside a full-screen overlay, but Close remains in the far viewport corner.

**Strong:** Close is attached to the image or viewer container edge, with Escape and safe scrim-click support.

### Example 3: Candidate linking

**Weak:** Add Candidates sends the recruiter from Job Detail to the Candidates module, requiring them to remember the Job and return manually.

**Strong:** Add Candidates opens a Job-scoped picker over Job Detail, preserves selections while searching, and updates the roster after success.

### Example 4: Actionable count

**Weak:** A Candidate count appears in the Signals rail but is static.

**Strong:** The count and row open the Candidate tab for the same Job. The tab badge remains another valid route from a different attention zone.

### Example 5: Copy action

**Weak:** Copy appears in an Analysis card but copies only a Summary stored elsewhere.

**Strong:** Each Copy control copies the artifact that owns its container.

### Example 6: Filters

**Weak:** Clear All sits far from the filter controls while Sort occupies the nearby region.

**Strong:** Clear sits beside the last filter. Sort may sit at the far right because it is a separate page-level organization control.

### Example 7: Cross-surface return

**Weak:** Opening a Candidate from a Job returns only to the general Candidates list.

**Strong:** The Candidate dossier includes a contextual return control to the exact Job Candidates tab.

---

## 20. Design Philosophy in One Paragraph

Mohales Deis’s Locality-First Interaction Design Philosophy treats interface speed as the reduction of total interaction travel cost. Controls should remain close to the objects they affect, related actions should form clear neighborhoods, local tasks should stay in context, feedback should return to the source of action, and navigation should preserve a precise route back. Redundant navigation is welcome when it shortens travel from different attention zones, while duplicate mutation controls are rejected when they create ambiguity. The product should feel fast because its geography matches user intent, not because it hides controls, relies on hover, or adds twitchy motion.

---

## 21. Cross-Project Doctrine

The following statements are the shortest reusable version of this philosophy.

1. Put controls near the objects they affect.
2. Use the smallest accurate action scope.
3. Keep local tasks inside their originating surface.
4. Make navigation earn its cost.
5. Preserve origin and return context across surfaces.
6. Group related controls into one action neighborhood.
7. Return feedback to the trigger or result.
8. Duplicate navigation only when it reduces travel from distinct attention zones.
9. Avoid duplicate mutations with unclear or divergent scope.
10. Attach exits to the container being exited.
11. Preserve learned action placement across similar surfaces.
12. Maintain mouse, keyboard, and touch parity.
13. Make metadata actionable or remove it.
14. Protect unsaved work and make recovery local.
15. Optimize total interaction travel cost, not click count alone.

---

## 22. Version History

### Version 1.0, July 3, 2026

- Created the first complete cross-project philosophy document.
- Consolidated Control-to-Object Proximity, Cost of Distance, Locality of Action, contextual return, actionable metadata, local feedback, and responsive locality.
- Added a control placement framework, interaction travel cost model, anti-patterns, accessibility requirements, acceptance criteria, QA guidance, and professional terminology.
- Established April 11, 2026 as the formal conceptualization date based on the first documented cross-surface codification.

---

## 23. Future Evolution

This philosophy should be updated when product work produces a durable new rule rather than a one-off preference.

Future additions may include:

- measured usability benchmarks for common workflows
- mobile reach and one-handed interaction patterns
- interaction travel instrumentation
- attention heat mapping studies
- accessibility testing protocols
- voice, sound, and haptic feedback guidance
- cross-device continuity
- agentic workflow supervision patterns
- a compact designer and engineer checklist
- a visual pattern library with annotated examples


---

# Part 2: Voice and Microcopy Principles (Distilled, De-Branded)

Source: Mo's `voice-and-microcopy.md`, written specifically for Poprouser
branding. **Do not copy that file wholesale into RecruiterOS, Argo, or
CrackedHR.** None of those products are Poprouser-branded, and Poprouser's
specific persona (Poppy), banned-word list, and approved-phrase list
belong to Poprouser, not to these builds. What follows is the layer
underneath the brand voice, the structural microcopy discipline that's
genuinely reusable regardless of which product it's applied to.

## The five reusable microcopy principles

1. **Specificity.** Say what happened, then say what to do next. "Error"
   or "Invalid input" tells the user nothing. "We couldn't save this yet.
   Add a work state before continuing" tells them exactly what's wrong
   and what fixes it.
2. **Action orientation.** Labels should describe the outcome, not the
   mechanism. Weak: Submit, Continue, Done. Stronger: Start review, Send
   for approval, Deliver handoff summary. The button should tell the user
   what happens next, not just that something will happen.
3. **Concreteness.** Plain language over abstract system terms. "Save
   draft" and "Missing details" over "Execute" and "Validation failure."
   The user is a person doing a task, not a system administrator reading
   logs.
4. **Brevity.** Buttons and labels: 3 to 7 words. Helper text: one
   sentence. Empty and error states: 2 to 3 short sentences. If it's
   longer than that, it's probably explaining something the interface
   itself should be making obvious.
5. **Empathy without drama.** Acknowledge friction without either
   dramatizing it or blaming the user. "A few details still need review"
   over "You entered this incorrectly." "Your draft is safe" over saying
   nothing and letting the user panic that they lost their work.

## The no-blame error framework

Every error state should answer three questions, in this order:

1. What happened? (Plainly, without jargon.)
2. What can the user do about it? (A specific, actionable next step, not
   "try again.")
3. Is their work safe? (State this explicitly if there's any chance the
   user fears they lost something. Don't assume they'll infer it.)

Never write: "You did this wrong," "Invalid," "Failed" standing alone
with no next step attached.

## The empty state formula

Every empty state should include:

- What this area is, in one line.
- Why it matters, briefly, only if it's not obvious.
- One clear next step, ideally a single button with an action-oriented
  label.
- An optional second action for people who want a different entry point
  (an example, a template, a sample record).

## What to leave out of these builds

Poprouser's voice file bans specific words (leverage, seamless,
frictionless, AI-powered, magic, autopilot) because those words conflict
with a specific brand promise Poprouser makes about being a trusted,
human, non-hype People Ops colleague. RecruiterOS, Argo, and CrackedHR
haven't necessarily made that same promise yet. Don't assume the ban
carries over. If Mo wants a specific product's voice to avoid hype
language, that's a decision to make explicitly for that product, not an
inherited default from Poprouser's rules.

The same goes for the "never say chatbot" and "never say AI-generated"
rules; those exist because Poprouser's brand voice specifically wants AI
support to feel invisible and human-delivered. A different product might
have good reasons to be transparent and specific about what's AI-assisted
(see Locality-First, section 10.4 above: "Use explicit AI disclosure
where source transparency, policy, trust, or compliance requires it").
Don't silently import the opposite instinct from a file written for a
different brand promise.

---

# Part 3: General Microcopy Doctrine, With a Sourcing Caveat

Source: "The Strategic Microcopy Playbook," a general (non-Poprouser,
non-Mo-authored) reference Mo has used across multiple projects. This one
is more broadly applicable than the Poprouser file since it isn't tied to
one brand's specific promises, but it needs one honest caveat before it's
treated as settled fact.

## What's solid in it

- The three-tier distinction between microcopy (1 to 10 word functional
  phrases), UX writing (the end-to-end narrative discipline), and
  macrocopy (larger context-setting text blocks) is a genuinely useful
  vocabulary for talking about copy precisely.
- The six-principle checklist (specificity, action-orientation,
  concreteness, conversational tone, brevity, empathy) overlaps heavily
  with Part 2 above and is well-supported by general UX writing practice.
- The CTA (call-to-action) guidance, lead with a verb, make the result
  obvious, one primary action per section, is standard and safe to apply.
- The no-blame error framework and the "reassurance layer" idea near
  billing and payment actions (stating things like "no credit card
  required" or confirming cancellation is easy) are well-established
  patterns in commerce and SaaS (software as a service) UX.

## What needs a caveat

The two headline statistics in the document ("Expedia unlocked $12
million in annual revenue by removing a Company field," "another major
retailer generated $300 million... through wording and flow
optimization") are widely circulated in UX marketing content but are not
independently sourced in the document itself. Treat these as illustrative
folklore, not citable fact. **Do not repeat these numbers in a PRD
(Product Requirements Document), an investor deck, or any external-facing
material without finding the original source first.** If a specific
number matters for a business case Mo is making, verify it or drop it
rather than repeat an unsourced figure because it sounds persuasive.

The document's tone is also written in a fairly promotional,
marketing-blog register (a lot of bolded superlatives, a "10 or 20 units"
scarcity rule framed uncritically). Extract the structural principles,
don't adopt the voice. Mo's own products should sound like Part 2 above,
specific and human, not like a conversion-rate-optimization blog post.
