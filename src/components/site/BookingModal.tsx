import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Plane, Calendar, Users, Phone, Mail, User, MessageSquare, Loader2, X } from "lucide-react";
import { useWebsite } from "@/contexts/WebsiteContext";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.travelagencyweb.com/api";

export interface BookingPackage {
  id: string;
  name: string;
  price: number;
  duration: string;
  type: string;
  image?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pkg?: BookingPackage | null;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  travelDate: string;
  travelDateTo: string;
  travelers: string;
  budget: string;
  message: string;
}

const INIT: FormState = {
  name: "", phone: "", email: "",
  travelDate: "", travelDateTo: "",
  travelers: "1", budget: "", message: "",
};

export default function BookingModal({ open, onClose, pkg }: Props) {
  const { tenant, domainResolution } = useWebsite();
  const [form, setForm] = useState<FormState>(INIT);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function validate() {
    const e: Partial<FormState> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^[+0-9\s\-()]{7,}$/.test(form.phone)) e.phone = "Enter a valid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!form.travelDate) e.travelDate = "Please select a travel date";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        travelDate: form.travelDate,
        travelDateTo: form.travelDateTo || undefined,
        travelers: parseInt(form.travelers, 10) || 1,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        message: form.message.trim() || undefined,
        packageId: pkg?.id,
        packageName: pkg?.name,
        packageType: pkg?.type,
      };

      // resolve tenant identifier
      if (domainResolution?.type === "custom-domain" && domainResolution.customDomain) {
        body.domain = domainResolution.customDomain;
      } else if (domainResolution?.slug || tenant?.slug) {
        body.slug = domainResolution?.slug || tenant?.slug;
      }

      const res = await fetch(`${API_BASE}/public/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to submit. Please try again.");
      }

      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setErrors({ message: msg });
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setForm(INIT);
    setErrors({});
    setSubmitted(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-0">
        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
            <div className="rounded-full bg-green-100 p-5">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">Inquiry Sent!</h3>
              <p className="text-muted-foreground">
                Thank you, <strong>{form.name}</strong>! Your booking inquiry has been received.
                Our team will contact you at <strong>{form.phone}</strong> within 2–4 hours.
              </p>
            </div>
            {pkg && (
              <div className="rounded-xl border bg-muted/40 px-6 py-4 w-full text-left">
                <p className="text-sm font-medium text-muted-foreground mb-1">Package requested</p>
                <p className="font-semibold">{pkg.name}</p>
                <p className="text-sm text-muted-foreground">{pkg.duration} · ৳{pkg.price.toLocaleString()}</p>
              </div>
            )}
            <Button onClick={handleClose} className="mt-2 w-full">Done</Button>
          </div>
        ) : (
          <>
            {/* Header with package preview */}
            <div className="relative">
              {pkg?.image ? (
                <div className="h-36 overflow-hidden rounded-t-lg">
                  <img src={pkg.image} alt={pkg.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60 rounded-t-lg" />
                </div>
              ) : (
                <div className="h-24 bg-primary/10 rounded-t-lg" />
              )}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 rounded-full bg-white/90 p-1.5 shadow hover:bg-white transition"
              >
                <X className="h-4 w-4" />
              </button>
              {pkg && (
                <div className={`absolute bottom-3 left-4 ${pkg.image ? "text-white" : "text-foreground"}`}>
                  <Badge className="bg-primary/90 text-xs mb-1 capitalize">{pkg.type}</Badge>
                  <h3 className="font-bold text-lg leading-tight drop-shadow">{pkg.name}</h3>
                  <p className="text-sm opacity-90">{pkg.duration} · <span className="font-semibold">৳{pkg.price.toLocaleString()}</span></p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-4">
              <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Plane className="h-5 w-5 text-primary" />
                  {pkg ? "Book This Package" : "Send Booking Inquiry"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Fill in your details and we'll confirm your booking within 2–4 hours.
                </p>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="bk-name" className="flex items-center gap-1.5 text-sm font-medium">
                      <User className="h-3.5 w-3.5" /> Full Name <span className="text-red-500">*</span>
                    </Label>
                    <Input id="bk-name" placeholder="Your full name" value={form.name} onChange={set("name")} className={errors.name ? "border-red-400" : ""} />
                    {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bk-phone" className="flex items-center gap-1.5 text-sm font-medium">
                      <Phone className="h-3.5 w-3.5" /> Phone / WhatsApp <span className="text-red-500">*</span>
                    </Label>
                    <Input id="bk-phone" placeholder="+880 1XXXXXXXXX" value={form.phone} onChange={set("phone")} className={errors.phone ? "border-red-400" : ""} />
                    {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bk-email" className="flex items-center gap-1.5 text-sm font-medium">
                    <Mail className="h-3.5 w-3.5" /> Email Address
                  </Label>
                  <Input id="bk-email" type="email" placeholder="your@email.com (optional)" value={form.email} onChange={set("email")} className={errors.email ? "border-red-400" : ""} />
                  {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                </div>

                {/* Travel details */}
                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Travel Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bk-date" className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5" /> Departure Date <span className="text-red-500">*</span>
                      </Label>
                      <Input id="bk-date" type="date" value={form.travelDate} onChange={set("travelDate")} min={new Date().toISOString().split("T")[0]} className={errors.travelDate ? "border-red-400" : ""} />
                      {errors.travelDate && <p className="text-xs text-red-500">{errors.travelDate}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bk-date-to" className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5" /> Return Date
                      </Label>
                      <Input id="bk-date-to" type="date" value={form.travelDateTo} onChange={set("travelDateTo")} min={form.travelDate || new Date().toISOString().split("T")[0]} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bk-travelers" className="flex items-center gap-1.5 text-sm font-medium">
                        <Users className="h-3.5 w-3.5" /> Number of Travelers
                      </Label>
                      <Input id="bk-travelers" type="number" min={1} max={99} value={form.travelers} onChange={set("travelers")} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="bk-budget" className="flex items-center gap-1.5 text-sm font-medium">
                        Budget (BDT)
                      </Label>
                      <Input id="bk-budget" type="number" placeholder="Optional" value={form.budget} onChange={set("budget")} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="bk-msg" className="flex items-center gap-1.5 text-sm font-medium">
                    <MessageSquare className="h-3.5 w-3.5" /> Special Requests / Message
                  </Label>
                  <Textarea id="bk-msg" placeholder="Any special requirements, questions, or preferences..." value={form.message} onChange={set("message")} rows={3} />
                </div>

                {errors.message && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {errors.message}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Inquiry…</>
                  ) : (
                    <><Plane className="mr-2 h-4 w-4" /> Send Booking Inquiry</>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  By submitting, you agree to be contacted by this agency regarding your inquiry.
                </p>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
