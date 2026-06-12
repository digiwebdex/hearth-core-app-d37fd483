import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { tenantApi, clientApi, bookingApi, invoiceApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Building2, UserCheck, Plane, Receipt, Check, ArrowRight, ArrowLeft, Sparkles, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  deriveModuleFlagsFromServiceTypes,
  ONBOARDING_SERVICE_TYPES,
} from "@/lib/enabledServiceTypes";
import { getLocalizedServiceTypeLabel } from "@/lib/serviceTypes";
import type { ServiceType } from "@/lib/serviceTypes";

const Onboarding = () => {
  const { t, i18n } = useTranslation();
  const isBn = String(i18n.resolvedLanguage || i18n.language || "en").startsWith("bn");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshTenant } = useAuth();

  const STEPS = [
    { id: 1, titleKey: "s1Title", descKey: "s1Desc", icon: Building2 },
    { id: 2, titleKey: "s2Title", descKey: "s2Desc", icon: UserCheck },
    { id: 3, titleKey: "s3Title", descKey: "s3Desc", icon: Plane },
    { id: 4, titleKey: "s4Title", descKey: "s4Desc", icon: Receipt },
  ];

  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>(["tour_domestic", "hajj_umrah"]);

  const toggleServiceType = (type: ServiceType) => {
    setServiceTypes((prev) =>
      prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type],
    );
  };

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [createdClientId, setCreatedClientId] = useState("");

  const [bookingType, setBookingType] = useState<"tour" | "ticket" | "hotel" | "visa">("tour");
  const [bookingAmount, setBookingAmount] = useState(0);
  const [bookingCost, setBookingCost] = useState(0);
  const [createdBookingId, setCreatedBookingId] = useState("");

  const [invoiceCreated, setInvoiceCreated] = useState(false);

  const handleStep1 = async () => {
    setLoading(true);
    try {
      const moduleFlags = deriveModuleFlagsFromServiceTypes(serviceTypes);
      await tenantApi.update({
        name: companyName,
        phone: companyPhone || undefined,
        address: companyAddress || undefined,
        enabledServiceTypes: serviceTypes,
        ...moduleFlags,
      });
      await refreshTenant();
      toast({ title: t("marketing.onboarding.savedCompany") });
      setStep(2);
    } catch (err: any) {
      toast({ title: t("marketing.onboarding.failSave"), description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleStep2 = async () => {
    setLoading(true);
    try {
      const client = await clientApi.create({ name: clientName, phone: clientPhone, email: clientEmail } as any);
      setCreatedClientId(client.id);
      toast({ title: t("marketing.onboarding.savedClient") });
      setStep(3);
    } catch (err: any) {
      toast({ title: t("marketing.onboarding.fail"), description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleStep3 = async () => {
    setLoading(true);
    try {
      const profit = bookingAmount - bookingCost;
      const booking = await bookingApi.create({
        type: bookingType, clientId: createdClientId,
        amount: bookingAmount, cost: bookingCost, profit, status: "confirmed",
      } as any);
      setCreatedBookingId(booking.id);
      toast({ title: t("marketing.onboarding.savedBooking") });
      setStep(4);
    } catch (err: any) {
      toast({ title: t("marketing.onboarding.fail"), description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleStep4 = async () => {
    setLoading(true);
    try {
      await invoiceApi.create({
        bookingId: createdBookingId, totalAmount: bookingAmount,
        paidAmount: 0, dueAmount: bookingAmount, status: "unpaid",
      } as any);
      setInvoiceCreated(true);
      toast({ title: t("marketing.onboarding.savedInvoice") });
    } catch (err: any) {
      toast({ title: t("marketing.onboarding.fail"), description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const goToDashboard = () => {
    localStorage.setItem("onboarding_complete", "true");
    navigate("/dashboard");
  };

  const current = STEPS[step - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl flex justify-end mb-2">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                step > s.id ? "bg-primary border-primary text-primary-foreground"
                  : step === s.id ? "border-primary text-primary bg-primary/10"
                  : "border-muted text-muted-foreground"
              }`}>
                {step > s.id ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              {i < STEPS.length - 1 && (<div className={`flex-1 h-0.5 mx-2 ${step > s.id ? "bg-primary" : "bg-muted"}`} />)}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          {STEPS.map((s) => (
            <span key={s.id} className={step === s.id ? "text-primary font-medium" : ""}>
              {t(`marketing.onboarding.${s.titleKey}`)}
            </span>
          ))}
        </div>
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{t(`marketing.onboarding.${current.titleKey}`)}</CardTitle>
          <CardDescription>{t(`marketing.onboarding.${current.descKey}`)}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.companyName")}</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t("marketing.onboarding.companyPh")} required />
              </div>
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.phone")}</Label>
                <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+880..." />
              </div>
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.address")}</Label>
                <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder={t("marketing.onboarding.addressPh")} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Layers className="h-4 w-4" />{t("marketing.onboarding.serviceTypes")}</Label>
                <p className="text-sm text-muted-foreground">{t("marketing.onboarding.serviceTypesDesc")}</p>
                <div className="flex flex-wrap gap-2">
                  {ONBOARDING_SERVICE_TYPES.map((type) => (
                    <Badge
                      key={type}
                      variant={serviceTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleServiceType(type)}
                    >
                      {getLocalizedServiceTypeLabel(type, isBn)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStep1} className="flex-1" disabled={!companyName || loading}>
                  {loading ? t("marketing.onboarding.saving") : t("marketing.onboarding.continue")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.clientName")}</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t("marketing.onboarding.clientNamePh")} required />
              </div>
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.phone")}</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder={t("marketing.onboarding.clientPhonePh")} required />
              </div>
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.email")}</Label>
                <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder={t("marketing.onboarding.emailPh")} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> {t("marketing.onboarding.back")}</Button>
                <Button onClick={handleStep2} className="flex-1" disabled={!clientName || !clientPhone || loading}>
                  {loading ? t("marketing.onboarding.saving") : t("marketing.onboarding.continue")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("marketing.onboarding.bookingType")}</Label>
                <Select value={bookingType} onValueChange={(v) => setBookingType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tour">{t("marketing.onboarding.tour")}</SelectItem>
                    <SelectItem value="ticket">{t("marketing.onboarding.ticket")}</SelectItem>
                    <SelectItem value="hotel">{t("marketing.onboarding.hotel")}</SelectItem>
                    <SelectItem value="visa">{t("marketing.onboarding.visa")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("marketing.onboarding.sellingPrice")}</Label>
                  <Input type="number" min={0} value={bookingAmount || ""} onChange={(e) => setBookingAmount(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("marketing.onboarding.cost")}</Label>
                  <Input type="number" min={0} value={bookingCost || ""} onChange={(e) => setBookingCost(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {t("marketing.onboarding.profit")}: <strong className={bookingAmount - bookingCost >= 0 ? "text-green-600" : "text-destructive"}>
                  ৳{(bookingAmount - bookingCost).toFixed(2)}
                </strong>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> {t("marketing.onboarding.back")}</Button>
                <Button onClick={handleStep3} className="flex-1" disabled={!bookingAmount || loading}>
                  {loading ? t("marketing.onboarding.saving") : t("marketing.onboarding.continue")} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 text-center">
              {!invoiceCreated ? (
                <>
                  <p className="text-muted-foreground">
                    {t("marketing.onboarding.step4Note")} <strong>৳{bookingAmount.toLocaleString()}</strong>.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" /> {t("marketing.onboarding.back")}</Button>
                    <Button onClick={handleStep4} disabled={loading}>
                      {loading ? t("marketing.onboarding.generating") : t("marketing.onboarding.generateInvoice")} <Receipt className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-4 space-y-4">
                  <div className="rounded-full bg-green-100 dark:bg-green-900 p-4 mx-auto w-fit">
                    <Sparkles className="h-10 w-10 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold">{t("marketing.onboarding.allSet")}</h3>
                  <p className="text-sm text-muted-foreground">{t("marketing.onboarding.allSetDesc")}</p>
                  <Button onClick={goToDashboard} size="lg" className="gap-2">
                    <Sparkles className="h-4 w-4" /> {t("marketing.onboarding.goDashboard")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {step < 4 && (
            <div className="mt-4 text-center">
              <Button variant="link" className="text-muted-foreground" onClick={goToDashboard}>
                {t("marketing.onboarding.skip")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;
