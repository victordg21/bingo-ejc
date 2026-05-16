import cardsData from "@/data/cards.json";
import JogarClient from "@/components/JogarClient";
import type { CardsFile } from "@/lib/types";

export const metadata = {
  title: "Jogar — Bingo do São João",
};

export default function JogarPage() {
  const data = cardsData as CardsFile;
  return <JogarClient cards={data.cards} />;
}
