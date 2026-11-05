import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval(
  "recover notification deliveries",
  { minutes: 5 },
  internal.automation.recover,
  {},
);
export default crons;
