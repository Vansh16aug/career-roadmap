import { google, type sheets_v4 } from 'googleapis';

import { env } from '../config/env';
import type { CollegeInfo } from '../types/college';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const headers = [
  'College Name',
  'Location',
  'Type',
  'Annual Fee',
  'Entrance Exam Required',
  'Entrance Exam Date (This Year)',
  'Course',
  'Website Link',
  'Eligibility',
  'Approved By',
  'Source URL',
] as const;

export async function writeCollegesToSheet(colleges: CollegeInfo[], tabName: string): Promise<void> {
  const sheets = await getSheetsClient();
  
  // Ensure the sheet tab exists
  await ensureSheetTabExists(sheets, tabName);
  
  const range = `${tabName}!A1:K${colleges.length + 1}`;

  const values = [
    [...headers],
    ...colleges.map((college) => {
      const formattedEntranceExams = formatEntranceExamFields(
        college.entranceExamRequired,
        college.entranceExamDate,
      );

      return [
        college.name ?? '',
        college.location ?? '',
        college.type ?? '',
        college.annualFee ?? '',
        formattedEntranceExams.names ?? college.entranceExamRequired ?? '',
        formattedEntranceExams.dates ?? college.entranceExamDate ?? '',
        college.course ?? '',
        college.websiteLink ?? '',
        college.eligibility ?? '',
        college.approvedBy ?? '',
        college.sourceUrl ?? '',
      ];
    }),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function ensureSheetTabExists(sheets: sheets_v4.Sheets, tabName: string): Promise<void> {
  try {
    // Try to get the spreadsheet metadata to check existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: env.googleSheetId,
    });

    const existingTabs = spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title) ?? [];
    
    if (!existingTabs.includes(tabName)) {
      // Create the tab if it doesn't exist
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.googleSheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabName,
                },
              },
            },
          ],
        },
      });
    }
  } catch (error) {
    // If we can't check/create, try to write anyway - might be a permissions issue
    console.warn('Could not verify/create sheet tab, attempting write anyway:', error);
  }
}

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const auth = new google.auth.GoogleAuth({
    keyFile: env.googleCredentialsPath,
    scopes: SCOPES,
  });

  // Ensure auth client is ready
  await auth.getClient();

  const sheets = google.sheets({ version: 'v4', auth });

  return sheets;
}

function formatEntranceExamFields(
  examNames?: string,
  examDates?: string,
): { names?: string; dates?: string } {
  const nameParts = splitMultiValue(examNames);
  const dateParts = splitMultiValue(examDates);

  if (nameParts.length <= 1 && dateParts.length <= 1) {
    return {};
  }

  const lineCount = Math.max(nameParts.length, dateParts.length);
  if (!lineCount) {
    return {};
  }

  const paddedNames = padList(nameParts, lineCount, '');
  const paddedDates = padList(dateParts, lineCount, dateParts.at(-1) ?? '');

  const names = paddedNames.join('\n').trim();
  const dates = paddedDates.join('\n').trim();

  const result: { names?: string; dates?: string } = {};
  if (names) {
    result.names = names;
  }
  if (dates) {
    result.dates = dates;
  }
  return result;
}

function splitMultiValue(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/(?:,|\/|;|&|\||\band\b)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function padList(items: string[], length: number, filler: string): string[] {
  if (items.length >= length) {
    return items.slice();
  }

  const result = items.slice();
  while (result.length < length) {
    result.push(filler);
  }
  return result;
}

