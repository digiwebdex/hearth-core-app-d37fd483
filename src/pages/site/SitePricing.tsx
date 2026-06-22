import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PLANS, FEATURE_COMPARISON, getDisplayMonthlyPrice, type BillingCycle, type PlanConfig } from "@/lib/plans";
import BillingCycleToggle from "@/components/BillingCycleToggle";
import { Check, X, Crown, Sparkles, Plane } from "lucide-react";

const visiblePlans = PLANS;

function PlanCard({ plan, billing }: { plan: PlanConfig; billing: BillingCycle }) {
  const isPopular = plan.badge === "Most Popular";
  const isBestValue = plan.badge === "Best Value";
  const highlighted = isPopular || isBestValue;
  const price = getDisplayMonthlyPrice(plan, billing);

  return (
    <Card className={`relative flex flex-col ${highlighted ? "border-primary shadow-lg scale-[1.03]" : "border-border"}`}>
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs">
            {isPopular && <Sparkles className="mr-1 h-3 w-3" />}
            {isBestValue && <Crown className="mr-1 h-3 w-3" />}
            {plan.badge}
          </Badge>
        </div>
      )}
      <CardHeader className="text-center pt-8 pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        <div className="mt-4">
          {price === 0 ? (
            <span className="text-4xl font-bold">Free</span>
          ) : price === -1 ? (
            <span className="text-3xl font-bold">Custom</span>
          ) : (
            <>
              <span className="text-4xl font-bold">৳{price.toLocaleString()}</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </>
          )}
          {billing === "yearly" && price > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
              ৳{plan.yearlyPrice.toLocaleString()}/year · Save 2 months
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <ul className="space-y-2 flex-1 mb-6">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
          {plan.restrictions.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-muted-foreground">
              <X className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <Link
          to={price === -1 ? "/site/contact" : `/register?plan=${plan.id}&billing=${billing}`}
          className="w-full"
        >
          <Button className="w-full" variant={highlighted ? "default" : "outline"} size="lg">
            {price === -1 ? "Contact Us for Price" : "Subscribe Now"}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function FeatureComparisonTable() {
  const plans: Array<"basic" | "pro" | "business" | "enterprise"> = ["basic", "pro", "business", "enterprise"];
  const planLabels = { basic: "Basic", pro: "Pro", business: "Business", enterprise: "Unlimited" };

  const renderCell = (val: boolean | string) => {
    if (val === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
    if (val === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
    return <span className="text-xs font-medium">{val}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Feature</TableHead>
            {plans.map((p) => (
              <TableHead key={p} className="text-center min-w-[100px]">
                <span className="font-semibold">{planLabels[p]}</span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {FEATURE_COMPARISON.map((cat) => (
            <>
              <TableRow key={cat.category}>
                <TableCell colSpan={5} className="bg-muted/50 font-semibold text-sm">
                  {cat.category}
                </TableCell>
              </TableRow>
              {cat.features.map((feat) => (
                <TableRow key={feat.name}>
                  <TableCell className="text-sm">{feat.name}</TableCell>
                  {plans.map((p) => (
                    <TableCell key={p} className="text-center">
                      {renderCell(feat[p])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const SitePricing = () => {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-screen bg-background">
      {/* Simple nav */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/site" className="flex items-center gap-2">
            <Plane className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">TAWSS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/site" className="text-sm text-muted-foreground hover:text-primary">Home</Link>
            <Link to="/login"><Button size="sm">Login</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 text-center px-4">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Choose the plan that fits your travel agency. Pay yearly and get 2 months free.
        </p>
        <BillingCycleToggle value={billing} onChange={setBilling} variant="light" />
      </section>

      {/* Plans */}
      <section className="container mx-auto px-4 pb-16">
        <Tabs defaultValue="cards" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList>
              <TabsTrigger value="cards">Plans</TabsTrigger>
              <TabsTrigger value="compare">Compare Features</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="cards">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto items-start">
              {visiblePlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} billing={billing} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compare">
            <Card className="max-w-5xl mx-auto">
              <CardContent className="p-0 md:p-6">
                <FeatureComparisonTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Enterprise CTA */}
      <section className="bg-muted/50 py-16 text-center px-4">
        <h2 className="text-2xl font-bold mb-2">Need a Custom Solution?</h2>
        <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
          Enterprise plans include custom integrations, dedicated support, API access, and more.
        </p>
        <Link to="/site/contact">
          <Button size="lg" variant="outline">Contact Sales</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TAWSS. All rights reserved.
      </footer>
    </div>
  );
};

export default SitePricing;
