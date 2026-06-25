import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Trophy, Settings, RefreshCw } from "lucide-react";
import { loyaltyApi, type LoyaltyRule, type LoyaltyAccount } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const tierColors: Record<string, string> = {
  standard: "bg-gray-100 text-gray-700",
  silver: "bg-slate-200 text-slate-700",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-purple-100 text-purple-800",
};

const tierIcons: Record<string, string> = { standard: "⚪", silver: "🥈", gold: "🥇", platinum: "💎" };

function fmt(n: number) { return `৳ ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`; }

const defaultRule: Partial<LoyaltyRule> = {
  pointsPerUnit: 1, unitAmount: 100, redemptionValue: 1, expiryDays: 365,
  silverThreshold: 1000, goldThreshold: 5000, platinumThreshold: 15000, isActive: true,
};

export default function Loyalty() {
  const { toast } = useToast();
  const [tab, setTab] = useState("leaderboard");
  const [rule, setRule] = useState<LoyaltyRule | null>(null);
  const [ruleForm, setRuleForm] = useState<Partial<LoyaltyRule>>(defaultRule);
  const [leaderboard, setLeaderboard] = useState<LoyaltyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, lb] = await Promise.all([loyaltyApi.getRules(), loyaltyApi.getLeaderboard()]);
      setRule(r);
      setLeaderboard(lb);
      if (r) setRuleForm(r);
    } catch { toast({ title: "Failed to load loyalty data", variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveRule() {
    setSaving(true);
    try {
      const saved = await loyaltyApi.upsertRules(ruleForm);
      setRule(saved);
      toast({ title: "Loyalty program settings saved" });
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  const rf = (field: keyof LoyaltyRule) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRuleForm({ ...ruleForm, [field]: parseFloat(e.target.value) || 0 });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customer Loyalty Program</h1>
            <p className="text-muted-foreground text-sm mt-1">Reward repeat travelers with points and tier benefits</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {rule && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl">⚪</p>
              <p className="font-semibold mt-1">Standard</p>
              <p className="text-xs text-muted-foreground">0 – {rule.silverThreshold - 1} pts</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl">🥈</p>
              <p className="font-semibold mt-1">Silver</p>
              <p className="text-xs text-muted-foreground">{rule.silverThreshold.toLocaleString()} – {rule.goldThreshold - 1} pts</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl">🥇</p>
              <p className="font-semibold mt-1">Gold</p>
              <p className="text-xs text-muted-foreground">{rule.goldThreshold.toLocaleString()} – {rule.platinumThreshold - 1} pts</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl">💎</p>
              <p className="font-semibold mt-1">Platinum</p>
              <p className="text-xs text-muted-foreground">{rule.platinumThreshold.toLocaleString()}+ pts</p>
            </CardContent></Card>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="leaderboard"><Trophy className="w-4 h-4 mr-1.5" />Leaderboard</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" />Program Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Top Loyal Customers</CardTitle></CardHeader>
              <CardContent className="p-0">
                {loading ? <div className="p-6"><Skeleton className="h-40 w-full" /></div> : leaderboard.length === 0 ? (
                  <p className="p-6 text-muted-foreground text-sm">No loyalty accounts yet. Points are awarded automatically when clients make payments.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Rank</th>
                        <th className="text-left px-4 py-2 font-medium">Client</th>
                        <th className="text-left px-4 py-2 font-medium">Tier</th>
                        <th className="text-right px-4 py-2 font-medium">Total Points</th>
                        <th className="text-right px-4 py-2 font-medium">Available</th>
                        <th className="text-right px-4 py-2 font-medium">Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((acc, i) => (
                        <tr key={acc.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-bold text-muted-foreground">#{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium">{acc.client?.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{acc.client?.phone}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${tierColors[acc.tier]}`}>
                              {tierIcons[acc.tier]} {acc.tier}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">{acc.totalPoints.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-green-700 font-semibold">{(acc.totalPoints - acc.usedPoints).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{acc.usedPoints.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Loyalty Program Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-semibold">Enable Loyalty Program</p>
                    <p className="text-sm text-muted-foreground">Points are auto-awarded when clients make payments</p>
                  </div>
                  <Switch checked={ruleForm.isActive !== false} onCheckedChange={(v) => setRuleForm({ ...ruleForm, isActive: v })} />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Earning Rules</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Points per unit</Label>
                        <Input type="number" min={0} step="0.1" value={ruleForm.pointsPerUnit || 1} onChange={rf("pointsPerUnit")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unit amount (৳)</Label>
                        <Input type="number" min={1} value={ruleForm.unitAmount || 100} onChange={rf("unitAmount")} />
                        <p className="text-xs text-muted-foreground">e.g. {ruleForm.pointsPerUnit || 1} pt per ৳{ruleForm.unitAmount || 100}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Redemption value (৳/pt)</Label>
                        <Input type="number" min={0} step="0.01" value={ruleForm.redemptionValue || 1} onChange={rf("redemptionValue")} />
                        <p className="text-xs text-muted-foreground">1 pt = ৳{ruleForm.redemptionValue || 1} discount</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Points expiry (days)</Label>
                        <Input type="number" min={1} value={ruleForm.expiryDays || 365} onChange={rf("expiryDays")} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Tier Thresholds (Cumulative Points)</h3>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-2">🥈 Silver tier from</Label>
                        <Input type="number" min={1} value={ruleForm.silverThreshold || 1000} onChange={rf("silverThreshold")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-2">🥇 Gold tier from</Label>
                        <Input type="number" min={1} value={ruleForm.goldThreshold || 5000} onChange={rf("goldThreshold")} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="flex items-center gap-2">💎 Platinum tier from</Label>
                        <Input type="number" min={1} value={ruleForm.platinumThreshold || 15000} onChange={rf("platinumThreshold")} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={saveRule} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
