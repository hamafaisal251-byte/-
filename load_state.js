import fs from 'fs';

try {
  const d = JSON.parse(fs.readFileSync('postgres_state.json', 'utf8'));
  console.log('--- SELF IMPROVEMENT LOGS ---');
  if (d.self_improvement_logs) {
    d.self_improvement_logs.forEach((log, index) => {
      console.log(`${index + 1}. Weakness: "${log.weaknessDetected}" | Topic: "${log.researchTopic}" | Candidate: "${log.generatedCandidateName}"`);
    });
  }
  console.log('\n--- HYPOTHESIS JOURNAL ---');
  if (d.hypothesis_journal) {
    d.hypothesis_journal.forEach((h, index) => {
      console.log(`${index + 1}. Title: "${h.title}" | Desc: "${h.description}"`);
    });
  }
} catch (err) {
  console.error("Failed to parse inside load_state:", err);
}
