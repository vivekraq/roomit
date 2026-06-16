"use client";

import { useMemo, useState } from "react";
import { api } from "../../lib/api";

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function BookingClient({ initialData, initialDate }) {
  const [data, setData] = useState(initialData);
  const [date, setDate] = useState(initialDate);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", title: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sortedSelected = useMemo(() => [...selected].sort(), [selected]);
  const canBook = sortedSelected.length > 0 && form.name && form.email && form.title;

  async function refresh(nextDate = date) {
    const updated = await api(`/api/rooms/${data.room._id}/availability?date=${nextDate}`);
    setData(updated);
  }

  async function changeDate(value) {
    setDate(value);
    setSelected([]);
    setMessage("");
    await refresh(value);
  }

  function toggleSlot(slot) {
    if (!slot.available) return;
    setMessage("");
    setSelected((current) => {
      if (current.includes(slot.slotStart)) {
        return current.filter((item) => item !== slot.slotStart);
      }
      const next = [...current, slot.slotStart].sort();
      const allStarts = data.slots.map((item) => item.slotStart);
      const startIndex = allStarts.indexOf(next[0]);
      const endIndex = allStarts.indexOf(next[next.length - 1]);
      const range = data.slots.slice(startIndex, endIndex + 1);
      if (range.some((item) => !item.available)) {
        setMessage("Selected slots must be consecutive and available.");
        return current;
      }
      return range.map((item) => item.slotStart);
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!canBook) return;

    const startTime = sortedSelected[0];
    const endTime = addMinutes(sortedSelected[sortedSelected.length - 1], 30);
    setLoading(true);
    setMessage("");

    try {
      await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          roomId: data.room._id,
          date,
          startTime,
          endTime,
          bookedBy: { name: form.name, email: form.email },
          title: form.title
        })
      });
      setMessage("Booking confirmed.");
      setSelected([]);
      await refresh();
    } catch (error) {
      setMessage(`${error.status || "Error"}: ${error.message}`);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="room-hero">
        <div>
          <p className="eyebrow">Reserve {data.room.location}</p>
          <h1>{data.room.name}</h1>
          <p className="hero-copy">Capacity {data.room.capacity} seats. Buffer {data.room.bufferMinutes} min after each reservation.</p>
        </div>
        <div className="date-card">
          <span>Check-in date</span>
          <input className="date-input" type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
        </div>
      </div>

      <div className="booking-layout">
        <section className="slot-panel">
          <div className="slot-header">
            <div>
              <p className="eyebrow">Today&apos;s inventory</p>
              <h2>Available time slots</h2>
            </div>
            <p>Choose consecutive 30-minute stays.</p>
          </div>
          <div className="slot-grid">
            {data.slots.map((slot) => (
              <button
                key={slot.slotStart}
                type="button"
                className={`slot ${slot.available ? "available" : "blocked"} ${selected.includes(slot.slotStart) ? "selected" : ""}`}
                onClick={() => toggleSlot(slot)}
                disabled={!slot.available}
              >
                {slot.slotStart}
              </button>
            ))}
          </div>
        </section>

        <form className="booking-form" onSubmit={submit}>
          <p className="eyebrow">Reservation details</p>
          <h2>Complete your booking</h2>
          <label>
            Guest name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            Meeting title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <div className="summary">
            <span>Selected stay</span>
            {sortedSelected.length
              ? `${sortedSelected[0]} - ${addMinutes(sortedSelected[sortedSelected.length - 1], 30)}`
              : "No slots selected"}
          </div>
          <button className="button" type="submit" disabled={!canBook || loading}>
            {loading ? "Booking..." : "Book room"}
          </button>
          {message && <div className={message.includes("confirmed") ? "notice success" : "notice error"}>{message}</div>}
        </form>
      </div>
    </>
  );
}
