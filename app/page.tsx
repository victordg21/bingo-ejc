import cardsData from "@/data/cards.json";
import BingoController from "@/components/BingoController";
import type { CardsFile } from "@/lib/types";

export default function Page() {
  const data = cardsData as CardsFile;
  return <BingoController cards={data.cards} />;
}
