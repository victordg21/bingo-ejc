export type Card = {
  code: string;
  numbers: number[];
};

export type CardsFile = {
  seed: number;
  count: number;
  cards: Card[];
};

export type RankedCard = {
  code: string;
  numbers: number[];
  remaining: number;
  missing: number[];
};
