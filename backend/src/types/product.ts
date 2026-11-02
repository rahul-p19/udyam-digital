export interface Product {
  productId: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  monthlyPrice: {
    min: number;
    max: number;
    currency: "INR";
  };
  setupFee: number;
  contractMonths: number;
  eligibleCityTiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGSTIN: boolean;
  requiredProducts: string[];
  typicalInstallDays: number;
  targetSegments: string[];
}
