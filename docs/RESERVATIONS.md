# BOA — reservations

Booking a service at BOA. The whole design exists to make one thing impossible:
two customers holding the same seat.

## Model

```
services ──► availability_rules      recurring: "Tuesdays 09:00–17:00, 45min, 1 seat"
         ├─► availability_exceptions closures and one-off openings
         └─► slots                   concrete, materialised, bookable
                └─► reservation_seats  one row per booked seat
                        └─► reservations
```

- A **rule** is a recurring pattern in `Africa/Tunis` local time.
- An **exception** closes a date (a holiday) or opens one outside the pattern.
- A **slot** is a materialised bookable moment with a capacity. Rules generate
  slots; slots are what customers actually book.
- A **seat** is a row with `UNIQUE (slot_id, seat_index)`.

`modules/reservations/availability.ts` projects rules and exceptions into slots
for a horizon. It never invents availability: a service with no rules offers
nothing, and the page says so rather than showing an empty calendar.

## Booking

`modules/reservations/booking.ts → createReservation()`, one transaction, two
independent guarantees:

1. `SELECT … FROM slots WHERE id = ? FOR UPDATE` — serialises concurrent
   bookers on the same slot.
2. `INSERT INTO reservation_seats (slot_id, seat_index, …)` — the unique index
   makes a double booking physically impossible even if the lock were ever
   wrong.

`ER_DUP_ENTRY` is translated into `AppError('slot_unavailable')`, which the
calendar renders as "this time was just taken", removes from the choices, and
refreshes — because a taken slot has to *disappear*, not merely produce a
message.

Creation is guarded by an **idempotency key** generated in the browser, so a
double-tap on a slow connection books once.

This is covered by an end-to-end test that races two real browsers at the same
slot and asserts exactly one succeeds.

## Times

Slot times are formatted **on the server**, in `Africa/Tunis`, and shipped as
strings (`BookableDay.slots[].time`). The browser only chooses which day's list
to show. Formatting client-side would offer a customer in Paris "10:00" for a
slot BOA holds at 09:00.

## Lifecycle

`PENDING → CONFIRMED → COMPLETED`, with `CANCELLED` and `NO_SHOW` as terminal
outcomes. Staff move reservations from `/admin/reservations`; every change is
audited. Cancelling frees the seat row, which returns the slot to availability.

Reservations snapshot the service name, duration, price and customer details, so
renaming or repricing a service later cannot alter a past booking.

## Surfaces

- `/[locale]/services` and `/[locale]/services/[slug]` — what is offered
- `/[locale]/reserver/[slug]` — the calendar and the booking form
- `/[locale]/reservation/[reference]` — confirmation
- `/[locale]/compte/reservations` — a customer's bookings
- `/admin/services`, `/admin/reservations` — staff
