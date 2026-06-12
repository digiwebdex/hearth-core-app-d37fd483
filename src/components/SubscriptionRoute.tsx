import { useAuth } from "@/contexts/AuthContext";
import SubscriptionRenewalPage from "@/components/SubscriptionRenewalPage";
import Subscriptions from "@/pages/Subscriptions";
import type { SubscriptionBlockReason } from "@/lib/subscriptionAccess";

/**
 * /subscription route: when blocked, show full payment UI (not the old dead-end card).
 * When active, show normal subscription management page.
 */
const SubscriptionRoute = () => {
  const { isSubscriptionBlocked, subscriptionBlockReason } = useAuth();

  if (isSubscriptionBlocked) {
    const reason: SubscriptionBlockReason =
      subscriptionBlockReason ?? "expired";
    return <SubscriptionRenewalPage reason={reason} />;
  }

  return <Subscriptions />;
};

export default SubscriptionRoute;
