import { compareRetrievalQueries } from "../vector/retrieval-lab.js";

const results = await compareRetrievalQueries();

for (const result of results) {
  console.log(`\nQuery: ${result.query}`);
  for (const [index, match] of result.matches.entries()) {
    const topic = String(match.metadata.topic ?? "unknown");
    console.log(
      `${index + 1}. topic=${topic} distance=${match.distance.toFixed(4)} ${match.content}`
    );
  }
}
