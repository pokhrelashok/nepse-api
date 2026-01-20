export const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export const generateStockSlug = (symbol: string, name?: string) => {
  return `${symbol}-${slugify(name || '')}`;
};
