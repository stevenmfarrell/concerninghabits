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

- `variant`: `default` (stone, most icon buttons) · `accent` (emerald, e.g. link-outs to history/overview) · `solid` (filled emerald, a row's primary action, e.g. logging a habit) · `danger`.
- `edge`: `left` or `right` when the button sits at the edge of a header/toolbar (adds the `-ml-2`/`-mr-2` optical alignment) — `none` otherwise.
- Don't write a bespoke `p-2 rounded-full hover:bg-stone-100` button; that's what this component is for. A button with genuinely state-dependent styling (e.g. a favorite toggle that turns solid amber) is a legitimate exception — leave it custom rather than forcing a fake variant into the shared component.

## Page headers

Two patterns only. Don't invent a third.

**Sticky header** — any page reached by drilling into a record (category, habit history, habit log). Use `<PageHeader>` (`src/components/PageHeader.tsx`):

```tsx
<PageHeader
  title={<span className="truncate">{habit.name}</span>}
  backHref="/"                 // omit to use router.back() instead
  actions={<CategoryMenu ... />} // optional right-side slot
/>
```

If the right-side slot needs more horizontal clearance than one icon (e.g. two icon buttons), pass `titleInsetClassName="px-24"` so the centered title doesn't collide with it.

**In-flow back link** — root-level or wizard-style pages that scroll under a plain `<h1>` (settings sub-pages, create/refine). Use `<BackLink href="/settings">Settings</BackLink>` (`src/components/BackLink.tsx`), not a hand-written `<Link>` with an `ArrowLeft` icon.

## Dropdown / popover menus

Any menu anchored to a trigger button (kebab menu, chart field picker, etc.) must include `top-full` in its absolute positioning classes:

```tsx
<div className="absolute right-0 top-full mt-1 w-56 ...">
```

Omitting `top-full` is a real bug we hit, not just a style nit: if the trigger's parent is a flex container with `items-center` (headers are), the browser falls back to vertically centering the absolutely-positioned menu against the trigger's box instead of placing it below — which pushes part of the menu above the viewport. Always pair `absolute` + `right-0`/`left-0` with an explicit `top-full` (or `bottom-full`) when anchoring to a trigger.

## When none of this fits

If a page genuinely needs something these primitives don't cover, extend the primitive (add a variant/size) rather than styling around it inline. If you're not sure whether an existing button/header already covers your case, grep for `Button`, `IconButton`, or `PageHeader` usage in `src/app/` for a nearby example before writing new classes.
