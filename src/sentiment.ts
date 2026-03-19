const POSITIVE_KEYWORDS = [
  'breakthrough', 'innovation', 'success', 'achievement', 'discovery', 'advance',
  'progress', 'improve', 'solution', 'win', 'award', 'celebrate', ' milestone',
  'record', 'growth', 'positive', 'hope', 'helpful', 'support', 'assist',
  'collaboration', 'partnership', 'unite', 'inspire', 'empower', 'impressive',
  'remarkable', 'outstanding', 'excellent', 'good', 'great', 'amazing', 'wonderful',
  'optimistic', 'uplifting', 'heartwarming', 'heroic', 'courageous', 'brave',
  'sustainable', 'renewable', 'clean', 'green', 'eco-friendly', 'conservation',
  'rescue', 'save', 'protect', 'heal', 'cure', 'treatment', 'prevent', 'vaccine',
  'education', 'learn', 'teach', 'train', 'develop', 'build', 'create', 'design',
  'launch', 'start', 'expand', 'increase', 'announce', 'recover', 'rebuild', 'restore',
  'volunteer', 'donate', 'contribute', 'community', 'together', 'global', 'worldwide',
  'historic', 'first', 'new', 'novel', 'revolutionary', 'transform', 'upgrade',
];

const NEGATIVE_KEYWORDS = [
  'death', 'died', 'kill', 'murder', 'attack', 'terror', 'war', 'conflict',
  'disaster', 'crash', 'accident', 'tragedy', 'crisis', 'emergency', 'disaster',
  'scandal', 'corruption', 'fraud', 'scam', 'fraudulent', 'lawsuit', 'investigation',
  'arrest', 'jail', 'prison', 'convicted', 'guilty', 'murder', 'shooting', 'violence',
  'death toll', 'victim', 'injured', 'wounded', 'hospitalized', 'casualties',
  'bankruptcy', 'layoffs', 'fired', 'unemployment', 'recession', 'depression',
  'pollution', 'toxic', 'hazard', 'danger', 'threat', 'warning', 'risk',
  'collapse', 'failure', 'failed', 'fails', 'problem', 'issue', 'bug', 'error',
];

export interface SentimentResult {
  score: number;
  isPositive: boolean;
  matchedKeywords: string[];
}

export function analyzeSentiment(text: string): SentimentResult {
  const lowerText = text.toLowerCase();
  
  let positiveMatches = 0;
  let negativeMatches = 0;
  
  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];
  
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      positiveMatches++;
      matchedPositive.push(keyword);
    }
  }
  
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      negativeMatches++;
      matchedNegative.push(keyword);
    }
  }
  
  const score = positiveMatches - negativeMatches;
  
  return {
    score,
    isPositive: score > 0,
    matchedKeywords: matchedPositive,
  };
}

export function filterPositiveNews(articles: Array<{ title: string; description: string }>): 
  Array<{ article: { title: string; description: string }; sentiment: SentimentResult }> {
  
  return articles
    .map((article) => ({
      article,
      sentiment: analyzeSentiment(`${article.title} ${article.description}`),
    }))
    .filter((item) => item.sentiment.isPositive)
    .sort((a, b) => b.sentiment.score - a.sentiment.score);
}