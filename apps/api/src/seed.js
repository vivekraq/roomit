import "dotenv/config";
import { connectDb } from "./db.js";
import { getHeldSlots, getSlotsBetween } from "./time.js";

const rooms = [
  { name: "Orion", location: "Floor 1 - East Wing", capacity: 6, bufferMinutes: 0 },
  { name: "Nimbus", location: "Floor 2 - Near Pantry", capacity: 10, bufferMinutes: 10 },
  { name: "Atlas", location: "Floor 3 - Board Area", capacity: 14, bufferMinutes: 10 },
  { name: "Pixel", location: "Floor 1 - Focus Zone", capacity: 4, bufferMinutes: 0 }
];

function todayOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function plusHours(hours) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const minutes = date.getMinutes() < 30 ? "30" : "00";
  if (minutes === "00") date.setHours(date.getHours() + 1);
  return `${String(date.getHours()).padStart(2, "0")}:${minutes}`;
}

function addMinutes(time, minutesToAdd) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function main() {
  const db = await connectDb();
  await db.collection("slotHolds").deleteMany({});
  await db.collection("bookings").deleteMany({});
  await db.collection("rooms").deleteMany({});
  await db.collection("userDailyQuotas").deleteMany({});

  const inserted = await db.collection("rooms").insertMany(rooms);
  const roomDocs = rooms.map((room, index) => ({
    ...room,
    _id: inserted.insertedIds[index]
  }));

  const nearStart = plusHours(1);
  const bookings = [
    {
      room: roomDocs[0],
      date: todayOffset(0),
      startTime: "10:00",
      endTime: "11:00",
      bookedBy: { name: "Asha Mehta", email: "asha@example.com" },
      title: "Sprint planning"
    },
    {
      room: roomDocs[1],
      date: todayOffset(0),
      startTime: "14:00",
      endTime: "15:30",
      bookedBy: { name: "Dev Shah", email: "dev@example.com" },
      title: "Design review"
    },
    {
      room: roomDocs[2],
      date: todayOffset(1),
      startTime: "11:30",
      endTime: "12:30",
      bookedBy: { name: "Mira Rao", email: "mira@example.com" },
      title: "Client prep"
    },
    {
      room: roomDocs[3],
      date: todayOffset(0),
      startTime: nearStart,
      endTime: addMinutes(nearStart, 60),
      bookedBy: { name: "Refund Tester", email: "refund@example.com" },
      title: "Starts within two hours"
    }
  ];

  for (const booking of bookings) {
    const doc = {
      roomId: booking.room._id,
      roomName: booking.room.name,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      slots: getSlotsBetween(booking.startTime, booking.endTime),
      heldSlots: getHeldSlots(booking.startTime, booking.endTime, booking.room.bufferMinutes),
      bookedBy: booking.bookedBy,
      title: booking.title,
      status: "confirmed",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection("bookings").insertOne(doc);
    await db.collection("slotHolds").insertMany(doc.heldSlots.map((slotStart) => ({
      bookingId: result.insertedId,
      roomId: doc.roomId,
      date: doc.date,
      slotStart,
      status: "held",
      createdAt: new Date()
    })));
    await db.collection("userDailyQuotas").updateOne(
      { _id: `${doc.bookedBy.email}|${doc.date}` },
      {
        $setOnInsert: {
          email: doc.bookedBy.email,
          date: doc.date,
          createdAt: new Date()
        },
        $inc: { usedMinutes: (doc.slots.length * 30) },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
  }

  console.log(`Seeded ${roomDocs.length} rooms and ${bookings.length} bookings.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
