# UI standards

Read this before touching any page under `src/app/` or `src/components/`. It exists because the UI drifted into 3 different header styles and 2 different button roundings before being unified — don't recreate that drift by hand-rolling markup these primitives already cover.

## Buttons

Never write raw `<button className="bg-emerald-600 ...">` or `<Link className="px-4 py-2 ...">` for anything that behaves like a button. Use:

```tsx
import { Button, LinkButton } from '@/components/ui/Button';

<Button variant="primary" size="lg">Save Changes</Button>
<LinkButton href="/create" variant="outline">Cancel</LinkButton>
```

- **variant**: `primary` (emerald, main CTA) · `secondary` (stone-900, non-destructive secondary action) · `outline` (neutral bordered) · `ghost` (text-only, e.g. Cancel/Log Out) · `danger` (red filled, destructive confirm) · `danger-ghost` (red text, e.g. "Delete Habit" trigger before the confirm dialog) · `inverse` / `inverse-ghost` (white button / light text, for dark emerald surfaces like the smart entry panel)
- **size**: `sm` (rounded-lg, compact controls like inline toggles) · `md` (default, most form buttons) · `lg` · `xl` (rounded-xl, big CTAs)
- Only `sm` uses `rounded-lg`. Every other size is `rounded-xl` — don't introduce a third radius.
- For destructive confirmations, use `<ConfirmDialog>` (`src/components/ConfirmDialog.tsx`) rather than building a custom modal — it already wires up the danger/ghost button pair.

## Icon-only buttons

```tsx
import { IconButton, IconLinkButton } from '@/components/ui/IconButton';

<IconButton onClick={...} edge="right" title="More options"><MoreVertical /></IconButton>
<IconLinkButton href="/settings" edge="left" title="Back"><ArrowLeft /></IconLinkButton>
```

- `variant`: `default` (stone, most icon buttons) · `accent` (emerald, e.g. link-outs to history/overview) · `soft` (pale emerald, an action repeated down a list, e.g. each row's Log button) · `solid` (filled emerald, a primary action, e.g. sending typed input) · `danger`.
- `edge`: `left` or `right` when the button sits at the edge of a header/toolbar (adds the `-ml-2`/`-mr-2` optical alignment) — `none` otherwise.
- Don't write a bespoke `p-2 rounded-full hover:bg-stone-100` button; that's what this component is for. A button with genuinely state-dependent styling (e.g. a favorite toggle that turns solid amber) is a legitimate exception — leave it custom rather than forcing a fake variant into the shared component.

## Toggles and folded settings

An on/off setting is a `<Toggle>` row (`src/components/ui/Toggle.tsx`): icon, title, description, and a switch, with the whole row tappable. Don't hand-roll the `w-12 h-6 rounded-full` switch markup again.

```tsx
<Toggle icon={<Mic className="w-5 h-5" />} title="Voice Log" description="Fill in the form from what you say" checked={on} onChange={setOn} />
```

Settings that are rarely changed go in a `<CollapsibleSection title="…" summary="…">` (`src/components/CollapsibleSection.tsx`), a card that folds away but keeps a one-line summary of its state in view.

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

**Legacy, being phased out:** `<BackLink>` (`src/components/BackLink.tsx`) on settings sub-pages and wizards (create/refine). Don't use either on a new page; move a page to `<PageHeader>` when you rework it.

## Panes, not cards

A page's background is always the body's `stone-50`. Lists sit on white running the full width of the screen, with only hairlines between rows, instead of in cards. Everything that isn't a list stays on the stone: text, buttons, chips, empty states, and whatever space is left below the content. Build it from `src/components/Pane.tsx`:

```tsx
<PanePage header={<PageHeader title="Habits" showBack={false} />}>
  <PaneSection title="Categories" action={<IconLinkButton ... className="-my-2" />} empty={noRows && <EmptyState ... />}>
    {rows}
  </PaneSection>
</PanePage>
```

- `PanePage` is the `<main>`: the header, then the sections. Each section spans the screen, while its contents line up in a centered column (`width`: `'4xl'`, the default, or `'3xl'`). Sections follow each other with no gap, since their headings separate them. Anything else in the column (a line of text, a profile, a button) brings its own vertical padding, usually `py-3` or `py-4`.
- `PaneSection` is a heading over its rows on white, divided by hairlines. Pass `empty` (text or an `<EmptyState>`) for a section with nothing in it; that is shown on the stone instead of an empty white block.
- A section whose content isn't rows (a calendar, a chart) is built by hand: a `<section>` holding a `PaneHeading` with the controls in its `action`, then the content in a `PANE_SURFACE` div with `PANE_INSET` and `py-4`, as the habit log page's Activity and Trends do.
- Content that isn't a list doesn't go on white, even inside a section. For example, Agenda's Done chips sit on the stone under their heading.
- A `PaneHeading` is small uppercase text on the stone. It pins just under the page header (`BELOW_HEADER`, from `PageHeader`'s fixed height) while its section scrolls by, until the next section's heading pushes it out. It only sticks within its section, so keep each heading as the first child of the `<section>` holding its content.
- `PANE_INSET` (the `pane-inset` utility in `globals.css`) is the horizontal padding for anything that spans the screen. It pads the element so its contents sit in the page's column, with a 1rem gutter (1.5rem from `sm`). Use it on rows, text blocks and section bodies, never a fixed `px-4 sm:px-6`, or the contents drift to the screen's edges on desktop. `pane-inset-l`, `pane-inset-r` and `pane-inset-nested` cover one side, or a row indented under a subcategory.
- Don't use `pane-inset` on table cells, because percentage padding doesn't size reliably there. A list with columns is flex rows with a fixed-width first column, as the log page's Entries are.
- Rows are `py-3` with `PANE_INSET` padding. Don't put rows in a `rounded-2xl` card.
- Without cards to group them, nesting is shown by indenting: a subcategory's habits (`SortableHabitList nested`) line up under the subcategory's name.
- Converted: the four tabs, the category page and the habit log page. Settings sub-pages and forms still use cards; move each one over when you rework it.

## Dropdown / popover menus

Any menu anchored to a trigger button (kebab menu, chart field picker, etc.) must include `top-full` in its absolute positioning classes:

```tsx
<div className="absolute right-0 top-full mt-1 w-56 ...">
```

Omitting `top-full` is a real bug we hit, not just a style nit: if the trigger's parent is a flex container with `items-center` (headers are), the browser falls back to vertically centering the absolutely-positioned menu against the trigger's box instead of placing it below — which pushes part of the menu above the viewport. Always pair `absolute` + `right-0`/`left-0` with an explicit `top-full` (or `bottom-full`) when anchoring to a trigger.

## When none of this fits

If a page genuinely needs something these primitives don't cover, extend the primitive (add a variant/size) rather than styling around it inline. If you're not sure whether an existing button/header already covers your case, grep for `Button`, `IconButton`, or `PageHeader` usage in `src/app/` for a nearby example before writing new classes.
