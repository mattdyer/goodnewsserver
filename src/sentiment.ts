import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);
const its = nlp.its;

export interface SentimentResult {
  score: number;
  isPositive: boolean;
  label: string;
}

export function analyzeSentiment(text: string): SentimentResult {
  if (!text || text.trim().length === 0) {
    return { score: 0, isPositive: false, label: 'neutral' };
  }
  
  const doc = nlp.readDoc(text);
  const rawScore = doc.out(its.sentiment);
  
  const score = typeof rawScore === 'number' ? rawScore : 0;
  const threshold = 0.05;
  const isPositive = score >= threshold;
  
  let label = 'neutral';
  if (score < -0.3) label = 'very negative';
  else if (score < -threshold) label = 'negative';
  else if (score >= 0.3) label = 'very positive';
  else if (score >= threshold) label = 'positive';
  
  return { score, isPositive, label };
}

export function filterPositiveNews<T extends { title: string; description?: string }>(
  articles: T[]
): Array<{ article: T; sentiment: SentimentResult }> {
  return articles
    .map((article) => ({
      article,
      sentiment: analyzeSentiment(`${article.title} ${article.description || ''}`),
    }))
    .filter((item) => item.sentiment.isPositive)
    .sort((a, b) => b.sentiment.score - a.sentiment.score);
}
