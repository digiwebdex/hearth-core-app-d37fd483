import type { NavItemConfig } from "@/config/navigation";

/** Exact route match for preset-style sidebar links (/bookings/tour, /packages/hajj). */
export function navItemIsActive(url: string, pathname: string): boolean {
  if (url === "/bookings") return pathname === "/bookings";
  if (url.startsWith("/bookings/")) return pathname === url;
  if (url.startsWith("/packages/")) return pathname === url;
  if (url === "/dashboard") return pathname === "/dashboard";
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function navGroupHasActiveItem(items: NavItemConfig[], pathname: string): boolean {
  return items.some((item) => {
    if (item.url && navItemIsActive(item.url, pathname)) return true;
    return item.children?.some((child) => child.url && navItemIsActive(child.url, pathname)) ?? false;
  });
}

export function isBookingNavPath(pathname: string): boolean {
  return pathname === "/bookings" || pathname.startsWith("/bookings/");
}

export function isPackageNavPath(pathname: string): boolean {
  return pathname === "/packages" || pathname.startsWith("/packages/");
}
