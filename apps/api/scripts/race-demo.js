const API_URL = process.env.API_URL || "http://localhost:4000";

function demoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7 + Math.floor(Math.random() * 30));
  return date.toISOString().slice(0, 10);
}

async function main() {
  const roomsResponse = await fetch(`${API_URL}/api/rooms`);
  if (!roomsResponse.ok) {
    throw new Error(`Could not fetch rooms from ${API_URL}. Status: ${roomsResponse.status}`);
  }

  const rooms = await roomsResponse.json();
  const room = rooms[0];
  if (!room) throw new Error("No rooms found. Seed the database first.");

  const payload = {
    roomId: room._id.toString(),
    date: demoDate(),
    startTime: "16:00",
    endTime: "17:00",
    bookedBy: { name: "Race Demo", email: "race@example.com" },
    title: "Concurrency test"
  };

  console.log(`Using API: ${API_URL}`);
  console.log(`Room: ${room.name}`);
  console.log(`Date/time: ${payload.date} ${payload.startTime}-${payload.endTime}`);
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
