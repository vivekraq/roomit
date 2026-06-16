import "dotenv/config";
import { connectDb } from "../src/db.js";

const API_URL = process.env.API_URL || "http://localhost:4000";

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const db = await connectDb();
  const room = await db.collection("rooms").findOne({});
  if (!room) {
    throw new Error("No rooms found. Run npm run seed first.");
  }

  const payload = {
    roomId: room._id.toString(),
    date: tomorrow(),
    startTime: "16:00",
    endTime: "17:00",
    bookedBy: { name: "Race Demo", email: "race@example.com" },
    title: "Concurrency test"
  };

  console.log("Firing two near-simultaneous requests for the same room/time...");
  const [first, second] = await Promise.all([
    postBooking(payload),
    postBooking({ ...payload, bookedBy: { name: "Race Demo 2", email: "race2@example.com" } })
  ]);

  console.table([
    { request: "A", status: first.status, body: JSON.stringify(first.body) },
    { request: "B", status: second.status, body: JSON.stringify(second.body) }
  ]);
  console.log("Expected: exactly one 201 Created and one 409 Conflict.");
  process.exit(0);
}

async function postBooking(payload) {
  const response = await fetch(`${API_URL}/api/bookings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
