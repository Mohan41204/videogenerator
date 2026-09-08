/**
 * promisePool.js
 * Reusable controlled concurrency helper mapping array items through an async task generator.
 */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  });

  await Promise.all(workers);
  return results;
}

module.exports = { mapConcurrent };
