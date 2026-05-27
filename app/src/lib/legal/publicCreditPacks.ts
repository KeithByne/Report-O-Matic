/** Public marketing / Paddle review pricing (GBP list — same amounts as legacy EUR packs). */
export type PublicCreditPack = {
  id: string;
  name: string;
  reportCredits: number;
  priceGbp: string;
  priceNote?: string;
};

export const PUBLIC_CREDIT_PACKS: PublicCreditPack[] = [
  { id: "tester", name: "Tester Pack", reportCredits: 50, priceGbp: "£5.00" },
  { id: "economy", name: "Economy Pack", reportCredits: 250, priceGbp: "£25.00" },
  { id: "school", name: "School Pack", reportCredits: 600, priceGbp: "£50.00" },
  { id: "large_school", name: "Large School Pack", reportCredits: 1300, priceGbp: "£100.00" },
  {
    id: "universal_school",
    name: "Universal School Pack",
    reportCredits: 6000,
    priceGbp: "£500.00",
  },
];
