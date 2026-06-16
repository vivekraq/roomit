import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDb, getClient, ObjectId } from "./db.js";
import { createBookingSchema } from "./validators.js";
import { isDuplicateKey, sendError } from "./errors.js";
import {
  bookingStartDate,
  daySlotGrid,
  getHeldSlots,
  getSlotsBetween,
  timeToMinutes
} from "./time.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/rooms", async (_req, res, next) => {
  try {
    const db = await connectDb();
    const rooms = await db.collection("rooms").find({}).sort({ name: 1 }).toArray();
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

app.get("/api/rooms/:id/availability", async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return sendError(res, 400, "date must be YYYY-MM-DD");
    }

    const db = await connectDb();
    const room = await db.collection("rooms").findOne({ _id: new ObjectId(req.params.id) });
    if (!room) return sendError(res, 404, "Room not found");

    const holds = await db.collection("slotHolds")
      .find({ roomId: room._id, date, status: "held" })
      .toArray();
    const heldBySlot = new Map(holds.map((hold) => [hold.slotStart, hold.bookingId?.toString()]));

    const slots = daySlotGrid().map((slotStart) => ({
      slotStart,
      available: !heldBySlot.has(slotStart),
      bookingId: heldBySlot.get(slotStart) || null
    }));

    res.json({ room, date, slots });
  } catch (error) {
    next(error);
  }
});

app.post("/api/bookings", async (req, res, next) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "Invalid booking payload", parsed.error.flatten());
  }

  const payload = parsed.data;
  const client = getClient();
  const session = client.startSession();

  try {
    const db = await connectDb();
    const result = await session.withTransaction(async () => {
      const room = await db.collection("rooms").findOne(
        { _id: new ObjectId(payload.roomId) },
        { session }
      );
      if (!room) {
        const error = new Error("Room not found");
        error.status = 404;
        throw error;
      }

      const bookingSlots = getSlotsBetween(payload.startTime, payload.endTime);
      if (bookingSlots.length === 0) {
        const error = new Error("Booking must use one or more consecutive 30-minute slots");
        error.status = 400;
        throw error;
      }

      const heldSlots = getHeldSlots(payload.startTime, payload.endTime, room.bufferMinutes);
      const requestedMinutes = timeToMinutes(payload.endTime) - timeToMinutes(payload.startTime);
      const quotaId = `${payload.bookedBy.email}|${payload.date}`;
      const quota = await db.collection("userDailyQuotas").findOneAndUpdate(
        { _id: quotaId },
        [
          {
            $set: {
              email: payload.bookedBy.email,
              date: payload.date,
              createdAt: { $ifNull: ["$createdAt", new Date()] },
              usedMinutes: { $ifNull: ["$usedMinutes", 0] }
            }
          },
          {
            $set: {
              quotaAccepted: {
                $lte: [{ $add: ["$usedMinutes", requestedMinutes] }, 240]
              }
            }
          },
          {
            $set: {
              usedMinutes: {
                $cond: [
                  "$quotaAccepted",
                  { $add: ["$usedMinutes", requestedMinutes] },
                  "$usedMinutes"
                ]
              },
              updatedAt: new Date()
            }
          }
        ],
        {
          session,
          upsert: true,
          returnDocument: "after"
        }
      );

      if (!quota?.quotaAccepted) {
        const error = new Error("Daily booking quota exceeded for this user");
        error.status = 409;
        error.details = {
          date: payload.date,
          quotaMinutes: 240,
          requestedMinutes
        };
        throw error;
      }

      const bookingDoc = {
        roomId: room._id,
        roomName: room.name,
        date: payload.date,
        startTime: payload.startTime,
        endTime: payload.endTime,
        slots: bookingSlots,
        heldSlots,
        bookedBy: payload.bookedBy,
        title: payload.title,
        status: "confirmed",
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const insertResult = await db.collection("bookings").insertOne(bookingDoc, { session });
      const holdDocs = heldSlots.map((slotStart) => ({
        bookingId: insertResult.insertedId,
        roomId: room._id,
        date: payload.date,
        slotStart,
        status: "held",
        createdAt: new Date()
      }));

      await db.collection("slotHolds").insertMany(holdDocs, { session, ordered: true });
      return { ...bookingDoc, _id: insertResult.insertedId };
    });

    res.status(201).json(result);
  } catch (error) {
    if (isDuplicateKey(error)) {
      return sendError(res, 409, "One or more requested slots are no longer available");
    }
    if (error.status) {
      return sendError(res, error.status, error.message, error.details);
    }
    next(error);
  } finally {
    await session.endSession();
  }
});

app.get("/api/bookings", async (req, res, next) => {
  try {
    const email = String(req.query.email || "").toLowerCase();
    if (!email) return sendError(res, 400, "email is required");

    const db = await connectDb();
    const bookings = await db.collection("bookings")
      .find({ "bookedBy.email": email })
      .sort({ date: -1, startTime: -1 })
      .toArray();
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/bookings/:id/cancel", async (req, res, next) => {
  const client = getClient();
  const session = client.startSession();

  try {
    const db = await connectDb();
    const bookingId = new ObjectId(req.params.id);
    const result = await session.withTransaction(async () => {
      const booking = await db.collection("bookings").findOne({ _id: bookingId }, { session });
      if (!booking) {
        const error = new Error("Booking not found");
        error.status = 404;
        throw error;
      }
      if (booking.status !== "confirmed") {
        const error = new Error("Only confirmed bookings can be cancelled");
        error.status = 409;
        throw error;
      }

      const start = bookingStartDate(booking.date, booking.startTime);
      const twoHoursMs = 2 * 60 * 60 * 1000;
      const status = start.getTime() - Date.now() >= twoHoursMs
        ? "cancelled-refundable"
        : "cancelled-non-refundable";

      await db.collection("bookings").updateOne(
        { _id: bookingId, status: "confirmed" },
        { $set: { status, cancelledAt: new Date(), updatedAt: new Date() } },
        { session }
      );
      await db.collection("slotHolds").deleteMany({ bookingId }, { session });
      const bookingMinutes = timeToMinutes(booking.endTime) - timeToMinutes(booking.startTime);
      await db.collection("userDailyQuotas").findOneAndUpdate(
        { _id: `${booking.bookedBy.email}|${booking.date}` },
        [
          {
            $set: {
              usedMinutes: {
                $max: [{ $subtract: [{ $ifNull: ["$usedMinutes", 0] }, bookingMinutes] }, 0]
              },
              updatedAt: new Date()
            }
          }
        ],
        { session }
      );

      return { ...booking, status, cancelledAt: new Date() };
    });

    res.json(result);
  } catch (error) {
    if (error.status) return sendError(res, error.status, error.message);
    next(error);
  } finally {
    await session.endSession();
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  sendError(res, 500, "Unexpected server error");
});

const port = process.env.PORT || 4000;
connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`RoomIt API listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start API", error);
    process.exit(1);
  });
