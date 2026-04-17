const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

function getApiKey(): string | null {
  return localStorage.getItem('gemini-api-key')
}

export function setApiKey(key: string) {
  localStorage.setItem('gemini-api-key', key)
}

export function getStoredApiKey(): string {
  return localStorage.getItem('gemini-api-key') || ''
}

export function isAIEnabled(): boolean {
  const key = getApiKey()
  return !!key && key.length > 10
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('No API key configured')

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
      }
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

/**
 * AI-powered ingredient deep analysis
 */
export async function analyzeIngredientsAI(ingredientsText: string, productName: string): Promise<{
  summary: string
  healthRating: string
  concerns: string[]
  benefits: string[]
  recommendation: string
}> {
  const prompt = `Analyze these food product ingredients for health impact. Be concise.

Product: ${productName}
Ingredients: ${ingredientsText}

Respond in EXACTLY this JSON format (no markdown, no code blocks):
{"summary":"1-2 sentence overall assessment","healthRating":"good|moderate|poor","concerns":["max 4 specific health concerns"],"benefits":["max 3 health benefits"],"recommendation":"1 sentence dietary recommendation"}`

  try {
    const response = await callGemini(prompt)
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    throw new Error('AI analysis unavailable')
  }
}

/**
 * AI-powered smart search - understands natural language, typos, and intent
 */
export async function smartSearchQuery(userQuery: string): Promise<{
  correctedQuery: string
  searchTerms: string[]
  category: string
}> {
  const prompt = `A user is searching for food products. Understand their intent even if misspelled.

User query: "${userQuery}"

Respond in EXACTLY this JSON format (no markdown, no code blocks):
{"correctedQuery":"corrected/cleaned version of their query","searchTerms":["2-3 effective search terms for Open Food Facts API"],"category":"likely product category in english"}`

  try {
    const response = await callGemini(prompt)
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {
      correctedQuery: userQuery,
      searchTerms: [userQuery],
      category: ''
    }
  }
}

/**
 * AI-powered product comparison and recommendation
 */
export async function getAIRecommendation(
  productName: string,
  score: number,
  warnings: string[],
  category: string
): Promise<string> {
  const prompt = `Give a brief 2-sentence health recommendation for someone who scanned this food product.

Product: ${productName}
Health Score: ${score}/100
Category: ${category}
Warnings: ${warnings.join(', ')}

Be direct and helpful. No markdown formatting.`

  try {
    return await callGemini(prompt)
  } catch {
    return ''
  }
}
