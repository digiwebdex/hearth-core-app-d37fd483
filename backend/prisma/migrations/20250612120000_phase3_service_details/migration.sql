-- Phase 3: durable service-specific ops data on bookings
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "serviceDetails" JSONB;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "opsStatus" TEXT DEFAULT 'pending';
