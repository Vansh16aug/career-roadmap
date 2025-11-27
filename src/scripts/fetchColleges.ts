import inquirer from 'inquirer';

import { fetchTopColleges } from '../clients/perplexityClient';
import { DOMAINS, type DomainKey } from '../config/domains';
import { env } from '../config/env';
import { writeCollegesToSheet } from '../services/sheetsWriter';

async function main(): Promise<void> {
  // CLI Selection
  const answers = await inquirer.prompt<{ domain: DomainKey }>([
    {
      type: 'list',
      name: 'domain',
      message: 'Select the domain to fetch colleges for:',
      choices: Object.values(DOMAINS).map((d) => ({
        name: d.displayName,
        value: d.key,
      })),
    },
  ]);

  const selectedDomain = DOMAINS[answers.domain];

  console.info(
    `Starting fetch for ${selectedDomain.displayName} (${selectedDomain.count} institutes)...`
  );

  // Fetch
  const { colleges } = await fetchTopColleges(selectedDomain);

  console.info(
    'Fetched %d institutes. Writing to Google Sheet tab "%s"...',
    colleges.length,
    selectedDomain.sheetTabName
  );

  // Write
  await writeCollegesToSheet(colleges, selectedDomain.sheetTabName);

  console.info('Sync complete ✅');
}

main().catch((error) => {
  console.error('Failed to fetch and sync colleges', error);
  process.exitCode = 1;
});
