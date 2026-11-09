export type CalendarReceipt = {
  id: string;
  title: string;
  name: string;
  mine: boolean;
  sent: boolean;
  channel: "app" | "email";
  state: string;
  dueAt: string;
  dismissed: boolean;
};
export type CalendarView = {
  scope: string;
  revision: number;
  canWrite: boolean;
  feed: { active: boolean; revision: number };
  people: { id: string; name: string }[];
  items: { id: string; title: string }[];
  receipts: CalendarReceipt[];
};

/** One mounted calendar form per navigation controller; never contains private state. */
export const calendarFormGuard = {};
