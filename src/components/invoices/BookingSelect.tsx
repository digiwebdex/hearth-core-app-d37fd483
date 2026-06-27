import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { bookingApi, type Booking } from "@/lib/api";

interface BookingSelectProps {
  value: string; // selected bookingId
  onSelect: (booking: Booking) => void;
  disabled?: boolean;
}

/**
 * Searchable booking picker for invoice creation. Every invoice must link to a
 * booking, so this replaces the old "type the booking UUID" field — pick a
 * booking and the invoice auto-fills its title, client, amount and cost.
 */
export function BookingSelect({ value, onSelect, disabled }: BookingSelectProps) {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    bookingApi.list().then((list) => setBookings(list as Booking[])).catch(() => setBookings([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? bookings.filter(
          (b) =>
            String(b.title || "").toLowerCase().includes(q) ||
            String(b.clientName || "").toLowerCase().includes(q) ||
            String(b.destination || "").toLowerCase().includes(q),
        )
      : bookings;
    return base.slice(0, 50);
  }, [bookings, query]);

  const selected = bookings.find((b) => b.id === value);
  const labelText = isBn ? "বুকিং" : "Booking";
  const placeholder = isBn ? "বুকিং খুঁজে নির্বাচন করুন…" : "Search and select a booking…";
  const searchPlaceholder = isBn ? "শিরোনাম, ক্লায়েন্ট বা গন্তব্য…" : "Title, client or destination…";

  return (
    <div className="space-y-2">
      <Label>{labelText} <span className="text-destructive">*</span></Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground")}
          >
            <span className="flex items-center gap-2 truncate">
              {selected ? <Plane className="h-4 w-4 shrink-0" /> : null}
              {selected ? (selected.title || selected.clientName || selected.id.slice(0, 8)) : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                <span className="text-sm text-muted-foreground">{isBn ? "কোনো বুকিং নেই" : "No bookings found"}</span>
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={b.id}
                    onSelect={() => { onSelect(b); setOpen(false); setQuery(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === b.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{b.title || (isBn ? "শিরোনামহীন বুকিং" : "Untitled booking")}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[b.clientName, b.destination].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="ml-2 text-xs font-medium shrink-0">৳{Number(b.amount || 0).toLocaleString()}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? (
        <p className="text-xs text-muted-foreground">
          {isBn ? "ক্লায়েন্ট" : "Client"}: {selected.clientName || "—"}
          {selected.destination ? ` · ${selected.destination}` : ""}
        </p>
      ) : null}
    </div>
  );
}
