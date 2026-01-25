/**
 * PWA hook for paginated party expenses.
 *
 * Re-exports SDK's usePartyExpenses hook directly.
 * The SDK hook handles all caching, pagination, and real-time updates.
 */
export { usePartyExpenses as usePartyPaginatedExpenses } from "@trizum/sdk";
