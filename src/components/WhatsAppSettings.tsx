import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanAccess } from "@/hooks/usePlanAccess";
const API = import.meta.env.VITE_API_URL || "/api";
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
  return res.json();
}

interface WhatsAppConfig {
  provider: string;
  configured: boolean;
  wasenderInstanceId: string;
  metaPhoneId: string;
  twilioFrom: string;
}

const WhatsAppSettings = () => {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [provider, setProvider] = useState("wasender");
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();
  const { currentPlan } = useAuth();
  const { canUseWhatsApp } = usePlanAccess(currentPlan);

  useEffect(() => {
    if (!canUseWhatsApp) return;
    apiFetch<WhatsAppConfig>("/whatsapp/config").then((c) => {
      setConfig(c);
      setProvider(c.provider || "wasender");
    }).catch(() => {});
  }, [canUseWhatsApp]);

  if (!canUseWhatsApp) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-500" />
            WhatsApp Notifications
            <Badge variant="secondary" className="ml-auto">Upgrade required</Badge>
          </CardTitle>
          <CardDescription>
            WhatsApp notifications are not included in your current plan. Upgrade to enable booking
            confirmations, payment alerts, and renewal reminders over WhatsApp.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleTest = async () => {
    if (!testPhone) return;
    setTesting(true);
    try {
      const res = await apiFetch<{ success: boolean; error?: string }>("/whatsapp/test", {
        method: "POST",
        body: JSON.stringify({ to: testPhone }),
      });
      if (res.success) {
        toast({ title: "Test message sent!", description: `WhatsApp sent to ${testPhone}` });
      } else {
        toast({ title: "Send failed", description: res.error || "Check your API credentials", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-500" />
          WhatsApp Notifications
          {config?.configured ? (
            <Badge variant="default" className="ml-auto bg-green-500">Active</Badge>
          ) : (
            <Badge variant="secondary" className="ml-auto">Not configured</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Configure WhatsApp to send booking confirmations, payment alerts, and renewal reminders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wasender">WasenderAPI (Recommended)</SelectItem>
              <SelectItem value="meta">Meta WhatsApp Business API</SelectItem>
              <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
              <SelectItem value="console">Console (Testing only)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {provider === "wasender" && (
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">WasenderAPI Setup</p>
              <a
                href="https://wasenderapi.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline"
              >
                wasenderapi.com <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Current Provider</Label>
                <p className="text-sm text-muted-foreground">
                  {config?.provider === "wasender" ? (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> WasenderAPI is active
                    </span>
                  ) : (
                    "Not active — set WHATSAPP_PROVIDER=wasender in backend .env"
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Instance ID</Label>
                <p className="text-sm text-muted-foreground font-mono">
                  {config?.wasenderInstanceId || <span className="text-destructive">Not set (WASENDER_INSTANCE_ID)</span>}
                </p>
              </div>
            </div>
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs space-y-1">
              <p className="font-medium text-blue-700 dark:text-blue-300">How to configure:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
                <li>Sign up at wasenderapi.com and create an instance</li>
                <li>Scan the QR code to connect your WhatsApp number</li>
                <li>Copy your API Key and Instance ID</li>
                <li>Add to backend <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.env</code>:</li>
              </ol>
              <pre className="mt-2 bg-blue-100 dark:bg-blue-900 rounded p-2 text-blue-800 dark:text-blue-200 font-mono text-xs overflow-x-auto">
{`WHATSAPP_PROVIDER=wasender
WASENDER_API_KEY=your_api_key_here
WASENDER_INSTANCE_ID=your_instance_id`}
              </pre>
            </div>
          </div>
        )}

        {provider === "meta" && (
          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <p className="text-sm font-medium">Meta WhatsApp Business API</p>
            <div className="space-y-1">
              <Label className="text-xs">Phone Number ID</Label>
              <p className="text-sm text-muted-foreground font-mono">
                {config?.metaPhoneId || <span className="text-destructive">Not set (META_WHATSAPP_PHONE_ID)</span>}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Set META_WHATSAPP_TOKEN and META_WHATSAPP_PHONE_ID in backend .env</p>
          </div>
        )}

        {provider === "twilio" && (
          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <p className="text-sm font-medium">Twilio WhatsApp</p>
            <div className="space-y-1">
              <Label className="text-xs">From Number</Label>
              <p className="text-sm text-muted-foreground font-mono">
                {config?.twilioFrom || <span className="text-destructive">Not set (WHATSAPP_FROM_NUMBER)</span>}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and WHATSAPP_FROM_NUMBER in backend .env</p>
          </div>
        )}

        <div className="border-t pt-4 space-y-2">
          <Label>Send Test Message</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Phone number (e.g. 01712345678)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
            <Button onClick={handleTest} disabled={testing || !testPhone} variant="outline">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">Test</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sends a test WhatsApp message using your current provider configuration.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WhatsAppSettings;
