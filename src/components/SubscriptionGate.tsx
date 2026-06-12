import { useAuth } from "@/contexts/AuthContext";
import SubscriptionRenewalPage from "@/components/SubscriptionRenewalPage";

interface SubscriptionGateProps {
  children: React.ReactNode;
}

/**
 * When trial/subscription ends, agencies can still log in but see the renewal
 * payment screen until super admin approves payment and reactivates the plan.
 */
const SubscriptionGate: React.FC<SubscriptionGateProps> = ({ children }) => {
  const { isSubscriptionBlocked, subscriptionBlockReason } = useAuth();

  if (isSubscriptionBlocked && subscriptionBlockReason) {
    return <SubscriptionRenewalPage reason={subscriptionBlockReason} />;
  }

  return <>{children}</>;
};

export default SubscriptionGate;
