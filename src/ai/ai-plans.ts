import { UserPlan } from '../users/schemas/user.schema';

// The single place that says what each plan gets. Selling a premium tier
// later = add a payment flow that sets user.plan; nothing else changes.
export const AI_PLANS: Record<UserPlan, { callsPerDay: number }> = {
  [UserPlan.FREE]: { callsPerDay: 25 },
  [UserPlan.PREMIUM]: { callsPerDay: 250 },
};
