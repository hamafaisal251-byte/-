import fs from 'fs';

const content = fs.readFileSync('postgres_state.json', 'utf8');

function findJsonError(str) {
  try {
    JSON.parse(str);
    console.log("JSON is valid!");
  } catch (err) {
    console.log("Parse failed:", err.message);
    const match = err.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1], 10);
      const lines = str.slice(0, pos).split('\n');
      console.log(`Error at line ${lines.length}, column ${lines[lines.length - 1].length}`);
      console.log("Error context:");
      console.log(str.slice(pos - 100, pos + 100));
    } else {
      console.log("Could not extract position from error message.");
    }
  }
}

findJsonError(content);
