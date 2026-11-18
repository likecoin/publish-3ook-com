// Import-free so `node --test` can run it.

interface BookCategoryNames {
  value: string
  zh: string
}

export function getBookCategoryName(category: BookCategoryNames, locale: string): string {
  return locale.startsWith('zh') ? category.zh : category.value
}
