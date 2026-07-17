import fs from 'fs';

try {
  const content = fs.readFileSync('postgres_state.json', 'utf8');
  console.log("File length:", content.length);
  const pos = 1056526;
  console.log("Context around 1056526:");
  console.log("---");
  console.log(content.slice(Math.max(0, pos - 150), Math.min(content.length, pos + 150)));
  console.log("---");
} catch (err) {
  console.error(err);
}
