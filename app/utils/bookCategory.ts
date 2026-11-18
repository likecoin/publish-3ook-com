// Import-free so `node --test` can run it.

interface BookCategoryNames {
  value: string
  zh: string
}

export function getBookCategoryName(category: BookCategoryNames, locale: string): string {
  return locale.startsWith('zh') ? category.zh : category.value
}

// A cell may name the stored value or either menu name, whatever language the page is in.
// A comma is no separator, since one value is itself "Mind, Body, Spirit".
export function resolveBookCategory(
  input: string | undefined,
  categories: readonly BookCategoryNames[],
): string | undefined {
  const key = input?.trim().toLowerCase()
  if (!key) { return undefined }
  return categories.find(category => (
    category.value.toLowerCase() === key
    || category.zh === key
  ))?.value
}
