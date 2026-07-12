export function ravenLocalDateKey(date = new Date()): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function ravenDecisionStorageKey(restaurantId: string, userId: string, date = new Date()): string {
  return `raven:morning-ritual:${restaurantId}:${userId}:${ravenLocalDateKey(date)}`;
}
