# Argo Context Seed
**v1.1 · July 5, 2026 · Supersedes v1.0**

Same document as v1.0, with one correction: the extend-versus-greenfield
question is now resolved with a real answer instead of an open flag.
Everything else carries forward unchanged. v1.0 and v0.1 both stay
archived as their own files.

## 1. Validated (real evidence exists)

- **The core problem is grounded in real, quoted pain, not synthetic
  examples.** Two research artifacts (`Argo_Recruit_MVP_Hyptheses_
  Experiments_00_v0_200605_MED.docx`, authored Oct 2018 to March 2019, and
  `_TS__WIP_Argo_MVP_-_Overworked_HR_Manager_Olivia_Persona_v2_191014_MED.
  docx`, Oct 2019) contain first-person quotes attributed to a persona
  named Olivia describing real frustration: coordinating dozens of
  interviews without a repeatable structure, fear of accidentally illegal
  interview questions creating liability, and abandoned attempts at
  Google Forms and printed answer sheets that fell apart within a month.
  These read as captured language from real conversations, not invented
  for the document.
- **Important caveat on the above:** every "EXPERIMENT RESULTS" table in
  both hypothesis documents (the Concierge Experiment, the Landing Page
  Experiment) is an unfilled template, not completed data. I found no
  record in the uploaded files of a finished interview round, a survey
  response count, or a landing page conversion number. What's validated
  is that Mo personally collected real problem language from the target
  market. What is not confirmed from these files alone is whether the
  specific quantitative thresholds the docs set for themselves (20%
  landing page click-through, 10% waitlist conversion, and so on) were
  ever actually tested and hit. If completed interview notes or survey
  results exist outside what's been uploaded, that changes this
  assessment and is worth surfacing.
- **A working click-through prototype was designed to real fidelity,
  in two form factors.** `Final_Mid_Fi.pdf` (UI dated September 2018
  inside the mockup itself) shows a login screen, a role-filtered agenda
  and calendar view, a live interview screen with a running timer and
  pause and stop controls, and a post-interview summary screen with
  keyword tagging. `Pop_Interview_v1_Chrome_Addon.pdf` and
  `Pop_Interview_Concept_2__Website_w_Stories.pdf` (with `Pop_Interview_
  v2_Browser.pdf` as a duplicate of the latter) show a second, more
  developed concept: a Google Calendar interview reminder that pops the
  interviewer directly into a structured question flow, organized by
  fit category (Motivation Fit, Culture Fit, Role Fit), with response
  capture, audio recording, a difficulty rating, and a share-to-Drive
  step at the end. Both concepts were merged into a single graded
  assignment (`POp_Interview_Parallel_Prototyping_v1_Assignmentmerged.
  pdf`), suggesting this doubled as coursework applied to a real idea,
  not purely academic.
- **The discovery methodology itself is rigorous and complete, independent
  of whether specific numeric targets landed.** `WIP_Pop_Interview_-_CD_-_
  Problem_Interview__0__Invites___Scripts_Q4_2019_191127.docx` contains a
  full outreach funnel (in-person, email, LinkedIn, LinkedIn Navigator,
  and Slack, each with A/B/C message variants), a "Problem Interview
  Script Deconstructed" with per-section timing (welcome, demographics,
  open story-gathering, problem ranking, worldview exploration, the hook
  and ask, post-interview documentation), and explicit interviewing
  discipline (past behavior over hypothetical, no leading questions, the
  5 Whys, silence as a tool). This is a genuinely reusable discovery
  asset regardless of what it did or didn't validate on its first run.
- **New: Argo is confirmed greenfield, no codebase to extend, no
  ambiguity remaining.** See Section 4 for the full resolution.

## 2. Assumed (stated as fact, not yet tested)

- **Customer segment priority.** Olivia (Overworked People Ops Manager,
  cast as the Innovator) and Andy (Ambitious External Recruiter, cast as
  the Early Adopter) are treated as the confirmed beachhead across nearly
  every document. Other personas in the brainstorm list, especially Ian
  (Involved Functional Hiring Manager), were carried for years without
  resolution. One document literally marks Ian's adoption category as
  "???" This is a belief stated with conviction, not a tested ranking.
- **All quantitative business targets are six-year-old planning
  assumptions**, not measured outcomes: 35,000 paid users, $3.1 million
  revenue in 3 years, $259K MRR (monthly recurring revenue), $7.38 ARPU
  (average revenue per user), $265 LTV (lifetime value), a viral
  coefficient of 1.7, and tiered pricing starting at $4.99. These come
  from a Lean Canvas exercise, dated 7/12/2019 and 2/21/2020 respectively
  across the two canvas iterations. They predate the current AI-native
  competitive landscape entirely and should be treated as historical
  planning artifacts, not live targets, until revisited.
- **The pricing and packaging model** (freemium bottom-up SaaS, roughly
  90% free to 10% paid, an enterprise or team tier, $99 to 149 per hour
  interview training as an upsell) is likewise 2019 to 2020 GTM (go-to-
  market) thinking, unrevalidated against 2026 buyer expectations.
- **Automated candidate scoring was assumed to be a safe, desirable
  feature.** Several documents describe "candidate scoring," a 3-gauge
  red/yellow/green assessment button, and a "Rating of Response" control
  in the mockups, all without any privacy or fairness caveat. This
  wasn't an oversight at the time. GDPR (General Data Protection
  Regulation) Article 22 enforcement patterns and the EU AI Act's
  high-risk classification for employment AI weren't settled in their
  current form when this research was done. It is a genuinely new
  constraint current-Argo has to carry that the original research never
  had to account for, and it sits squarely in Nadia's territory.

## 3. Untested (genuinely unknown)

- **Whether the 2018 to 2020 problem framing, positioning, and pricing
  still hold against the 2026 landscape.** Jordan Chen's ATS (applicant
  tracking system) taxonomy exists for Recruiter OS's market. Argo's
  actual competitive set (structured interviewing tools, AI interview
  copilots and note-takers, assessment platforms) has not been mapped at
  all.
- **Whether the Argonauts brand and Golden Fleece visual identity
  resonates with actual target users.** Now in active use across working
  documents (gold and amber tones, ship and sheep motifs under
  consideration), but still zero customer signal on it, by definition,
  since it didn't exist during the discovery period.
- **The actual product boundary between Argo and Recruiter OS now that
  both exist as live builds.** Every document agrees on the conceptual
  split (Argo is the interview layer, Recruiter OS is the agentic ATS
  layer), and Mo's own framing confirms they share recruiting DNA more
  closely than any other pair of his projects. But the practical handoff
  points, whether Argo receives candidates from Recruiter OS, whether
  structured interview data flows back into Recruiter OS's pipeline, and
  whether they're one integrated suite or two separate products with a
  shared philosophy, haven't been decided in writing anywhere.

*Removed from this list in v1.1: "whether an old Argo or Pop Interview
codebase exists anywhere accessible." Resolved below, moved to Validated.*

## 4. Prior spec or build attempts

The product carried at least three names across its history: **Argo
Recruit** (Oct 2018 to March 2019, planned domain `www.boardargo.ai`),
**Argo** (through 2019), and **Pop Interview** (domain `www.popinterview.
com`, 2019 to 2020 mockups). Mo's own business entity also shifted in this
window, from **Entercept Management Group** to **Poprouser Inc.** The
product is now returning to the Argo name.

Two click-through prototypes reached real mid-fidelity design (a Chrome
extension popup flow and a full browser and website flow with Google
Calendar integration), both dated 2018 to 2020.

**Resolved, July 5, 2026: there is no Argo or Pop Interview backend to
extend, and there never was one connected to this product's actual
research.** What does exist, untouched since 2020, is a single
hand-coded repository from an unrelated intro-to-coding course capstone,
Mo's own first backend, ever written, paired with a partner-built
frontend, made while learning to code for the first time. A recent Codex
pass over that old code called it clean. "Clean for a first-time
learner's capstone" and "a sound foundation for a real 2026 product" are
not the same claim, and Mo has confirmed directly, in writing, that it
will not be extended. Argo is greenfield, full stop, no further
confirmation needed.

For the record: the earlier reference in `fable5-build-playbook_
260704_MED.md` and in the build and design philosophy notes to "an old
GitHub repo with a real backend and a real frontend, partner-built" and
to confirming whether "the 2020 backend ever handled multiple real users
and permissions" was an overcautious assumption carried in from a
different conversation, not evidence from Argo's own history. Worth
correcting in those source files directly the next time they're touched,
so a future read doesn't reopen a question that's already closed.

Some 2018 to 2020 material appears to double as coursework: references to
Alexander Cowan's Lean Startup tutorial framework, an "Enable Quiz" example
company used as a teaching template, a pipeline of FIU (Florida
International University) MSHR (Master of Science in Human Resources)
students for future validation, and a graded "Team Venture Exercise."
This doesn't diminish the work, the thinking was real and applied to a
real idea, but it explains some template artifacts still present in the
files (bracketed placeholder instructions, and one unrelated persona
fragment, "Concerned SanGen Daughter," that bled through from a shared
assignment template and is not part of Argo's actual research).

## 5. Source documents

| Document | Date | What it is |
| --- | --- | --- |
| `Argo_Recruit_MVP_Hyptheses_Experiments_00_v0_200605_MED.docx` | Oct 2018 to Mar 2019 (authored); saved June 2020 | Original venture hypothesis, problem scenarios, core value hypothesis, full experiment templates (unfilled results) |
| `_TS__WIP_Argo_MVP_-_Overworked_HR_Manager_Olivia_Persona_v2_191014_MED.docx` | Oct 2019 | Deepest persona document: Olivia's full empathy map, day in the life, JTBD notes, wow statement and elevator pitch drafts, minimum success criteria, early GTM and cold outreach playbook |
| `Argo_Parallel_Prototyping_v1_100618_MED.md` | Named for Oct 2018, later-dated content | Position statement, persona list, user stories for the parallel prototyping exercise |
| `Agile_Week_4_Pop_Interview__MVP_Hyptheses_Experiments_00_v0_200605_MED.md` | Saved June 2020 | Pop Interview position statement, core value hypothesis, customer journey testing table, ranked hypothesis list |
| `WIP_Pop_Interview_-_CD_-_Problem_Interview__0__Invites___Scripts_Q4_2019_191127.docx` | Nov 2019 | Full problem interview outreach and script playbook across five channels |
| `Business_Model__Lean_Canvas_Pop_Interview__v1_190925_MED.xlsx` (+ 2 PDF exports) | Canvases dated 7/12/2019 and 2/21/2020 | Three business model canvas iterations (Poprouser Lite, Lean Canvas, Argo Biz Model Canvas) plus a services breakdown sheet |
| `Final_Mid_Fi.pdf` | UI dated Sept 2018 | Six-screen mid-fidelity mockup: login, agenda, live interview with timer, post-interview keyword summary |
| `Pop_Interview_v1_Chrome_Addon.pdf`, `Pop_Interview_Concept_2__Website_w_Stories.pdf`, `Pop_Interview_v2_Browser.pdf` | 2019 to 2020 | Two click-through prototype concepts (Chrome extension vs. full browser), the second two files are duplicates of each other |
| `POp_Interview_Parallel_Prototyping_v1_Assignmentmerged.pdf` | 2018 to 2020 | Merged assignment combining the position statement and both prototype concepts, graded coursework artifact |
| `Google_Broswer.JPG`, `Google_Broswer_Poprouser.jpg`, `Interview_Check_In.png`, `Pop_Interview_Quick_Add.JPG`, `Pop_Interview_Pop_Out_Options.png`, `Pop_Interview_Ashley_GCalendar_Pop_Up.JPG` | 2018 to 2020 | Individual screenshots corresponding to pages already captured in the prototype PDFs above |
| `fable5-build-playbook_260704_MED.md` | July 4, 2026 | Validated lessons from the Ada Discovery Coach build, with an Argo-specific section that included the now-resolved backend question |

---

*v1.1. Archive rather than overwrite when substantially revised. Next
candidate for revision: once additional discovery material (interview
results, surveys, GTM/sales/design notes) is uploaded, or once the Argo
and Recruiter OS product boundary gets decided in writing.*
