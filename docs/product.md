# Travel Planner — Product Design

## Context

A personal, single-user itinerary tool that encodes a specific working style: the human provides the *decisions* (which places, in what order, when to arrive), and the machine fills in the *derivable* pieces (travel time, routes, cascading start/end times, Google Place metadata), flags anything that doesn't fit (closed venues, missing data), and loops the human back in to fix. The goal is to remove the tedious middle — looking up hours, computing travel times, re-doing the schedule when one event shifts — without giving up human judgment on the interesting parts.

---

## 1. Vision

A **human-in-the-loop itinerary planner** where the human and the machine take turns. The human supplies intent; the machine fills in derivable data, validates, and highlights problems; the human adjusts; repeat until the plan is coherent. Released plans are shareable via unlisted links and exportable as a polished PDF brochure.

**Principles**
- **Partial-by-default.** Any field can be left blank in draft mode. Missing data is a first-class state, not an error.
- **Deterministic auto-fill.** The machine never guesses what only the human can decide (which places, how long to stay). It only computes what has a factual answer (travel time, cascaded clock times, Google Place metadata).
- **Alerts, not blocks.** Conflicts warn but never prevent saving or releasing. The human is trusted to override.
- **Map-always, choose your list.** The Map is always on screen alongside a live-editable list view (Table or Timeline). The two panes are synchronized.

---

## 2. Core Concepts

| Concept | Definition |
|---|---|
| **Plan** | A named trip spanning one or more days. The top-level document the user creates, edits, and releases. |
| **Day** | An ordered segment of a Plan, dated. Anchored by a Lodging at its start and end. Contains a sequence of Events and Travels. |
| **Lodging** | A first-class anchor for a Day: the Place the day starts from and returns to (typically a hotel or home). May be the same Lodging for consecutive days or change between days. |
| **Place** | A real-world location sourced from Google Places search. Carries name, address, coordinates, photos, and business hours. |
| **Event** | A planned visit to a Place, with start time, stay duration, description, and optional remark. End time is derived (start + duration). |
| **Travel** | The segment between two consecutive Events (or between a Lodging anchor and an Event), with vehicle, travel time, and route path. |
| **Alert** | A machine-generated warning about missing data or a conflict. Two severities: **Warning** (tight timing, likely-OK) and **Issue** (closed venue, missing required anchor). Never blocks save/release. |

Gaps between a Travel's arrival and the next Event's start (e.g. arriving before a venue opens) are simply empty time on the timeline — no special entity.

### Entity relationships (conceptual)

```
Plan
└── Day (dated, ordered)
    ├── Lodging (start anchor) → Place
    ├── [ Travel → Event → Travel → Event → … ]
    └── Lodging (end anchor, often same as start) → Place
```

---

## 3. Lifecycle & States

A Plan moves through these states:

1. **Draft** — Editable. Fields may be partial. Auto-fill has not run or has been re-invalidated by edits. Alerts may be present.
2. **Auto-filled** — Still a draft, but the user has clicked **Auto Fill**: all derivable fields are populated, alerts are refreshed. Editing any field returns the plan to a "dirty" draft (re-run auto-fill to clear).
3. **Released** — Assigned an unlisted shareable URL. The plan remains editable; edits propagate live to the released URL. The user can **Unrelease** to retract the link.
4. **Exported** — PDF snapshot generated on demand from the current state. Exporting does not change state.

There is no hard lock: the user can edit a released plan. Alerts present at release time are visible on the shared view.

---

## 4. Key User Flows

### 4.1 Building a day from scratch

1. User creates a Plan, names it, adds a Day with a date.
2. User picks a Lodging via Google Places search (e.g. a hotel).
3. User adds Event A: searches "Senso-ji Temple", picks it. Sets start time `09:00`. Leaves stay duration blank.
4. User adds Event B: "Tsukiji Outer Market". Leaves everything blank.
5. User adds Event C: "Shibuya Sky", sets start time `17:00`.
6. Between events, user picks a vehicle (walk/drive/transit) for each Travel; leaves time and path blank.
7. User clicks **Auto Fill**.
   - Machine resolves each Place's metadata (hours, address, photos).
   - Machine computes travel time and path for each Travel using the chosen vehicle.
   - Machine cascades times: if A ends at a known time, B's start = A.end + travel AB. If B has no explicit end but C has a fixed start, machine cascades backward: B.end = C.start − travel BC.
   - Where a forward and backward cascade don't meet (e.g. A.end unknown and B.end unknown), machine leaves the gap blank and emits an **Issue** alert.
8. User reviews alerts ("Event B has no stay duration — cannot compute B.end"). Fixes. Re-runs Auto Fill.
9. Once satisfied, user clicks **Release**. Gets an unlisted URL. Optionally exports a PDF.

### 4.2 Fixing a conflict

- Auto Fill reports: "Event B (Tsukiji Outer Market) arrives at 14:30; closes at 14:00." User shortens Event A, or swaps B's position, or accepts the alert and edits the description to note they're visiting the exterior only.

### 4.3 Early arrival (gap before opening)

- User arrives at a dinner spot at 17:30; restaurant opens at 18:00. The timeline shows 30 min of empty space between the arrival and the Event block. No alert unless the gap is long (see 5.7).

### 4.4 Editing a released plan

- User spots a typo on the released page. Edits the event description. The shared URL reflects the change on next load. No version history.

---

## 5. Feature Details

### 5.1 Plan management

- Create, rename, duplicate, delete plans.
- List view of all plans with status (Draft / Released), date range, last edited.
- Duplicating a released plan produces a new Draft.

### 5.2 Day & Lodging

- A Plan has one or more Days; Days are dated and ordered by date.
- Each Day **requires a Lodging** to be anchored for Auto Fill to work. A Day without a Lodging emits an **Issue** alert.
- The Lodging's Place is searched via Google Places like any other Place.
- By default, a new Day inherits the previous Day's Lodging. The user can override per day.
- The Day's implicit first Travel is from Lodging → first Event. The Day's implicit last Travel is from last Event → Lodging.

### 5.3 Places

- **Source**: Google Places search only. No custom pins or manual-only entries.
- Each Place carries: name, address, lat/lng, photos, business hours (by weekday with special-day exceptions where Google provides them), Google Place ID, category.
- Business hours are fetched automatically on add. The user can override/edit hours locally if Google's data is wrong (the override is used for validation).
- The same Place may appear in multiple Events across the Plan (e.g. the same café twice).

### 5.4 Events

An Event has these **editable** fields:
- **Place** (required; selected via search)
- **Start time** (optional in draft; required for a complete plan)
- **Stay duration** (optional in draft; required unless it can be cascaded from surrounding anchors)
- **Description** (optional; auto-populated from Google Place data but editable)
- **Remark** (optional; free-form personal note, e.g. "Try the unagi set")

And these **derived** fields (read-only, shown in UI):
- **End time** = start + stay duration.

Authoring ergonomics:
- Only start and duration are editable; end is always displayed as a computed value.
- Either start or duration may be filled by Auto Fill when surrounding anchors make them deducible (see 5.6). User-entered values are never overwritten.

### 5.5 Travels

A Travel sits between two consecutive Events (or between a Lodging and an Event). Fields:
- **Vehicle** (required before Auto Fill: walk / drive / transit / cycle)
- **Travel time** (computed)
- **Route path** (computed, for map display)
- **Departure time** = previous Event's end
- **Arrival time** = departure + travel time

The user specifies only the vehicle in a typical flow; everything else is computed.

### 5.6 Auto Fill

**Triggered by**: explicit button press. Never runs implicitly on edit.

**What it does** (in order):
1. For each Place missing metadata, fetch from Google Places.
2. For each Travel with a vehicle set, compute travel time and route path via Google Directions.
3. Cascade times:
   - **Forward**: starting from the earliest time-anchored Event (or Lodging departure), propagate end times and subsequent starts using stay durations and travel times.
   - **Backward**: starting from the latest time-anchored Event, propagate earlier end times using travel times and stay durations.
   - **Merge**: where forward and backward cascades meet consistently, values are filled. Where they conflict or fail to meet, the affected cells stay blank and an Issue alert is raised.
4. Populate default Event descriptions from Google Place data (only where the user has not written one).

**What it does NOT do**:
- Guess stay durations. If the user didn't specify, the machine won't invent one.
- Reorder events, change vehicles, or pick places.
- Overwrite any field the user has edited (respects manual values).

**After Auto Fill**: validation (5.7) runs and the alert panel updates.

### 5.7 Validation & Alerts

Alerts appear in a side panel and as inline markers on the Event/Travel they reference. Two severities:

**Issues** (red — action needed for a complete plan):
- Day has no Lodging.
- Event has no Place.
- Travel has no vehicle.
- Cascade cannot compute a time (insufficient anchors).
- Arrival at an Event falls outside the Place's business hours.
- Departure from an Event (if location is time-sensitive, e.g. last entry) violates a closing-time constraint.
- Overlapping Events (start of next < end of previous + travel).

**Warnings** (yellow — likely OK, flagged for attention):
- Very tight connection (travel buffer < 5 min after rounding).
- Gap longer than 60 min between arrival and the next Event's start (e.g. a long idle wait before a venue opens).
- Travel time exceeds a threshold for its vehicle (e.g. > 45 min walking).
- Business hours data unavailable for a Place.

**Policy**: Alerts never block save or release. Alerts that are present at release time remain visible on the released page and in the PDF footer.

### 5.8 Views

The editing surface is a **split pane**: the Map is always visible on the **left**, and the **right** pane shows one of two browsing/editing views — **Table** or **Timeline** — selected via a toggle. Edits in either right-pane view reflect everywhere, including the Map.

**Map pane (left, always visible)**
- Shows pins for the **current Day's** Lodging and Events, plus polylines for Travels colored by vehicle.
- A Day selector at the top of the Map (or shared with the right pane) switches the focused Day.
- Pins are numbered in visit order; Lodging pin is visually distinct.
- Remains on screen while scrolling the right pane.

**Right pane — Table view** (primary authoring surface)
- One row per Event, with an interleaved row for each Travel.
- Columns: Time, Duration (editable for Events), Place, Vehicle (for Travels), Description, Remark, Alert.
- Dense, keyboard-friendly, supports inline edits.

**Right pane — Timeline view**
- Vertical hours axis for the current Day. Events as blocks, Travels as connectors. Empty stretches (e.g. an early arrival) simply appear as empty space on the axis.
- Best for seeing pacing and spotting dead time.

**Map ↔ Right pane interactions**
- **Right → Map**: Clicking an Event (or a Lodging, or a Travel) in the Table or Timeline pans and zooms the Map to that item; its pin/polyline is highlighted.
- **Map → Right**: Clicking a pin or polyline on the Map scrolls the right pane to the corresponding Event/Travel and visually highlights it.
- **Hover** (secondary): hovering on either side gives a light-weight highlight on the other side without panning.
- The currently selected/highlighted item persists across right-pane view switches (Table ↔ Timeline).

### 5.9 Release & Sharing

- Releasing a Plan mints an **unlisted URL** with a hard-to-guess slug. No index, no gallery, no search.
- **Unrelease** retracts the link; subsequent visits 404.
- The released page always reflects the current state of the Plan (no snapshots).
- The page is read-only — no editing affordances are shown.
- **The released page is mobile-first.** The editing experience (5.8) is desktop-first; the released page is a separate product surface designed for someone reading their itinerary on a phone while traveling. Its layout is **not** the planner's split-pane. The specific mobile layout will be designed separately (not in this doc).

### 5.10 PDF Export

Generated on demand from the current state. Contents, in order:

1. **Cover page** — trip title, date range, number of days, summary list of destinations/cities.
2. **Trip overview** — one-line summary per day ("Day 2 · Tokyo · Asakusa → Tsukiji → Shibuya").
3. **Per-day pages**, repeating for each Day:
   - **Timeline** — the day's schedule, time-ordered, showing Events and Travels on an hours axis (empty stretches rendered as blank time).
   - **Static map** — the day's pins and route, as a single image.
   - **Detail cards** — one card per Event: photo, name, address, hours, description, remark.
4. **Footer** — generation date and, if any alerts are present, a summary line ("2 unresolved alerts — see page X").

PDF output is self-contained (no live map tiles required to read it).

---

## 6. Time Model

- **Granularity**: 15 minutes. All user-entered times are rounded to the nearest 15-min boundary. Travel times returned by Google Directions are rounded **up** to the next 15-min boundary before being written to the plan (to avoid silently tight connections).
- **Time zone**: each Plan has one time zone set on creation (inferred from the first Place added, editable). All times are stored and displayed in the Plan's zone. Multi-zone trips are out of scope for v1.
- **Dates**: each Day has a calendar date. Days are ordered chronologically.
- **Gaps**: when `arrival_time < next_event.start_time`, the difference is simply empty time on the timeline. It is not a named entity — just space.

---

## 7. Non-Goals (v1)

- Multi-user accounts, collaboration, or permissions.
- Version history / undo across sessions.
- Budget tracking, expense logging, currency conversion.
- Flight, train, or intercity transit booking integration.
- Multi-time-zone plans.
- Custom (non-Google) map pins.
- Offline editing / mobile-app-native experience (web-only).
- Public gallery / plan discovery.
- Comments or reactions on released plans.
- Automatic place suggestions ("you should visit X next").

---

## 8. Open Questions

1. **Hours overrides**: when the user edits a Place's hours to correct Google's data, is the override per-Plan or global across all Plans that reference the same Place?
2. **Lodging "stay"**: do we track check-in/check-out *times* for a Lodging, or just the Place? (Relevant when the first day starts mid-afternoon because check-in is 15:00.)
3. **"Locked" fields in cascade**: the spec mentions user-editable fields the machine respects. Do we need an explicit lock UI affordance, or is "the user typed a value" sufficient as the lock signal?
4. **PDF page count limits**: long trips (e.g. 15 days) produce long PDFs. Any need for a "compact" PDF variant without per-event detail cards?
5. **Released-page alert visibility**: should viewers see all alerts, or should Warnings be hidden and only Issues shown publicly?

---

## 9. Verification

Once implemented, the product design is validated by walking through these scenarios end-to-end with no friction:

- **Happy path**: Build a 3-day Tokyo plan. Add Lodging + 3 events/day with partial times. Pick vehicles. Click Auto Fill. Zero Issues. Release. Export PDF. Open PDF, confirm every page renders.
- **Conflict path**: Place a restaurant visit at 14:30 when it closes at 14:00. Confirm Issue alert fires in Table, Timeline, and in the released view.
- **Partial path**: Leave stay duration blank on a middle event with no anchoring end time. Confirm Auto Fill leaves the cascade gap and raises a clear Issue.
- **Edit-after-release path**: Release a plan, then edit an event description on the desktop planner. Confirm the released URL shows the new description on reload (on both desktop and phone).
- **Gap path**: Arrive 30 min before a venue opens. Confirm the Timeline renders the 30-min gap as empty space, no alert raised. At 90-min gap, confirm a Warning fires.
- **Planner map interaction path**: Click an Event in the right pane — confirm the Map pans/zooms and highlights the pin. Click a pin on the Map — confirm the right pane scrolls to and highlights the Event. Switch right pane from Table to Timeline — confirm the highlighted Event stays highlighted.
- **Released mobile path**: Open the unlisted URL on a phone. Confirm the layout is mobile-first (not the planner's split-pane) and the plan is fully browsable in read-only mode.
