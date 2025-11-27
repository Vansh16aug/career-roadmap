import axios from "axios";
import { env } from "../config/env";
import { DomainConfig } from "../config/domains";
import type { CollegeInfo } from "../types/college";

const CHAT_ENDPOINT = "https://api.perplexity.ai/chat/completions";
const MAX_RETRIES = 3;
const BATCH_SIZE = 10;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Fetches top colleges using Perplexity Chat Completions API for a specific domain
 * Uses online models to get fresh data with structured parsing
 * Ensures we fetch the target count by retrying failed batches and filling gaps
 */
export async function fetchTopColleges(domain: DomainConfig): Promise<{
  colleges: CollegeInfo[];
}> {
  console.info(
    "Fetching %s using Perplexity Chat API (Model: %s)...",
    domain.promptKeywords.plural,
    env.perplexityModel
  );

  const colleges: CollegeInfo[] = [];
  const TOTAL_COLLEGES = domain.count;
  const fetchedRanks = new Set<number>();

  // Initial pass: fetch all batches
  const batches: Array<{ startRank: number; endRank: number }> = [];
  for (let i = 0; i < TOTAL_COLLEGES; i += BATCH_SIZE) {
    batches.push({
      startRank: i + 1,
      endRank: Math.min(i + BATCH_SIZE, TOTAL_COLLEGES),
    });
  }

  // Fetch all batches with retries
  for (const batch of batches) {
    let success = false;
    let attempt = 0;

    while (!success && attempt < MAX_RETRIES) {
      attempt++;
      if (attempt > 1) {
        console.info(
          `Retrying batch ${batch.startRank}-${batch.endRank} (attempt ${attempt}/${MAX_RETRIES})...`
        );
      } else {
        console.info(
          `Fetching batch: Rank ${batch.startRank} to ${batch.endRank}...`
        );
      }

      try {
        const batchResult = await fetchBatch(
          batch.startRank,
          batch.endRank,
          domain
        );
        if (batchResult.colleges.length > 0) {
          colleges.push(...batchResult.colleges);
          // Track which ranks we've fetched (assuming we got the expected range)
          for (let rank = batch.startRank; rank <= batch.endRank; rank++) {
            fetchedRanks.add(rank);
          }
          console.info(
            `Successfully fetched ${batchResult.colleges.length} colleges for this batch.`
          );
          batchResult.colleges.forEach((c) => {
            if (c.sourceUrl) {
              console.info(`  - Source for ${c.name}: ${c.sourceUrl}`);
            }
          });
          success = true;
        } else {
          if (attempt < MAX_RETRIES) {
            console.warn(
              `No colleges found for batch ${batch.startRank}-${batch.endRank}, will retry...`
            );
          } else {
            console.warn(
              `Failed to fetch batch ${batch.startRank}-${batch.endRank} after ${MAX_RETRIES} attempts.`
            );
          }
        }
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          console.warn(
            `Error fetching batch ${batch.startRank}-${batch.endRank} (attempt ${attempt}):`,
            error instanceof Error ? error.message : error
          );
        } else {
          console.error(
            `Failed to fetch batch ${batch.startRank}-${batch.endRank} after ${MAX_RETRIES} attempts:`,
            error
          );
        }
      }

      if (!success && attempt < MAX_RETRIES) {
        await sleep(2000); // Longer delay before retry
      }
    }

    // Small delay between batches
    await sleep(1000);
  }

  // Gap filling: identify missing ranks and fetch them
  const missingRanks: number[] = [];
  for (let rank = 1; rank <= TOTAL_COLLEGES; rank++) {
    if (!fetchedRanks.has(rank)) {
      missingRanks.push(rank);
    }
  }

  if (missingRanks.length > 0 && colleges.length < TOTAL_COLLEGES) {
    console.info(
      `Found ${missingRanks.length} missing ranks. Attempting to fill gaps...`
    );

    // Group missing ranks into batches
    const gapBatches: Array<{ startRank: number; endRank: number }> = [];
    for (let i = 0; i < missingRanks.length; i += BATCH_SIZE) {
      const batchRanks = missingRanks.slice(i, i + BATCH_SIZE);
      if (batchRanks.length > 0) {
        gapBatches.push({
          startRank: batchRanks[0]!,
          endRank: batchRanks[batchRanks.length - 1]!,
        });
      }
    }

    // Fetch missing batches
    for (const gapBatch of gapBatches) {
      let success = false;
      let attempt = 0;

      while (
        !success &&
        attempt < MAX_RETRIES &&
        colleges.length < TOTAL_COLLEGES
      ) {
        attempt++;
        console.info(
          `Filling gap: Rank ${gapBatch.startRank} to ${gapBatch.endRank} (attempt ${attempt}/${MAX_RETRIES})...`
        );

        try {
          const batchResult = await fetchBatch(
            gapBatch.startRank,
            gapBatch.endRank,
            domain
          );
          if (batchResult.colleges.length > 0) {
            colleges.push(...batchResult.colleges);
            for (
              let rank = gapBatch.startRank;
              rank <= gapBatch.endRank;
              rank++
            ) {
              fetchedRanks.add(rank);
            }
            console.info(
              `Successfully filled gap with ${batchResult.colleges.length} colleges.`
            );
            success = true;
          }
        } catch (error) {
          console.warn(
            `Error filling gap ${gapBatch.startRank}-${gapBatch.endRank} (attempt ${attempt}):`,
            error instanceof Error ? error.message : error
          );
        }

        if (!success && attempt < MAX_RETRIES) {
          await sleep(2000);
        }
      }
      await sleep(1000);
    }
  }

  console.info(
    `Successfully fetched total ${colleges.length}/${TOTAL_COLLEGES} colleges`
  );

  if (colleges.length < TOTAL_COLLEGES) {
    console.warn(
      `Warning: Only fetched ${colleges.length} out of ${TOTAL_COLLEGES} requested colleges.`
    );
  }

  return {
    colleges,
  };
}

async function fetchBatch(
  startRank: number,
  endRank: number,
  domain: DomainConfig
): Promise<{ colleges: CollegeInfo[] }> {
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const systemPrompt = `You are a precise data extraction engine. 
Your task is to find and list the top ${domain.promptKeywords.plural} in India based on the latest available NIRF rankings (likely 2024 or 2025) for the '${domain.nirfCategory}' category. Only consider undergraduate (UG) programs and ignore any postgraduate or masters programs.`;

  const userPrompt = `List the top ${
    domain.promptKeywords.plural
  } in India ranked #${startRank} to #${endRank} according to the NIRF ${
    domain.nirfCategory
  } Ranking. Only include undergraduate programs (UG); exclude postgraduate/masters offerings such as MBA, PGDM, MBA-PGP, M.Des, etc.
For each institute, provide the following details based on the latest available information:
1. name: Name of the institute.
2. location: City and State.
3. type: Government, Private, or Autonomous.
4. annualFee: Approximate annual ${
    domain.promptKeywords.course
  } tuition fee (e.g., "₹2.5 Lakhs").
5. entranceExamRequired: Entrance exams accepted.
6. entranceExamDate: Official dates for the main entrance exam for ${nextYear} admission cycle. If exact dates aren't out, provide the tentative month.
7. course: Main flagship undergraduate course (typically "${
    domain.promptKeywords.course
  }" or another UG program).
8. websiteLink: Official website URL.
9. eligibility: Basic eligibility.
10. approvedBy: Approvals (e.g., "AICTE, UGC", "BCI" for Law).
11. sourceUrl: The primary URL where you found the exam date or fee information.

Ensure the list corresponds exactly to the NIRF rank range ${startRank}-${endRank}. Return exactly ${
    endRank - startRank + 1
  } institutes. If a rank is missing, skip it but try to fill the range.`;

  const jsonSchema = {
    type: "json_schema",
    json_schema: {
      schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            location: { type: "string" },
            type: { type: "string" },
            annualFee: { type: "string" },
            entranceExamRequired: { type: "string" },
            entranceExamDate: { type: "string" },
            course: { type: "string" },
            websiteLink: { type: "string" },
            eligibility: { type: "string" },
            approvedBy: { type: "string" },
            sourceUrl: { type: "string" },
          },
          required: ["name", "location", "type", "entranceExamRequired"],
          additionalProperties: false,
        },
      },
    },
  };

  try {
    const response = await axios.post<ChatCompletionResponse>(
      CHAT_ENDPOINT,
      {
        model: env.perplexityModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: jsonSchema,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${env.perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      }
    );

    const content = response.data.choices[0]?.message?.content || "[]";

    // With structured outputs, we don't need to strip markdown blocks
    let parsedData: any[];
    try {
      parsedData = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse JSON response:", content);
      throw new Error("Invalid JSON response from API");
    }

    if (!Array.isArray(parsedData)) {
      throw new Error("API response is not an array");
    }

    // Map and validate to ensure it matches CollegeInfo
    const colleges: CollegeInfo[] = parsedData.map((item: any) => ({
      name: item.name || "Unknown Institute",
      location: item.location,
      type: item.type,
      annualFee: item.annualFee,
      entranceExamRequired: item.entranceExamRequired,
      entranceExamDate: item.entranceExamDate,
      course: item.course,
      websiteLink: item.websiteLink,
      eligibility: item.eligibility,
      approvedBy: item.approvedBy,
      sourceUrl: item.sourceUrl,
    }));

    return { colleges };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const errorData = error.response.data;
      throw new Error(`Perplexity API error: ${JSON.stringify(errorData)}`);
    }
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
