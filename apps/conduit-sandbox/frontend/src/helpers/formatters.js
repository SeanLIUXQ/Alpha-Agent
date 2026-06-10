export function formatTagCount(count = 0) {
  return `${count} 个标签`;
}

export function formatReadingStats(wordCount, readingMinutes) {
  return `${wordCount} 字 · 约 ${readingMinutes} 分钟阅读`;
}
