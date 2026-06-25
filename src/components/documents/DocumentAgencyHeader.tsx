import { Building2 } from "lucide-react";

export interface AgencyBranding {
  name: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

interface DocumentAgencyHeaderProps {
  branding: AgencyBranding;
  right?: React.ReactNode;
}

function contactLine(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" · ");
}

export function DocumentAgencyHeader({ branding, right }: DocumentAgencyHeaderProps) {
  const contact = contactLine([
    branding.phone ? `Phone: ${branding.phone}` : undefined,
    branding.email ? `Email: ${branding.email}` : undefined,
    branding.website ? branding.website.replace(/^https?:\/\//, "") : undefined,
  ]);

  return (
    <div className="flex items-start justify-between gap-6 border-b pb-6">
      <div className="flex items-start gap-4 min-w-0">
        {branding.logo ? (
          <img
            src={branding.logo}
            alt={branding.name}
            className="h-16 w-16 shrink-0 rounded-md border object-contain bg-white"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-muted">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-bold leading-tight">{branding.name}</h2>
          {branding.address && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{branding.address}</p>
          )}
          {contact && <p className="text-xs text-muted-foreground">{contact}</p>}
        </div>
      </div>
      {right ? <div className="shrink-0 text-right">{right}</div> : null}
    </div>
  );
}

export function buildAgencyBranding({
  tenant,
  websiteConfig,
  userEmail,
}: {
  tenant?: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    website?: string;
  } | null;
  websiteConfig?: {
    logo?: string;
    contactInfo?: {
      phone?: string;
      email?: string;
      address?: string;
    };
  } | null;
  userEmail?: string;
}): AgencyBranding {
  const addressParts = [
    websiteConfig?.contactInfo?.address,
    tenant?.address,
    [tenant?.city, tenant?.country].filter(Boolean).join(", ") || undefined,
  ].filter(Boolean);

  return {
    name: tenant?.name || "Travel Agency",
    logo: websiteConfig?.logo || undefined,
    phone: websiteConfig?.contactInfo?.phone || tenant?.phone || undefined,
    email: websiteConfig?.contactInfo?.email || userEmail || undefined,
    address: addressParts.length ? addressParts.join("\n") : undefined,
    website: tenant?.website || undefined,
  };
}
