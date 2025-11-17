import { fetchTopEngineeringColleges } from '../clients/perplexityClient';
import { env } from '../config/env';
import { writeCollegesToSheet } from '../services/sheetsWriter';

async function main(): Promise<void> {
  console.info('Fetching top engineering colleges with model %s...', env.perplexityModel);

  const { colleges } = await fetchTopEngineeringColleges();
  console.info('Fetched %d colleges. Writing to Google Sheet %s...', colleges.length, env.googleSheetId);

  await writeCollegesToSheet(colleges);

  console.info('Sync complete ✅');
}

main().catch((error) => {
  console.error('Failed to fetch and sync colleges', error);
  process.exitCode = 1;
});

