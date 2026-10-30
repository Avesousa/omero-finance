import { redirect } from "next/navigation";

/** La app es Plan simple: la raíz lleva a Mi mes. */
export default function Page() {
  redirect("/plan");
}
