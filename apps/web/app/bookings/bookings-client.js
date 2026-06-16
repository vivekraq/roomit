"use client";

import { useState } from "react";
import { api } from "../lib/api";

export default function BookingsClient() {
  const [email, setEmail] = useState("");
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const result = await api(`/api/bookings?email=${encodeURIComponent(email)}`);
      setBookings(result);
      if (result.length === 0) setMessage("No bookings found for this email.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancel(id) {
    const ok = window.confirm("Cancel this booking?");
    if (!ok) return;
    try {
      await api(`/api/bookings/${id}/cancel`, { method: "PATCH" });
      const result = await api(`/api/bookings?email=${encodeURIComponent(email)}`);
      setBookings(result);
      setMessage("Booking cancelled.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <>
      <div className="hotel-hero compact">
        <div>
          <p className="eyebrow">Guest reservations</p>
          <h1>Manage your upcoming room stays.</h1>
          <p className="hero-copy">Search with the same email used during booking.</p>
        </div>
      </div>

      <form className="lookup" onSubmit={search}>
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="button" disabled={!email || loading}>{loading ? "Searching..." : "Search"}</button>
      </form>

      {message && <div className="notice">{message}</div>}

      <div className="booking-list">
        {bookings.map((booking) => (
          <article className="booking-card" key={booking._id}>
            <div>
              <h2>{booking.title}</h2>
              <p>{booking.roomName} · {booking.date} · {booking.startTime}-{booking.endTime}</p>
              <span className={`status ${booking.status}`}>{booking.status}</span>
            </div>
            {booking.status === "confirmed" && (
              <button className="button secondary" onClick={() => cancel(booking._id)}>Cancel</button>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
