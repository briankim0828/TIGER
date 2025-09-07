// Slug utilities for exercise catalog
// Public seed: kebab-case(name)
// User custom: `${userId}-${kebab(name)}`
// Rules: lowercase, collapse whitespace, remove non-alphanum except spaces/hyphens, single hyphen runs collapsed.

function baseKebab(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9\s-]/g, '') // strip non-alphanum except space & hyphen
    .trim()
    .replace(/\s+/g, ' ') // collapse internal whitespace
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/-+/g, '-');
}

export function generatePublicSlug(name: string): string {
  return baseKebab(name);
}

export function generateUserExerciseSlug(userId: string, name: string): string {
  return `${userId}-${baseKebab(name)}`;
}

export function ensureSlug({ slug, name, userId, isPublic }: { slug?: string | null; name: string; userId?: string; isPublic?: boolean }): string {
  if (slug && slug.trim().length > 0) return slug.trim();
  if (isPublic) return generatePublicSlug(name);
  if (userId) return generateUserExerciseSlug(userId, name);
  // Fallback to public style if user context missing (should be rare)
  return generatePublicSlug(name);
}
