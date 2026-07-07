import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StickyNote } from "lucide-react";
import { portalApi } from "@/lib/portalApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "../lib/format";

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (/approved|issued|granted/.test(s)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (/rejected|denied/.test(s)) return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (/applied|processing|appointment|submitted/.test(s)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-muted text-muted-foreground";
}

export default function Visa() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-visa"], queryFn: portalApi.visa });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><StickyNote className="h-6 w-6" /> {t("portal.visaStatus", { defaultValue: "Visa status" })}</h1>
        <p className="text-sm text-muted-foreground">{t("portal.visaHint", { defaultValue: "Track your visa applications." })}</p>
      </div>

      {error && <p className="text-destructive">{(error as Error).message}</p>}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : data && data.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("portal.noVisa", { defaultValue: "No visa applications yet." })}</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {data?.map((v) => (
            <Card key={v.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  {v.destination || v.visaType || t("portal.visaApplication", { defaultValue: "Visa application" })}
                </CardTitle>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusTone(v.status)}`}>{v.status.replace(/_/g, " ")}</span>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">{t("portal.applicant", { defaultValue: "Applicant" })}: </span>{v.applicantName}</div>
                {v.visaType && <div><span className="text-muted-foreground">{t("portal.visaType", { defaultValue: "Visa type" })}: </span>{v.visaType}</div>}
                {v.referenceNo && <div><span className="text-muted-foreground">{t("portal.reference", { defaultValue: "Reference" })}: </span>{v.referenceNo}</div>}
                {v.appliedDate && <div><span className="text-muted-foreground">{t("portal.applied", { defaultValue: "Applied" })}: </span>{formatDate(v.appliedDate)}</div>}
                {v.appointmentDate && <div><span className="text-muted-foreground">{t("portal.appointment", { defaultValue: "Appointment" })}: </span>{formatDate(v.appointmentDate)}</div>}
                {v.decisionDate && <div><span className="text-muted-foreground">{t("portal.decision", { defaultValue: "Decision" })}: </span>{formatDate(v.decisionDate)}</div>}
                {v.expiryDate && <div><span className="text-muted-foreground">{t("portal.visaExpiry", { defaultValue: "Visa expiry" })}: </span>{formatDate(v.expiryDate)}</div>}
                {v.bookingId && <div className="sm:col-span-2"><a href={`bookings/${v.bookingId}`} className="text-primary hover:underline text-xs">{t("portal.viewRelatedBooking", { defaultValue: "View related booking" })}</a></div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
