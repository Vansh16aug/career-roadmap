export type DomainKey = "engineering" | "law" | "management" | "design";

export interface DomainConfig {
  key: DomainKey;
  displayName: string;
  nirfCategory: string;
  sheetTabName: string;
  count: number; // How many colleges to fetch (e.g., 100 for Engineering, 30 for Law)
  promptKeywords: {
    single: string; // "college", "institute"
    plural: string; // "colleges", "institutes"
    course: string; // "B.Tech", "LLB", "MBA"
  };
}

export const DOMAINS: Record<DomainKey, DomainConfig> = {
  engineering: {
    key: "engineering",
    displayName: "Engineering",
    nirfCategory: "Engineering",
    sheetTabName: "EngineeringTop100",
    count: 100,
    promptKeywords: {
      single: "engineering college",
      plural: "engineering colleges",
      course: "B.Tech",
    },
  },
  management: {
    key: "management",
    displayName: "Hotel Management / Management",
    nirfCategory: "Management",
    sheetTabName: "ManagementTop100",
    count: 100,
    promptKeywords: {
      single: "management institute",
      plural: "management institutes",
      course: "BBA/BHM",
    },
  },
  law: {
    key: "law",
    displayName: "Law",
    nirfCategory: "Law",
    sheetTabName: "LawTop100",
    count: 100,
    promptKeywords: {
      single: "law college",
      plural: "law colleges",
      course: "LLB/BA LLB",
    },
  },
  design: {
    key: "design",
    displayName: "Design",
    nirfCategory: "Innovation", // NIRF has 'Innovation' or sometimes specific Design rankings, defaulting to broad search
    sheetTabName: "DesignTop100",
    count: 100,
    promptKeywords: {
      single: "design institute",
      plural: "design institutes",
      course: "B.Des",
    },
  },
};
