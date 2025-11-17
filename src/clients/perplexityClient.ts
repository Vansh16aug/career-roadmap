import axios from "axios";

import { env } from "../config/env";
import type { CollegeInfo } from "../types/college";

interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityChoice {
  message: {
    role: "assistant";
    content: string;
  };
}

interface PerplexityResponse {
  choices: PerplexityChoice[];
}

const PERPLEXITY_ENDPOINT = "https://api.perplexity.ai/chat/completions";

const SYSTEM_MESSAGE =
  "You are a higher-education research assistant that strictly returns valid JSON.";

const USER_PROMPT = `
Return the top 10 engineering colleges in India as a JSON array of 10 objects.
Each object MUST have these exact fields:
- name (string): Full name of the institution
- location (string): City and State where the college is located (e.g., "New Delhi, Delhi")
- type (string): Nature of institution - one of: "Government", "Private", or "Autonomous"
- annualFee (string): Approximate annual tuition fee in INR format (e.g., "₹2,00,000")
- entranceExamRequired (string): Entrance exam(s) accepted or required (e.g., "JEE Main, JEE Advanced")
- entranceExamDate (string): The confirmed date (or date range) for the primary entrance exam happening THIS CALENDAR YEAR (e.g., "20 April 2025" or "June 2025"). Use official notices from https://jeemain.nta.nic.in/ for JEE Main and https://jeeadv.ac.in/ for JEE Advanced. If the official date is not announced yet, respond with "TBD (expected Month YYYY)" using the best publicly available guidance from those sources.
- course (string): Course or program name (e.g., "B.Tech Computer Science")
- websiteLink (string): Official college website URL
- eligibility (string): Minimum qualification or marks required for admission
- approvedBy (string): Recognizing or approving authority (e.g., "AICTE", "UGC", "NAAC A+")

Return ONLY a valid JSON array. Do not add any extra commentary outside of the JSON array.
`;

export async function fetchTopEngineeringColleges(): Promise<{
  colleges: CollegeInfo[];
  rawResponse: string;
}> {
  try {
    const response = await axios.post<PerplexityResponse>(
      PERPLEXITY_ENDPOINT,
      {
        model: env.perplexityModel,
        temperature: 0.2,
        messages: buildMessages(),
      },
      {
        headers: {
          Authorization: `Bearer ${env.perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30_000,
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content?.trim();
    if (!rawContent) {
      throw new Error("Perplexity returned an empty response.");
    }

    const parsed = parseColleges(rawContent);

    if (!parsed.length) {
      throw new Error("Unable to parse college data from Perplexity response.");
    }

    return { colleges: parsed, rawResponse: rawContent };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const errorData = error.response.data as {
        error?: { message?: string; type?: string };
      };
      const errorMessage =
        errorData.error?.message ?? JSON.stringify(errorData);
      throw new Error(`Perplexity API error: ${errorMessage}`);
    }
    throw error;
  }
}

function buildMessages(): PerplexityMessage[] {
  return [
    { role: "system", content: SYSTEM_MESSAGE.trim() },
    { role: "user", content: USER_PROMPT.trim() },
  ];
}

function parseColleges(content: string): CollegeInfo[] {
  const jsonBlock = extractJsonArray(content);
  if (jsonBlock) {
    const parsed = safeJsonParse(jsonBlock);
    if (Array.isArray(parsed)) {
      return normalizeColleges(parsed);
    }
  }

  return parseFallbackList(content);
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return text.slice(start, end + 1);
}

function safeJsonParse(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function normalizeColleges(entries: unknown[]): CollegeInfo[] {
  const result: CollegeInfo[] = [];

  for (const entry of entries) {
    const candidate = entry as Partial<CollegeInfo>;
    const name = candidate?.name;
    if (!name || typeof name !== "string") {
      continue;
    }

    const sanitizedName = sanitize(name);
    if (!sanitizedName) {
      continue;
    }

    const college: CollegeInfo = {
      name: sanitizedName,
    };

    const location = sanitize(candidate.location);
    if (location !== undefined) {
      college.location = location;
    }

    const type = sanitize(candidate.type);
    if (type !== undefined) {
      college.type = type;
    }

    const annualFee = sanitize(candidate.annualFee);
    if (annualFee !== undefined) {
      college.annualFee = annualFee;
    }

    const entranceExamRequired = sanitize(candidate.entranceExamRequired);
    if (entranceExamRequired !== undefined) {
      college.entranceExamRequired = entranceExamRequired;
    }

    const entranceExamDate = sanitize(candidate.entranceExamDate);
    if (entranceExamDate !== undefined) {
      college.entranceExamDate = entranceExamDate;
    }

    const course = sanitize(candidate.course);
    if (course !== undefined) {
      college.course = course;
    }

    const websiteLink = sanitize(candidate.websiteLink);
    if (websiteLink !== undefined) {
      college.websiteLink = websiteLink;
    }

    const eligibility = sanitize(candidate.eligibility);
    if (eligibility !== undefined) {
      college.eligibility = eligibility;
    }

    const approvedBy = sanitize(candidate.approvedBy);
    if (approvedBy !== undefined) {
      college.approvedBy = approvedBy;
    }

    result.push(college);
  }

  return result;
}

function parseFallbackList(_content: string): CollegeInfo[] {
  // Fallback parsing is not ideal for the new format
  // Return empty array to force JSON parsing
  return [];
}

function sanitize(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}
