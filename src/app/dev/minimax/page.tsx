import { notFound } from "next/navigation";
import { MiniMaxPlayground } from "./playground";

export default function DevMiniMaxPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <MiniMaxPlayground />;
}
