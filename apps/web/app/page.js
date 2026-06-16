import Link from "next/link";
import { api } from "./lib/api";

export default async function RoomsPage() {
  let rooms = [];
  let error = null;

  try {
    rooms = await api("/api/rooms");
  } catch (err) {
    error = err.message;
  }

  return (
    <section className="page">
      <div className="hotel-hero">
        <div>
          <p className="eyebrow">RoomIt reservations</p>
          <h1>Find the perfect room for your next meeting.</h1>
          <p className="hero-copy">Browse private spaces, compare capacity, and reserve live 30-minute slots with confidence.</p>
        </div>
        <Link className="button hero-action" href="/bookings">Find my bookings</Link>
      </div>

      {error ? (
        <div className="notice error">API unavailable: {error}</div>
      ) : (
        <div className="room-grid">
          {rooms.map((room, index) => (
            <Link className="room-card" key={room._id} href={`/rooms/${room._id}`}>
              <div className={`room-photo room-photo-${index % 4}`}>
                <span>{room.capacity} seats</span>
              </div>
              <div>
                <h2>{room.name}</h2>
                <p>{room.location}</p>
              </div>
              <dl>
                <div>
                  <dt>Capacity</dt>
                  <dd>{room.capacity}</dd>
                </div>
                <div>
                  <dt>Buffer</dt>
                  <dd>{room.bufferMinutes} min</dd>
                </div>
              </dl>
              <span className="card-link">Check availability</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
