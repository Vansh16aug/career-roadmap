export interface CollegeInfo {
  name: string;
  location?: string;
  type?: string;
  annualFee?: string;
  entranceExamRequired?: string;
  entranceExamDate?: string;
  course?: string;
  websiteLink?: string;
  eligibility?: string;
  approvedBy?: string;
}

export interface FetchResultMetadata {
  fetchedAt: string;
  model: string;
  sourcePrompt: string;
}
