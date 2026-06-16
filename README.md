# RoomIt - Meeting Room Booking System

RoomIt is a full-stack take-home assignment implementation for booking meeting rooms with correctness under concurrent requests.

## Stack

- Next.js App Router frontend
- Node.js / Express API
- MongoDB with transactions and unique indexes

## Implemented Requirements

### Core

- Room list and room detail availability grid
- 30-minute slot booking
- Multi-slot consecutive bookings
- Booking lookup by email
- Server-side cancellation with refundable/non-refundable status
- Availability derived from the same `slotHolds` source of truth used by booking creation
- Database-level double-booking prevention

### Section 4 choices

Implemented 2 extended requirements:

1. **Buffer time between bookings**
   - Rooms have a configurable `bufferMinutes` value.
   - Booking creation stores both the visible booked slots and any blocked buffer slots.
   - Availability uses the same held slots, so buffer time is unavailable in the UI and rejected by the API.

2. **Per-user daily booking quota**
   - Users can book at most 4 hours per day.
   - Quota is enforced server-side in the same MongoDB transaction as booking creation.
   - The quota document is updated atomically with a MongoDB pipeline update.
   - Cancellation returns the booked minutes to the user's daily quota.

## Why Double Booking Is Prevented

The API does not rely on a read-then-write availability check.

Each booked 30-minute slot is written to the `slotHolds` collection. The collection has a unique partial index:

```js
{ roomId: 1, date: 1, slotStart: 1 }
```

Only one active hold can exist for the same room, date, and slot. If two requests try to book the same slot at the same time, MongoDB accepts one insert and rejects the other with a duplicate key error. The API returns `409 Conflict` for the losing request.

Multi-slot bookings run inside a MongoDB transaction. If any slot conflicts, the whole booking fails and no partial booking remains.

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` in the project root and set:

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/roomit
PORT=4000
CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

MongoDB transactions require a replica set. MongoDB Atlas works for this assignment.

### 3. Seed data

```bash
npm run seed
```

The seed creates 4 rooms and a mix of bookings, including one booking that starts within the next 2 hours for non-refundable cancellation testing.

### 4. Run both apps

```bash
npm run dev
```

Frontend: `http://localhost:3000`

API: `http://localhost:4000`

## API Endpoints

```txt
GET /api/rooms
GET /api/rooms/:id/availability?date=YYYY-MM-DD
POST /api/bookings
GET /api/bookings?email=name@example.com
PATCH /api/bookings/:id/cancel
```

## Double-Booking Demo

Start the API, then run:

```bash
npm run race-demo
```

Expected result:

- One request returns `201 Created`
- One request returns `409 Conflict`

This demonstrates that near-simultaneous requests for the same room and time cannot both succeed.

## Walkthrough Video Checklist

Use this flow for the required 8-12 minute video:

1. Show the seeded rooms page.
2. Open a room and book one or more consecutive slots.
3. Refresh/search availability to show the booked slots are unavailable.
4. Run `npm run race-demo` and show exactly one request succeeds.
5. Search bookings by email on `/bookings`.
6. Cancel a booking more than 2 hours before start and show `cancelled-refundable`.
7. Cancel the seeded `refund@example.com` booking that starts within 2 hours and show `cancelled-non-refundable`.
8. Demonstrate buffer time by booking in a room with a 10-minute buffer, then show the blocked following slot.
9. Demonstrate the 4-hour daily quota by attempting to exceed 4 hours for one email.
10. Explain the `slotHolds` unique index and why read-then-write availability checks are unsafe.
11. Mention one improvement, such as adding authentication or recurring bookings.

## Deployment Notes

Suggested deployment:

- Frontend: Vercel
- API: Render or Railway
- Database: MongoDB Atlas

Set these environment variables in deployment:

API service:

```bash
MONGODB_URI=...
PORT=4000
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

Vercel frontend:

```bash
NEXT_PUBLIC_API_URL=https://your-api-service.onrender.com
```

## Assumptions

- No authentication is required; users are identified by email.
- Business hours are 08:00-20:00.
- All booking times are treated as server/local date strings for assignment simplicity.
- Buffer time blocks the next 30-minute grid slot when the configured buffer overlaps it.
