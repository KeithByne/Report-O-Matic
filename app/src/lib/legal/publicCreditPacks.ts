/** Public marketing / Paddle review pricing (GBP list, includes Paddle margin — see packPricing.ts). */
export type PublicCreditPack = {
  id: string;
  name: string;
  reportCredits: number;
  priceGbp: string;
  priceNote?: string;
};

export const PUBLIC_CREDIT_PACKS: PublicCreditPack[] = [
  { id: "tester", name: "Tester Pack", reportCredits: 50, priceGbp: "£4.73" },
  { id: "economy", name: "Economy Pack", reportCredits: 250, priceGbp: "£23.65" },
  { id: "school", name: "School Pack", reportCredits: 600, priceGbp: "£47.30" },
  { id: "large_school", name: "Large School Pack", reportCredits: 1300, priceGbp: "£94.60" },
  {
    id: "universal_school",
    name: "Universal School Pack",
    reportCredits: 6000,
    priceGbp: "£473.00",
  },
];
