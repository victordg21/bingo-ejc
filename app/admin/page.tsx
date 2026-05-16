import cardsData from "@/data/cards.json";
import AdminClient from "@/components/AdminClient";
import type { CardsFile } from "@/lib/types";

export const metadata = {
  title: "Admin — Bingo do São João",
};

export default function AdminPage() {
  const data = cardsData as CardsFile;
  return <AdminClient cards={data.cards} />;
}
