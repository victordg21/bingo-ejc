import cardsData from "@/data/cards.json";
import TvClient from "@/components/TvClient";
import type { CardsFile } from "@/lib/types";

export const metadata = {
  title: "Telão — Bingo EJC",
};

export default function TvPage() {
  const data = cardsData as CardsFile;
  return <TvClient cards={data.cards} />;
}
