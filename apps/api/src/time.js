export const SLOT_MINUTES = 30;

export function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTime(value) {
  return /^\d{2}:\d{2}$/.test(value);
}

export function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function getSlotsBetween(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return [];
  if (start % SLOT_MINUTES !== 0 || end % SLOT_MINUTES !== 0) return [];

  const slots = [];
  for (let minute = start; minute < end; minute += SLOT_MINUTES) {
    slots.push(minutesToTime(minute));
  }
  return slots;
}

export function getHeldSlots(startTime, endTime, bufferMinutes = 0) {
  const endWithBuffer = timeToMinutes(endTime) + Number(bufferMinutes || 0);
  const roundedEnd = Math.ceil(endWithBuffer / SLOT_MINUTES) * SLOT_MINUTES;
  return getSlotsBetween(startTime, minutesToTime(Math.min(roundedEnd, 24 * 60)));
}

export function bookingStartDate(date, startTime) {
  return new Date(`${date}T${startTime}:00`);
}

export function daySlotGrid() {
  const slots = [];
  for (let minute = 8 * 60; minute < 20 * 60; minute += SLOT_MINUTES) {
    slots.push(minutesToTime(minute));
  }
  return slots;
}
