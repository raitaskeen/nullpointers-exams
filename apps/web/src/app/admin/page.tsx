import { redirect } from "next/navigation";

/** Old /admin links land in the app; admin-only pages there are gated by permission. */
export default function Page() {
  redirect("/app");
}
