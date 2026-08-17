// Temporary build-time patch: Web Order must expose only four sections.
// This file is intentionally inert and documents the required UI contract.
const WEB_ORDER_STATUSES = ["web_pending", "incomplete", "hold", "cancelled"];
export default WEB_ORDER_STATUSES;
