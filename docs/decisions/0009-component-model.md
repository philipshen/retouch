# DR-0009: The component model — instances, lift to prop, detach

- Status: Accepted (RFC rev 13)
- Date: 2026-09-01
- RFC: R-12, OQ-C2, OQ-E3 (b), OQ-E2 tier 1, R-11 (d) exception

## Context

`Button.tsx` renders `<button className="bg-blue-500 px-4">{children}</button>`; `Page.tsx` uses it twelve times. The DOM node the user clicks comes from the definition, so with host-element stamping only every click resolves to `Button.tsx` and every edit hits all twelve buttons, plus every button on pages not open. Tier 1 meets this at once: editing the text "Save" must find the usage site in `Page.tsx`, where the literal lives.

## Options considered

**Stamping (OQ-C2)**
1. Host elements only; component instances opaque. Cannot express "this instance".
2. Stamp usage sites too. Two mechanisms: (a) Onlook's runtime DOM/AST walk relating a child's root element to the parent's call site; (b) a data prop `data-rt-i="<instance ID>"` added to every usage at build time, which reaches the DOM if the component forwards props. Chosen: (b), because it is a pure function of source (consistent with R-10) and needs no runtime inference. Fragments are skipped. A later refinement: inject the instance ID through context at compile time so it reaches the DOM regardless of forwarding.

**Edit unit for shared components (OQ-E3 b)** — as first proposed: definition by default with co-highlight and a file count; "this instance only" offered when detectable; refuse text edits when the instance cannot be identified.

The user redirected this to the Figma component model: instances highlighted differently; explicit "detach" that replaces the shared component with a carbon copy in source; and certain properties (background color, internal text) converted to props so one instance can differ without changing the others.

## The mapping adopted

| Figma | Retouch |
|---|---|
| Main component | Definition file; edits change every instance; explicit action; overlay shows the count of files using it |
| Instance | Usage site; distinct outline; page-wide co-highlight; default click scope |
| Override | A prop at the usage site (`children` text, `className` when forwarded, any declared prop) |
| Component property | A prop declared in the definition with a default |
| Expose property | Lift |
| Detach instance | Duplicate module (always), or inline (pure components only) |
| Reset overrides | Remove the usage site's props |

## Lift, precisely

Before, `Button.tsx`: `export function Button({ children }) { return <button className="bg-blue-500 px-4">{children}</button>; }` and `Page.tsx`: `<Button>Save</Button>`. The user changes one button's background to red. After: `export function Button({ children, bg = "bg-blue-500" }) { return <button className={cn("px-4", bg)}>{children}</button>; }` and `<Button bg="bg-red-500">Save</Button>`.

Rules: the definition gets a destructured prop whose default is the previous literal; the class attribute becomes `cn(<static literal>, <prop identifiers…>)`; the usage site sets the prop. `cn()` is the dynamic-className shape the writer refuses elsewhere; it is allowed here because the writer generated it and knows its exact grammar. The writer edits a `cn()` call only when it matches that shape. Lift is refused unless the value is a literal in the definition and the component's parameter shape is on the supported list (`(props)`, `({a, b})`, typed variants, `forwardRef`, `memo`). Prop names are suggested from the property (`bg`, `label`) and confirmed by the user.

## Detach, precisely

1. Duplicate module: copy the definition file under a new component name; rewire this usage site's import. Always possible, including components with hooks and state.
2. Inline: replace the usage with the definition's JSX, props substituted. The literal Figma behavior. Deterministic only for a pure JSX-return function with no hooks, state, or logic; refused otherwise. The user's instruction: "duplicate, and inline if necessary."

Both touch two files, so R-11 (d) gains an exception: detach is a transaction that creates the new file first and removes it if the usage edit fails.

## Decision

All of the above, as R-12. The user's answers: default click scope on an instance is the instance, with edit-main and detach as explicit actions; detach by duplicate, inline when necessary; lift with the generated `cn()` shape and user-confirmed prop names; and, overriding the proposed tiering, every component feature is tier 1.

## Consequences

- OQ-E2 tier 1 now includes instance highlight and co-highlight, instance text, lift, edit main, and both detach flavors.
- Components from `node_modules` have no editable definition; their usage sites remain editable through props, which the instance ID makes possible.
- Instance-level ops without an instance ID in the DOM are refused with a reason; the context-injection refinement would remove most such refusals.
- P2's gesture annex must include the component actions and their refusal cases.
