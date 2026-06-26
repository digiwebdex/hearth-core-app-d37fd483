import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, UserPlus, User } from "lucide-react";
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
import { clientApi, type Client } from "@/lib/api";

export interface ClientSelectValue {
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
}

interface ClientSelectProps {
  value: ClientSelectValue;
  onChange: (value: ClientSelectValue) => void;
  disabled?: boolean;
}

/**
 * Searchable client picker. Pick an existing client (links clientId + grabs
 * phone/email) or add a brand-new one by typing a name. Makes it explicit
 * whether the booking reuses a client or creates one — avoids duplicates.
 */
export function ClientSelect({ value, onChange, disabled }: ClientSelectProps) {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    clientApi.list().then(setClients).catch(() => setClients([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, 50);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          String(c.phone || "").toLowerCase().includes(q) ||
          String(c.email || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [clients, query]);

  const exactExists = useMemo(
    () => clients.some((c) => c.name.trim().toLowerCase() === query.trim().toLowerCase()),
    [clients, query],
  );

  const selectExisting = (c: Client) => {
    onChange({ clientId: c.id, clientName: c.name, clientPhone: c.phone || "", clientEmail: c.email || "" });
    setOpen(false);
    setQuery("");
  };

  const addNew = (name: string) => {
    onChange({ clientId: "", clientName: name.trim(), clientPhone: "", clientEmail: "" });
    setOpen(false);
    setQuery("");
  };

  const labelText = isBn ? "ক্লায়েন্ট" : "Client";
  const placeholder = isBn ? "ক্লায়েন্ট খুঁজুন বা নতুন যোগ করুন…" : "Search client or add new…";
  const searchPlaceholder = isBn ? "নাম, ফোন বা ইমেইল…" : "Name, phone or email…";
  const addLabel = (name: string) => (isBn ? `নতুন ক্লায়েন্ট যোগ করুন: “${name}”` : `Add new client: “${name}”`);

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
            className={cn("w-full justify-between font-normal", !value.clientName && "text-muted-foreground")}
          >
            <span className="flex items-center gap-2 truncate">
              {value.clientName ? <User className="h-4 w-4 shrink-0" /> : null}
              {value.clientName || placeholder}
              {value.clientId ? null : value.clientName ? (
                <span className="text-xs text-amber-600">({isBn ? "নতুন" : "new"})</span>
              ) : null}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {query.trim() ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-2 py-2 text-sm hover:bg-accent rounded-sm"
                    onClick={() => addNew(query)}
                  >
                    <UserPlus className="h-4 w-4" /> {addLabel(query.trim())}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">{isBn ? "কোনো ক্লায়েন্ট নেই" : "No clients"}</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {filtered.map((c) => (
                  <CommandItem key={c.id} value={c.id} onSelect={() => selectExisting(c)}>
                    <Check className={cn("mr-2 h-4 w-4", value.clientId === c.id ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <p className="truncate text-sm">{c.name}</p>
                      {(c.phone || c.email) ? (
                        <p className="truncate text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>
                      ) : null}
                    </div>
                  </CommandItem>
                ))}
                {query.trim() && !exactExists ? (
                  <CommandItem value={`__add__${query}`} onSelect={() => addNew(query)}>
                    <UserPlus className="mr-2 h-4 w-4" /> {addLabel(query.trim())}
                  </CommandItem>
                ) : null}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
