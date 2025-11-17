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
] as const;

export async function writeCollegesToSheet(colleges: CollegeInfo[]): Promise<void> {
  const sheets = await getSheetsClient();
  
  // Ensure the sheet tab exists
  await ensureSheetTabExists(sheets);
  
  const range = `${env.googleSheetTab}!A1:J${colleges.length + 1}`;

  const values = [
    [...headers],
    ...colleges.map((college) => [
      college.name ?? '',
      college.location ?? '',
      college.type ?? '',
      college.annualFee ?? '',
      college.entranceExamRequired ?? '',
      college.entranceExamDate ?? '',
      college.course ?? '',
      college.websiteLink ?? '',
      college.eligibility ?? '',
      college.approvedBy ?? '',
    ]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: env.googleSheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

async function ensureSheetTabExists(sheets: sheets_v4.Sheets): Promise<void> {
  try {
    // Try to get the spreadsheet metadata to check existing sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: env.googleSheetId,
    });

    const existingTabs = spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title) ?? [];
    
    if (!existingTabs.includes(env.googleSheetTab)) {
      // Create the tab if it doesn't exist
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.googleSheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: env.googleSheetTab,
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

