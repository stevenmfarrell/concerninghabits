# UI standards

Read this before touching any page under `src/app/` or `src/components/`. It exists because the UI drifted into 3 different header styles and 2 different button roundings before being unified — don't recreate that drift by hand-rolling markup these primitives already cover.

## Colors and the theme

The app has light and dark themes, so components use the semantic colors defined in `src/app/globals.css`, not a palette's shades. Write `bg-surface text-ink border-line`, not `bg-white text-stone-900 border-stone-200`.

- **Neutrals:** `canvas` (the page) · `surface` (lists, dialogs, menus) · `surface-subtle` / `surface-muted` / `surface-strong` (inputs, hovered rows, tracks, wells, in that order of strength) · `ink` / `ink-secondary` / `ink-muted` / `ink-subtle` / `ink-faint` (text and icons) · `line` / `line-subtle` / `line-strong` (borders and hairlines) · `inverse` / `on-inverse` (a dark fill like a secondary button) · `overlay` · `focus` (focus rings).
- **Hues:** `accent` (emerald), `category` (blue), `danger` (red) and `warning` (amber), each with a fill (`bg-accent`, with `-hover`, and `-pressed` for a toggled-on button), text on the page (`text-accent-ink`, `-ink-strong`), pale fills (`-soft`, `-soft-strong`) and a matching border (`-line`). Use `text-on-accent` on an accent fill, and `text-on-category` on a category one.
- `dark:` is there for a genuine one-off. If you need a color that isn't a token, add the token to both themes in `globals.css`.
- Activity calendars use their own shades, `accent-scale-1`…`4`, `-done` and `-period` (and the same for `category`), so more activity still reads as more in dark mode. They're set in `src/lib/activityShade.ts`.
- Charts draw from `src/components/ChartView.tsx`. A chart's lines or bars take `--chart-1`, `--chart-2` and `--chart-3` in that order (never cycled; a chart has at most three, on one axis), a set checked for color blindness and contrast in both themes. A chart with more than one gets a legend.
- Colors set from JavaScript (Recharts props, toast options, a person's fallback color) use the CSS variables directly, e.g. `'var(--ink-muted)'`.
- The one exception is a surface that's the same in both themes, like the deep emerald voice-entry panel (`SpeakOrType`) and the `inverse` button variants made for it. Those keep raw palette classes.
- The theme is per device, picked under Settings → Preferences (`src/lib/theme.ts`).

## Buttons

Never write raw `<button className="bg-emerald-600 ...">` or `<Link className="px-4 py-2 ...">` for anything that behaves like a button. Use:

```tsx
import { Button, LinkButton } from '@/components/ui/Button';

<Button variant="primary" size="lg">Save Changes</Button>
<LinkButton href="/create" variant="outline">Cancel</LinkButton>
```

- **variant**: `primary` (emerald, main CTA) · `secondary` (stone-900, non-destructive secondary action) · `outline` (neutral bordered) · `ghost` (text-only, e.g. Cancel/Log Out) · `danger` (red filled, destructive confirm) · `danger-ghost` (red text, e.g. "Delete Habit" trigger before the confirm dialog) · `inverse` / `inverse-ghost` (white button / light text, for dark emerald surfaces like the smart entry panel)
- **size**: `xs` (32px, only for a section heading's controls, see below) · `sm` (rounded-lg, compact controls like inline toggles) · `md` (default, most form buttons) · `lg` · `xl` (rounded-xl, big CTAs)
- Only `xs` and `sm` use `rounded-lg`. Every other size is `rounded-xl` — don't introduce a third radius.
- For destructive confirmations, use `<ConfirmDialog>` (`src/components/ConfirmDialog.tsx`) rather than building a custom modal — it already wires up the danger/ghost button pair.

## Icon-only buttons

```tsx
import { IconButton, IconLinkButton } from '@/components/ui/IconButton';

<IconButton onClick={...} edge="right" title="More options"><MoreVertical /></IconButton>
<IconLinkButton href="/settings" edge="left" title="Back"><ArrowLeft /></IconLinkButton>
```

- `variant`: `default` (stone, most icon buttons) · `accent` (emerald, e.g. link-outs to history/overview) · `soft` (pale emerald, an action repeated down a list, e.g. each row's Log button) · `solid` (filled emerald, a primary action, e.g. sending typed input) · `danger`.
- `edge`: `left` or `right` when the button sits at the edge of a header/toolbar (pulls it out by its padding, so the icon lines up with the edge) — `none` otherwise.
- `size`: `md` (default, `p-2`) or `sm` (`p-1.5` with a `w-5` icon, 32px, for a section heading's controls).
- Don't write a bespoke `p-2 rounded-full hover:bg-stone-100` button; that's what this component is for. A button with genuinely state-dependent styling (e.g. a favorite toggle that turns solid amber) is a legitimate exception — leave it custom rather than forcing a fake variant into the shared component.

## Text inputs

Every text input, native `<select>` and textarea uses the classes from `src/components/ui/Input.tsx`. Don't hand-roll `px-3 py-2 border rounded-lg focus:ring-2 …` again.

```tsx
import { INPUT, INPUT_SM, TEXTAREA } from '@/components/ui/Input';

<input className={INPUT} />                    // a form's field
<input className={`${INPUT_SM} sm:w-32`} />    // compact, plus a width
<textarea className={`${TEXTAREA} min-h-24`} />
```

- **`INPUT` / `TEXTAREA`** are for a form's fields: a `PaneField`'s control, sign-in, an entry's values in the log sheet. The rjsf `.form-control` rule in `globals.css` shares this style.
- **`INPUT_SM` / `TEXTAREA_SM`** are compact, for a dialog, a sheet's settings (e.g. the field editor) or an inline row (e.g. a new category). A single-line `INPUT_SM` is 40px tall, the same as an `md` Button.
- Both sizes have the subtle fill, a hairline border and the focus ring, with no shadow. `sm` is `rounded-lg` and `text-sm`, and the default is `rounded-xl`, the same split as buttons.
- Add a width, extra padding (e.g. `pr-16` for a unit suffix) or a `min-h-*` for a textarea's starting height. These override the shared classes, since those sit in Tailwind's components layer.
- `Select` takes the same `size`, so a select next to a text input matches it. A trigger that opens a picker (e.g. `IconPicker`) uses `INPUT_SM` too.
- The exceptions are inputs that aren't boxes at all: the habit editor's underlined inline title, `AiTweakInput`'s pill-shaped bar, and the textarea on the emerald voice panel.

## Icons

Icons are lucide's (`lucide-react`). One meaning gets one icon everywhere, so a user who's learned it once recognizes it:

| Meaning | Icon | Not |
|---|---|---|
| Add something new (a habit, field, category, user) | `Plus` | |
| Edit something that exists | `Pencil` | `Edit2`, `SquarePen` |
| Write a habit from scratch, by hand | `SquarePen` | |
| Delete | `Trash2` | |
| Remove yourself from something shared | `UserMinus` | `LogOut` (that's signing out) |
| Share, or shared | `Users` | |
| Manage Categories | `FolderTree` | `Settings`, `Settings2` (too like Preferences' `Sliders`) |
| AI does it (generate, change, suggest) | `Sparkles` | `Wand2` |
| A calculated field (worked out from an entry's other fields) | `Calculator` | `Sparkles` (that's AI, and a formula can be written by hand) |
| Speak or type what you did (smart entry) | the quill (`QuillIconWavy`) | |
| Log at another date and time (backdate) | `CalendarClock` | `History` (reads as the History tab) |
| Copy a link | `Link2` | |
| Automation (submit URL, Home Assistant) | `Zap` | |
| Reminders | `AlarmClock`, `AlarmClockOff` when one is off or paused | `Bell` |
| Skip a habit for now (today, this week), or skipped | `SkipForward` | `Ban`, `X` (those read as cancel or delete) |
| Postpone an every-N-days habit (its skip puts it off), or postponed | `CalendarChevronsRight` | `SkipForward` (that's excusing it), `CalendarClock` (that's backdating) |
| Consistency (see `ConsistencyLabel`): thriving, taking root, needs care (freshly planted has none) | The health plant (`PlantIcon`, from `public/plant-health.svg`), always whole: all three stages grown (green), the bottom two (green), the bottom one (amber), the rest in the row calendars' empty gray (`surface-strong/70`) | A flame or a count (it's not a streak) |
| Vacation (everything skipped while away) | `TreePalm` | `Plane`, `Luggage` |
| Backup & Restore (all your data, in Settings) | `DatabaseBackup` | `Archive`, `Save` |
| Download as JSON, or as CSV | `FileJson`, `FileSpreadsheet` (`Download` for a heading's single export button) | |
| Restore from a file you pick | `Upload` | `ArchiveRestore` |
| Back | `ArrowLeft` | |
| Drill into a row | `ChevronRight` at the row's end | |
| Open a page from inside a row that does something else on tap | `ArrowRight` | `ExternalLink` (that means leaving the app) |
| Expand or collapse | `ChevronRight`, turning `rotate-90` while open | swapping in a `ChevronDown` |
| More actions | `MoreVertical` | |
| Confirm, cancel inline | `Check`, `X` in `IconButton`s, with a `title` and `aria-label` | |

- A category with no icon of its own shows `DEFAULT_CATEGORY_ICON` (`src/lib/constants.ts`). Don't write a fallback name inline, and don't save the default into a category that has none. Uncategorized is `UNCATEGORIZED_ICON`.
- A page's or sheet's main submit button gets an icon (`Save`, or `Check` for a sheet's Done). A dialog's buttons don't.

## Toggles and folded settings

An on/off setting is a `<Toggle>` row (`src/components/ui/Toggle.tsx`): icon, title, description, and a switch, with the whole row tappable. Don't hand-roll the `w-12 h-6 rounded-full` switch markup again. In a pane's list, pass `bare` so it's a plain row divided by the list's hairlines; without it, it's a boxed row, for a sheet or dialog.

```tsx
<Toggle icon={<Mic className="w-5 h-5" />} title="Voice Log" description="Fill in the form from what you say" checked={on} onChange={setOn} />
```

Settings that are rarely changed go in a `<CollapsibleSection title="…" summary="…">` (`src/components/CollapsibleSection.tsx`). It's a row in a pane's list that folds its contents away but keeps a one-line summary of their state in view, and unfolds them below it as more rows (e.g. `bare` toggles). The habit editor's More settings is the example.

## Page headers

Every page gets the sticky `<PageHeader>` (`src/components/PageHeader.tsx`), a frosted bar with an optional actions slot on the right. The bottom nav's four tabs use it; drill-in pages already did.

**Bottom nav tabs** (Agenda, Habits, History, Settings) have nothing to go back to, so they pass `showBack={false}`. That also switches the title to the tab style: large, bold, left-aligned on one row, with an optional lighter `subtitle` after it (e.g. today's date as `Oct 4`):

```tsx
<PageHeader
  title="Agenda"
  subtitle="Oct 4"
  showBack={false}
  actions={<SmartEntry size="md" />}
/>
```

**Drill-in pages** (category, habit history, habit log) keep the back control, with a smaller title centered against the bar:

```tsx
<PageHeader
  title={<span className="truncate">{habit.name}</span>}
  backHref="/"                 // omit to use router.back() instead
  actions={<CategoryMenu ... />} // optional right-side slot
/>
```

- Keep tap targets in the bar at least 44px tall: icon buttons, or `md` buttons. `sm` buttons are too small here, and `lg` makes the bar too tall.
- On drill-in pages, `titleInsetClassName` reserves space on each side so the centered title doesn't run under the back control or actions. The default `px-14` clears one icon button; pass `px-24` for two.
- Keep the subtitle short; it doesn't shrink, the title truncates instead.
- Anything `fixed` (a modal, a full-screen panel) rendered from inside the bar should be portaled to `<body>`, as `SmartEntry` and `SpeakOrType` do.

A page that's a step you can't leave (e.g. setting a new password before going on) uses the tab style (`showBack={false}`). Pages with no app around them (signing in, first-time setup) have no header; pass `centered` to `PanePage` instead.

## Panes, not cards

A page's background is always the body's `stone-50`. Lists sit on white running the full width of the screen, with only hairlines between rows, instead of in cards. Everything that isn't a list stays on the stone: text, buttons, chips, empty states, and whatever space is left below the content. Build it from `src/components/Pane.tsx`:

```tsx
<PanePage header={<PageHeader title="Habits" showBack={false} />}>
  <PaneSection title="Categories" action={<IconLinkButton ... className="-my-2" />} empty={noRows && <EmptyState ... />}>
    {rows}
  </PaneSection>
</PanePage>
```

- `PanePage` is the `<main>`: the header, then the sections. Each section spans the screen, while its contents line up in a centered column (`width`: `'4xl'`, the default, `'3xl'`, or `'md'` for a narrow form like signing in). Sections follow each other with no gap, since their headings separate them. Anything else in the column (a line of text, a profile, a button) brings its own vertical padding, usually `py-3` or `py-4`.
- `PaneSection` is a heading over its rows on white, divided by hairlines. Pass `empty` (text or an `<EmptyState>`) for a section with nothing in it; that is shown on the stone instead of an empty white block.
- A section whose content isn't rows (a calendar, a chart) is built by hand: a `<section>` holding a `PaneHeading` with the controls in its `action`, then the content in a `PANE_SURFACE` div with `PANE_INSET` and `py-4`, as the habit log page's Activity and Trends do.
- Content that isn't a list doesn't go on white, even inside a section. For example, Agenda's Done chips sit on the stone under their heading.
- A `PaneHeading` is small uppercase text on the stone. It has more space above it than below (a 16px spacer, then its text sitting low in its band) so it reads as belonging to the section below it, not the one above. White areas (`PANE_SURFACE`) have a `stone-200` hairline along their top and bottom so they read as blocks; don't add shadows or cards to separate sections. It pins just under the page header (`BELOW_HEADER`, from `PageHeader`'s fixed height) while its section scrolls by, until the next section's heading pushes it out. It only sticks within its section, so keep each heading as the first child of the `<section>` holding its content.
- `PANE_INSET` (the `pane-inset` utility in `globals.css`) is the horizontal padding for anything that spans the screen. It pads the element so its contents sit in the page's column, with a 1rem gutter (1.5rem from `sm`). Use it on rows, text blocks and section bodies, never a fixed `px-4 sm:px-6`, or the contents drift to the screen's edges on desktop. `pane-inset-l`, `pane-inset-r` and `pane-inset-nested` cover one side, or a row indented under a subcategory.
- Don't use `pane-inset` on table cells, because percentage padding doesn't size reliably there. A list with columns is flex rows with a fixed-width first column, as the log page's Entries are.
- Rows are `py-3` with `PANE_INSET` padding. Don't put rows in a `rounded-2xl` card.
- The whole row is the tap target, padding included. When a row's padding sits outside its link (because the row also holds a button or a drag handle), stretch the link over the row: `relative` on the row, `after:absolute after:inset-0` on the link, and `relative z-10` on the buttons and handles so they stay above it.
- Without cards to group them, nesting is shown by indenting: a subcategory's habits (`SortableHabitList nested`) line up under the subcategory's name.
- A form is sections like any other page: settings as rows (`pane-inset py-3`), text inputs in a `PANE_SURFACE` block, and its buttons on the stone below. The habit editor (`src/components/HabitEditor.tsx`) and the New Habit page are the examples.
- A habit's category and cadence are pills (`CategoryQuickEdit`, `CadenceQuickEdit`), each opening a small dialog to change it. On a habit's or category's page they sit beside its health (`HealthHeader`): its plant, large, at the start, with its category over its cadence and the pill to skip it (`SkipButton`). Don't stack more lines under them. The viewer's reminder for a habit is part of its cadence's dialog, not a pill of its own: the cadence pill shows `AlarmClock` while one is on (`AlarmClockOff` while it's paused), and nothing while it's off. That holds wherever they appear: the habit's page and the category page save on the spot, while the editor passes `saveLabel="Done"` and only changes its draft. Toasts about a saved change belong to the caller, not the dialog.
- A form field is a `PaneField` row (label, optional description, then the control), and a text input uses the classes from `src/components/ui/Input.tsx` (see Text inputs below). Something added to a list (a field, a category, a user) is a last row with a `+` and emerald text, not a `Button`.
- A habit or category row starts with a ring on the Agenda only (`LogRing`: tap to log, swipe to skip). A limit's ring (an "at most" cadence) fills toward its most allowed with no done check, and turns `warning` amber once over it; its calendar shades kept periods as done and periods that went over in amber (see `ActivityCalendar`). Over a limit is the one place amber means something other than overdue. On the pages for browsing (Habits, a category's page) it starts with its health instead (`HealthMark`), so rows that do different things don't look alike. Don't put rings back on those pages.
- Every page uses panes now. Don't add a page made of `rounded-2xl` cards.

## Section heading controls

A `PaneHeading` (or `PaneSection`'s `action`) can carry controls at its right end, e.g. the Activity time range, the Trends field and chart type, Export CSV, Preview form. They're all 32px tall. `PaneHeading` lets them overhang its padding, so a heading with controls is exactly as tall as one without, and pinned headings don't jump in height as they replace each other. Pass them as siblings: `PaneHeading` lays them out in a row with `gap-2`.

- **A choice between a few options**: `SegmentedControl` (`src/components/ui/SegmentedControl.tsx`). It has no track or outline: its options sit on the background like a ghost button's label, and the chosen one is filled with `surface-strong`. Give each option an `icon` for an icon-only segment (e.g. Bar | Line), and its `label` becomes the tooltip and accessible name. It shows the current state, so don't use a single button that flips between two. In a form (e.g. a sheet's settings), pass `size="md"` for a 40px control on a subtle track that lines up with an `INPUT_SM`; prefer it to a `<select>` when there are only two or three options.
- **An action with an icon**: `IconButton` / `IconLinkButton` with `size="sm"`, a `w-5 h-5` icon, and `edge="right"` when it's last.
- **An action or picker with text**: `Button variant="ghost" size="xs"`, with `-mr-3` when it's last. A picker adds a `ChevronDown` after its label and opens a `MENU_PANEL`.
- **Plain information** (e.g. the one field there is to chart) is plain `text-sm text-ink-muted` text, not a pill that looks like a disabled control.
- Don't use `-my-2` or other margins to squeeze a bigger control in. Use these sizes.

## Dialogs

A centered dialog is a `<Dialog>` (`src/components/ui/Dialog.tsx`), with its buttons in a `<DialogFooter>`. Don't hand-roll the `fixed inset-0` backdrop and white panel. Pass `onClose` to close it on a tap outside, `size="sm"` for a narrow one, and `clip={false}` when a dropdown inside needs to spill out. A sheet from the bottom is `BottomSheet`, and a confirmation is `ConfirmDialog`. Both are built on the same `OVERLAY`.

## Dropdown / popover menus

Any menu anchored to a trigger button (kebab menu, chart field picker, etc.) must include `top-full` in its absolute positioning classes:

```tsx
<div className="absolute right-0 top-full mt-1 w-56 ...">
```

A menu in a `PaneHeading`'s controls needs its trigger to set `aria-expanded` while it's open. Each heading is sticky, so it's a stacking context of its own, and without that the next section's heading covers the menu whatever its z-index; the heading lifts above the others while one of its triggers is expanded.

Style the panel and its items with `MENU_PANEL`, `MENU_ITEM` (`MENU_ITEM_DANGER` for a destructive action), `MENU_SEPARATOR` and `menuOptionClasses(selected)` from `src/components/ui/Menu.tsx`, with a `<MenuBackdrop>` behind it so a tap outside closes it. Position the panel yourself, as above.

A picker for a form field is `Select` (`src/components/Select.tsx`), not a native `<select>`, including in a sheet or dialog. Its list is portaled to `<body>` and fixed to the screen, opening below the field or above it when there's more room there, so a sheet that scrolls can't clip it and the `top-full` rule below doesn't apply to it. For two or three options, use a `SegmentedControl` with `size="md"` instead.

Omitting `top-full` is a real bug we hit, not just a style nit: if the trigger's parent is a flex container with `items-center` (headers are), the browser falls back to vertically centering the absolutely-positioned menu against the trigger's box instead of placing it below — which pushes part of the menu above the viewport. Always pair `absolute` + `right-0`/`left-0` with an explicit `top-full` (or `bottom-full`) when anchoring to a trigger.

## When none of this fits

If a page genuinely needs something these primitives don't cover, extend the primitive (add a variant/size) rather than styling around it inline. If you're not sure whether an existing button/header already covers your case, grep for `Button`, `IconButton`, or `PageHeader` usage in `src/app/` for a nearby example before writing new classes.
