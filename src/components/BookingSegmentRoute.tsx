import { useParams } from "react-router-dom";
import { isUuid } from "@/lib/routeIds";
import { isBookingPreset } from "@/lib/bookingRoutePresets";
import Bookings from "@/pages/Bookings";
import BookingDetails from "@/pages/BookingDetails";
import NotFound from "@/pages/NotFound";

/**
 * Resolves /bookings/:segment — UUID → detail view, preset slug → filtered list.
 */
export default function BookingSegmentRoute() {
  const { segment } = useParams<{ segment: string }>();

  if (!segment) return <Bookings />;
  if (isUuid(segment)) return <BookingDetails />;
  if (isBookingPreset(segment)) return <Bookings />;

  return <NotFound />;
}
