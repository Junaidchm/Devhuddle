/**
 * Calculate trending score for a project
 * Formula considers:
 * - Likes (weight: 2)
 * - Comments (weight: 3)
 * - Shares (weight: 4)
 * - Views (weight: 0.1)
 * - Time decay factor (projects older than 7 days get reduced score)
 */
export function calculateTrendingScore(
  likesCount: number,
  commentsCount: number,
  sharesCount: number,
  viewsCount: number,
  publishedAt: Date | null
): number {
  // Base engagement score
  const engagementScore =
    likesCount * 2 +
    commentsCount * 3 +
    sharesCount * 4 +
    viewsCount * 0.1;

  // Time decay factor
  let timeDecayFactor = 1;
  if (publishedAt) {
    const daysSincePublished =
      (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    
    // Projects older than 7 days get reduced score
    if (daysSincePublished > 7) {
      timeDecayFactor = 1 + daysSincePublished * 0.1;
    }
    
    // Recent activity bonus (projects published in last 24 hours get boost)
    if (daysSincePublished < 1) {
      timeDecayFactor *= 0.8; // Boost by 20%
    }
  }

  return engagementScore / timeDecayFactor;
}

