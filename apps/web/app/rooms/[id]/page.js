import BookingClient from "./room-client";
import { api } from "../../lib/api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default async function RoomPage({ params, searchParams }) {
  const date = searchParams?.date || today();
  let data = null;
  let error = null;

  try {
    data = await api(`/api/rooms/${params.id}/availability?date=${date}`);
  } catch (err) {
    error = err.message;
  }

  return (
    <section className="page">
      {error ? (
        <div className="notice error">{error}</div>
      ) : (
        <BookingClient initialData={data} initialDate={date} />
      )}
    </section>
  );
}
