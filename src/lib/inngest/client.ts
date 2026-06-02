import { Inngest } from "inngest";

// The Inngest client. Reads INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY from the
// environment automatically in cloud; the local dev server needs neither.
export const inngest = new Inngest({ id: "restaurant-os" });
