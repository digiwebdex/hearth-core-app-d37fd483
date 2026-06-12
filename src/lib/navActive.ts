import type { NavItemConfig } from "@/config/navigation";

/** Sidebar active state for preset-style and section routes. */
export function navItemIsActive(url: string, pathname: string): boolean {
  if (url === "/bookings") {
    return pathname === "/bookings" || pathname.startsWith("/bookings/");
  }
  if (url === "/packages/all") {
    return pathname === "/packages" || pathname.startsWith("/packages/");
  }
  if (url.startsWith("/bookings/")) return pathname === url;
  if (url.startsWith("/packages/")) return pathname === url;
  if (url === "/hajj-umrah") {
    return pathname === "/hajj-umrah" || pathname.startsWith("/hajj-umrah/");
  }
  if (url === "/accounts") {
    return pathname === "/accounts" || pathname === "/expenses";
  }
  if (url === "/expenses") {
    return pathname === "/expenses";
  }
  if (url === "/commissions") {
    return pathname === "/commissions";
  }
  if (url === "/follow-ups") {
    return pathname === "/follow-ups";
  }
  if (url === "/documents") {
    return pathname === "/documents";
  }
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
