import { z } from "zod";

export const createBookingSchema = z.object({
  roomId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  bookedBy: z.object({
    name: z.string().min(2),
    email: z.string().email().transform((value) => value.toLowerCase())
  }),
  title: z.string().min(2).max(120)
});
