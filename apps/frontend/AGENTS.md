# Frontend Agent — Arena Kalikesek

## Scope

This guide applies to `src/app/**`, except that the more specific `src/app/api/AGENTS.md` governs API routes.

Frontend-owned areas include:

- Public pages and layouts
- Booking and checkout forms
- Schedule selection UI
- Dashboard and invoice presentation
- Client-side state and navigation
- Loading, empty, success, and error states
- Responsive behavior
- Calls to internal `/api/**` routes

Related frontend-owned paths outside this directory:

- `src/components/**`
- `public/**`
- `src/app/globals.css`
- Presentation-focused Markdown content under `src/content/**`

## Primary objective

Build a clear, lightweight, responsive interface while preserving Arena Kalikesek branding and the working booking/payment flow.

Do not perform a broad redesign unless explicitly requested.

## Frontend boundaries

The frontend must not:

- Import `@/lib/supabase-server`, server-only Midtrans code, or WhatsApp server code.
- Read server secrets.
- Directly use the Supabase service role key.
- Decide that a payment is successful.
- Treat browser-supplied price, total, booking status, or availability as authoritative.
- Write production database records directly when an internal API route already owns the operation.
- Hardcode business rules or authoritative lists that the backend owns (store products, selected categories, price thresholds) — fetch them from backend APIs or `@repo/shared-utils` instead; display what the server sends.

The frontend may calculate an estimated total for display, but the backend response is the final authority.

## Existing route responsibilities

Preserve these routes unless the task explicitly changes them:

- `/` — main landing page
- `/wisata` — wisata listing
- `/jadwal` — schedule and availability selection
- `/booking/wisata` — booking form and checkout handoff
- `/booking/sukses` — payment completion flow
- `/toko` and `/toko/checkout` — store flow
- `/dashboard` — booking administration view
- `/invoice/[id]` — invoice presentation
- `/blog` and `/blog/[slug]` — report/article content
- `/kontak`, `/webgis`, and `/eduwisata-gula-aren`

## UI implementation rules

- Reuse existing components before introducing new abstractions.
- Keep components focused; extract repeated UI or business-independent interaction logic.
- Keep page files readable by moving reusable controls into `src/components` when justified.
- Use semantic HTML and visible form labels.
- Ensure keyboard access, focus states, and clear disabled states.
- Add `aria-*` attributes only where native semantics are insufficient.
- Use `next/image` for appropriate production images unless there is a clear reason not to.
- Preserve responsive layouts and prevent horizontal overflow.
- Use Indonesian date and currency formatting for users.
- Avoid unnecessary animations and expensive scroll effects.
- Respect reduced-motion preferences for added motion.

## Booking schedule rules

When working on `/jadwal` or `/booking/wisata`, keep hourly rental and overnight stays separate.

Availability calendars come from the backend and already count `hold` slots as taken (consistent with `reserve_booking`). Treat any date/time not returned as available as unavailable — do not re-derive availability client-side.

### Hourly venue rental

- Business hours: 07.00–17.00 WIB.
- Minimum duration: 1 hour.
- End time must be after start time.
- Show booked and available states clearly.
- Preserve selected venue, date, start time, end time, and add-ons when navigating to booking.
- Do not use URL price values as a source of truth.

### Homestay and camping

- Use separate check-in and check-out values.
- Check-out must be after check-in.
- Calculate nights without counting the check-out date.
- Do not allow a selected range to cross blocked dates.
- Preserve unit, range, guest count, and add-ons during navigation and refresh where feasible.
- Capacity and extra-guest charges shown in the UI must still be validated by the backend.

### Eduwisata

Eduwisata combines activities with optional accommodation (camping/glamping) into a single package.

- Available sub-filters under the Eduwisata category: Semua, Harian (tanpa menginap), Plus Camping, Plus Glamping.
- Global daily quota: maximum 2 rombongan (groups) per day across all Eduwisata packages.
- Quota is enforced server-side via the `edu_trip_reservations` table; Eduwisata bookings use `booking_mode: 'edu_trip'`.
- Frontend shows remaining quota when the user selects a date, and must not rely solely on client values for availability.
- When quota is full, show: "Kuota Eduwisata pada tanggal ini sudah penuh." and block submission.
- Pricing is per person (`unit: 'orang'`); the backend total is authoritative.
- The camping/glamping add-ons are included in the package price; separate check-in/check-out stay logic does not apply to fixed Eduwisata packages.

### Paket makanan

- Paket makanan (food packages) have been completely removed from `storeProducts` in `packages/shared-utils/src/pricing.ts`.
- The frontend (`apps/frontend/src/app/toko/page.tsx`) explicitly excludes any products with category `paket-makanan` or names starting with 'Paket ' to ensure they do not display on the Store page under any circumstances.
- Do not re-add food packages or display them without an explicit request.

## API consumption

- Centralize repeated fetch logic when it improves consistency.
- Handle non-2xx responses explicitly.
- Show a useful loading state while awaiting data.
- Show a retryable error state for recoverable failures.
- Avoid leaking raw backend errors or stack traces to users.
- Use `AbortController` for requests that can become stale due to navigation or changing filters.
- Avoid duplicate submission by disabling the action while a request is pending.

Example expectation:

```ts
const response = await fetch('/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

const result = await response.json()
if (!response.ok) {
  throw new Error(result.error ?? 'Permintaan gagal diproses')
}
```

## State and data rules

- Keep booking state typed.
- Avoid duplicating the official catalog or price table across multiple pages.
- Store stable identifiers, not only display names.
- Separate raw API models from UI view models when field names differ.
- Do not silently mutate booking selections when the user changes tabs.
- Reset dependent values only when they become invalid.

## Frontend validation

Client validation improves usability but does not replace backend validation.

Validate at minimum:

- Required customer fields
- Indonesian phone-number shape at a reasonable level
- Valid dates and time order
- Positive integer quantities
- Guest counts and visible capacity rules
- Required item selection
- Duplicate submit prevention

## Styling rules

- Use the existing Tailwind setup and classes from `globals.css`.
- Preserve the existing green/emerald visual identity unless explicitly asked to change it.
- Do not introduce a second styling system.
- Avoid large inline style objects.
- Keep mobile layout usable at narrow widths before optimizing desktop embellishments.

## Frontend verification

For frontend-only changes, run:

```bash
npm run lint
npm run build
```

Also inspect:

- Mobile and desktop layout from code and existing responsive classes
- Form submission states
- Empty/error/loading states
- Navigation parameters or stored booking state
- No client import of server-only modules
- No secret included in the client bundle

Do not launch heavy browser automation unless explicitly requested.

## Frontend completion report

Report:

- Pages/components changed
- State or API payload changes
- Responsive/accessibility impact
- Any backend dependency
- Lint and build results
