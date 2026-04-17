import type { ProductAnalysis, Ingredient, DietaryType, IngredientSource, SafetyLevel, Alternative } from './types'
import { isAIEnabled, smartSearchQuery } from './ai'

const OPEN_FOOD_FACTS_API = '/api/off/api/v2'
const OPEN_FOOD_FACTS_DIRECT = 'https://world.openfoodfacts.org'
const IS_DEV = import.meta.env.DEV
const SEARCH_FIELDS = 'code,product_name,product_name_en,brands,categories,categories_tags_en,ingredients_text,ingredients_text_en,ingredients,nutriscore_grade,image_url,nutriments,additives_tags,allergens'
const SUGGEST_FIELDS = 'product_name,product_name_en,brands,image_url,code'

/**
 * Search with multiple fallbacks: proxy v2 → proxy cgi → direct v2 → direct cgi
 */
async function searchOpenFoodFacts(query: string, fields: string, pageSize: number): Promise<any> {
  const encodedQuery = encodeURIComponent(query)
  
  const urls: string[] = []
  
  // Proxy URLs only work with Vite dev server
  if (IS_DEV) {
    urls.push(
      `${OPEN_FOOD_FACTS_API}/search?search_terms=${encodedQuery}&page_size=${pageSize}&lc=en&fields=${fields}`,
      `/api/off/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&page_size=${pageSize}&json=true&lc=en&fields=${fields}`,
    )
  }
  
  // Direct URLs work everywhere (Open Food Facts supports CORS)
  urls.push(
    `${OPEN_FOOD_FACTS_DIRECT}/api/v2/search?search_terms=${encodedQuery}&page_size=${pageSize}&lc=en&fields=${fields}`,
    `${OPEN_FOOD_FACTS_DIRECT}/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&page_size=${pageSize}&json=true&lc=en&fields=${fields}`,
  )
  
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      
      if (response.ok) {
        const data = await response.json()
        // v2 API sometimes returns all products — check count is reasonable
        if (data.count < 100000 && data.products?.length > 0) {
          return data
        }
        // If products exist but count is too high, data is still usable
        if (data.products?.length > 0) {
          return data
        }
      }
    } catch {
      // Try next URL
    }
  }
  
  return { products: [] }
}

/**
 * Check if a product name looks English (basic Latin characters only)
 */
function isEnglishName(name: string): boolean {
  if (!name) return false
  // Reject names with non-Latin scripts (Cyrillic, Arabic, CJK, Thai, Devanagari, etc.)
  if (/[\u0400-\u04FF\u0600-\u06FF\u3000-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F\u0590-\u05FF]/.test(name)) return false
  // Reject names with accented characters (strong signal of non-English)
  const accentedCount = (name.match(/[àâäéèêëïîôùûüÿçæœñáíóúãõèéêë]/gi) || []).length
  if (accentedCount > 0 && accentedCount > name.length * 0.08) return false
  // Reject names containing common non-English food/product words
  const lower = name.toLowerCase()
  const nonEnglishWords = [
    // French
    'sans', 'sucres', 'avec', 'goût', 'gout', 'saveur', 'boisson', 'fromage',
    'sucré', 'sucre', 'lait', 'fraise', 'pomme', 'eau', 'jus', 'blanc',
    'naturelle', 'minérale', 'minerale', 'crème', 'creme', 'beurre', 'confiture',
    'pâte', 'pate', 'tartiner', 'chocolat au', 'yaourt', 'yaourts',
    // German
    'und', 'mit', 'ohne', 'zucker', 'milch', 'wasser', 'sahne',
    // Spanish
    'azúcar', 'azucar', 'leche', 'sabor', 'bebida', 'galletas',
    // Italian
    'senza', 'zucchero', 'latte', 'acqua', 'gusto', 'formaggio',
    // Portuguese
    'açúcar', 'açucar', 'leite', 'sabores',
    // Arabic transliterated
    'halal', 'sidi',
  ]
  const wordMatches = nonEnglishWords.filter(w => {
    // Match as whole word or at word boundary
    const regex = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    return regex.test(lower)
  }).length
  if (wordMatches >= 1) return false
  return true
}

/**
 * Normalize brand name: treat "Coke", "Coca-Cola", "Coca Cola" etc. as same brand
 */
const BRAND_ALIASES: Record<string, string> = {
  'coke': 'coca-cola', 'coca cola': 'coca-cola', 'coca-cola': 'coca-cola',
  'coke zero': 'coca-cola', 'coke zéro®': 'coca-cola', 'coke zéro': 'coca-cola',
  'pepsi': 'pepsico', 'pepsi cola': 'pepsico', 'pepsico': 'pepsico',
  'lays': 'frito-lay', "lay's": 'frito-lay', 'frito-lay': 'frito-lay',
  'nestle': 'nestlé', 'nestlé': 'nestlé',
}

function normalizeBrand(brand: string): string {
  const lower = brand.toLowerCase().trim()
  return BRAND_ALIASES[lower] || lower
}

/**
 * Normalize product name for deduplication: strip sizes, weights, volumes
 * Returns a key like "brand|product-flavour" for grouping
 */
function normalizeProductKey(name: string, brand: string): string {
  const normalized = name
    .toLowerCase()
    // Remove sizes/weights: 500ml, 1.5l, 330g, 12oz, 1kg, etc.
    .replace(/\b\d+(\.\d+)?\s*(ml|l|cl|dl|g|kg|oz|fl\.?\s*oz|liter|litre|gram|kilogram|ounce|lb|lbs|mg)\b/gi, '')
    // Remove pack sizes: 6-pack, x12, pack of 6, etc.
    .replace(/\b(x\d+|\d+\s*-?\s*pack|pack\s*of\s*\d+|\d+\s*x\s*\d+)\b/gi, '')
    // Remove common suffixes that are just packaging variants
    .replace(/\b(can|bottle|pet|glass|tetra|carton|pouch|sachet|box|tin)\b/gi, '')
    // Remove trailing numbers (often product codes)
    .replace(/\s+\d+$/, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
  const brandNorm = normalizeBrand(brand)
  return `${brandNorm}|${normalized}`
}

/**
 * Common product aliases for better search
 */
const PRODUCT_ALIASES: Record<string, string[]> = {
  'coke': ['coca cola', 'coca-cola'],
  'pepsi': ['pepsico', 'pepsi cola'],
  'maggi': ['maggi noodles', 'nestle maggi'],
  'oreo': ['oreo cookies', 'oreo biscuit'],
  'lays': ['lay\'s', 'lays chips'],
  'doritos': ['doritos chips', 'doritos nacho'],
  'sprite': ['sprite soda', 'coca cola sprite'],
  'fanta': ['fanta orange', 'coca cola fanta'],
  'kitkat': ['kit kat', 'nestle kitkat'],
  'nescafe': ['nescafé', 'nestle nescafe'],
  'cheetos': ['cheetos puffs', 'cheetos chips'],
  'redbull': ['red bull'],
  'red bull': ['redbull energy drink'],
  'mtn dew': ['mountain dew'],
  'mountain dew': ['mtn dew', 'pepsico mountain dew'],
  'pb': ['peanut butter'],
  'oj': ['orange juice'],
  'choco': ['chocolate'],
  'biscuit': ['biscuits', 'cookies'],
  'chips': ['potato chips', 'crisps'],
  'dahi': ['yogurt', 'curd'],
  'atta': ['wheat flour', 'whole wheat flour'],
  'dal': ['lentils', 'pulses'],
  'ghee': ['clarified butter', 'desi ghee'],
  'paneer': ['cottage cheese', 'paneer fresh'],
  'parle': ['parle-g', 'parle biscuits'],
  'amul': ['amul butter', 'amul milk'],
  'haldiram': ['haldiram\'s', 'haldiram snacks'],
  'britannia': ['britannia biscuits', 'britannia bread'],
  'thums up': ['thumbs up', 'thums up cola'],
  'limca': ['limca lemon', 'coca cola limca'],
  'frooti': ['frooti mango', 'parle frooti'],
  'maaza': ['maaza mango', 'coca cola maaza'],
}

/**
 * Generate search term variations locally (with alias expansion)
 */
function generateSearchTerms(query: string): string[] {
  const terms = [query]
  const queryLower = query.toLowerCase().trim()
  
  // Check for aliases
  const aliases = PRODUCT_ALIASES[queryLower]
  if (aliases) {
    terms.push(...aliases)
  }
  
  // Also check partial matches (e.g., "coke zero" should still expand "coke")
  for (const [alias, expansions] of Object.entries(PRODUCT_ALIASES)) {
    if (queryLower !== alias && queryLower.includes(alias)) {
      for (const exp of expansions) {
        terms.push(queryLower.replace(alias, exp))
      }
    }
  }
  
  const words = query.split(/\s+/).filter(Boolean)
  // Add individual words as separate terms if multi-word query
  if (words.length > 1) {
    terms.push(words[0]) // brand name usually comes first
    terms.push(words.slice(1).join(' ')) // product type
  }
  
  // Deduplicate
  return [...new Set(terms.map(t => t.toLowerCase()))].slice(0, 5)
}

interface OpenFoodFactsProduct {
  product: {
    product_name?: string
    product_name_en?: string
    brands?: string
    categories?: string
    categories_tags_en?: string[]
    ingredients_text?: string
    ingredients_text_en?: string
    ingredients?: Array<{
      id: string
      text: string
      vegan?: string
      vegetarian?: string
      percent_estimate?: number
    }>
    nutriscore_grade?: string
    nutrition_grades?: string
    image_url?: string
    code?: string
    nutriments?: Record<string, number>
    additives_tags?: string[]
    allergens?: string
    traces?: string
  }
  status: number
}

interface IngredientAnalysis {
  dietaryType: DietaryType
  source: IngredientSource
  pregnancySafe: SafetyLevel
  kidSafe: SafetyLevel
  healthImpact: string
  benefits?: string[]
  concerns?: string[]
  productionMethod?: string
  origin?: string
}

const UNSAFE_PREGNANCY_INGREDIENTS = [
  'monosodium glutamate', 'msg', 'artificial colors', 'artificial flavors',
  'saccharin', 'aspartame', 'caffeine', 'alcohol', 'raw egg',
  'unpasteurized', 'tartrazine', 'e102', 'e110', 'e124', 'e122'
]

const UNSAFE_KID_INGREDIENTS = [
  'caffeine', 'artificial colors', 'monosodium glutamate', 'msg',
  'aspartame', 'saccharin', 'high fructose corn syrup', 'sodium benzoate',
  'tartrazine', 'e102', 'e110', 'e124', 'e122', 'e211'
]

const NON_VEG_INDICATORS = [
  'gelatin', 'gelatine', 'carmine', 'cochineal', 'e120', 'shellac',
  'e904', 'animal fat', 'lard', 'tallow', 'fish oil', 'omega-3',
  'chicken', 'beef', 'pork', 'meat', 'egg', 'vitamin d3', 'lanolin'
]

const SYNTHETIC_ADDITIVES = [
  'e100', 'e101', 'e102', 'e110', 'e122', 'e124', 'e129', 'e133',
  'e150', 'e151', 'e200', 'e211', 'e220', 'e249', 'e250', 'e621',
  'tbhq', 'bht', 'bha', 'polysorbate', 'propylene glycol'
]

const HEALTHY_INGREDIENTS = [
  'turmeric', 'cumin', 'coriander', 'whole grain', 'oats', 'quinoa',
  'brown rice', 'lentils', 'chickpeas', 'almonds', 'walnuts',
  'olive oil', 'ghee', 'yogurt', 'milk', 'paneer', 'vegetables',
  'fruits', 'fiber', 'protein', 'vitamins', 'minerals', 'probiotics'
]

function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

function fuzzyMatch(query: string, text: string): number {
  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()
  
  // Exact match
  if (textLower === queryLower) return 200
  
  // Starts with query
  if (textLower.startsWith(queryLower)) return 150
  
  // Contains full query as substring
  if (textLower.includes(queryLower)) return 100
  
  const words = queryLower.split(/\s+/).filter(w => w.length > 0)
  let matchScore = 0
  let matchedWords = 0
  
  for (const word of words) {
    if (word.length < 2) continue
    
    // Check if word appears as substring in text
    if (textLower.includes(word)) {
      matchScore += 50 / words.length
      matchedWords++
    } else {
      // Check for prefix match (e.g., "mag" matches "maggi")
      const textWords = textLower.split(/\s+/)
      let bestWordMatch = 0
      for (const tw of textWords) {
        if (tw.startsWith(word) || word.startsWith(tw)) {
          bestWordMatch = Math.max(bestWordMatch, 40)
        } else {
          const distance = calculateLevenshteinDistance(word, tw)
          const maxLen = Math.max(word.length, tw.length)
          const similarity = Math.max(0, 1 - distance / maxLen)
          if (similarity > 0.6) {
            bestWordMatch = Math.max(bestWordMatch, similarity * 35)
          }
        }
      }
      matchScore += bestWordMatch / words.length
      if (bestWordMatch > 20) matchedWords++
    }
  }
  
  // Bonus if all query words matched
  if (matchedWords === words.length && words.length > 0) {
    matchScore += 20
  }
  
  return matchScore
}

export async function fetchProductByBarcode(barcode: string): Promise<ProductAnalysis> {
  const urls: string[] = []
  if (IS_DEV) {
    urls.push(`${OPEN_FOOD_FACTS_API}/product/${barcode}?lc=en&fields=${SEARCH_FIELDS}`)
  }
  urls.push(`${OPEN_FOOD_FACTS_DIRECT}/api/v2/product/${barcode}?lc=en&fields=${SEARCH_FIELDS}`)
  
  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      
      if (!response.ok) continue
      
      const data: OpenFoodFactsProduct = await response.json()
      
      if (data.status !== 1 || !data.product) continue
      
      return parseOpenFoodFactsProduct(data)
    } catch {
      // Try next URL
    }
  }
  
  throw new Error('Product not found. Please check the barcode and try again.')
}

export async function searchProductsByName(query: string): Promise<ProductAnalysis[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    const searchQuery = query.trim()
    
    // Use AI to understand natural language and fix typos if available
    let searchTerms: string[]
    if (isAIEnabled()) {
      try {
        const aiResult = await smartSearchQuery(searchQuery)
        searchTerms = [aiResult.correctedQuery, ...aiResult.searchTerms]
        // Deduplicate
        searchTerms = [...new Set(searchTerms.map(t => t.toLowerCase()))]
      } catch {
        searchTerms = generateSearchTerms(searchQuery)
      }
    } else {
      searchTerms = generateSearchTerms(searchQuery)
    }
    
    const allResults = new Map<string, ProductAnalysis>()
    
    for (const term of searchTerms.slice(0, 3)) {
      const data = await searchOpenFoodFacts(term, SEARCH_FIELDS, 50)
      const results = parseSearchResults(data)
      
      results.forEach(product => {
        if (!allResults.has(product.id)) {
          allResults.set(product.id, product)
        }
      })
    }
    
    const results = Array.from(allResults.values())
      // Filter: English product names only
      .filter(product => isEnglishName(product.productName))
    
    const scoredResults = results.map(product => {
      const productText = `${product.productName} ${product.brand || ''} ${product.category || ''}`
      const nameScore = fuzzyMatch(searchQuery, product.productName) * 2
      const brandScore = product.brand ? fuzzyMatch(searchQuery, product.brand) * 1.5 : 0
      const fullScore = fuzzyMatch(searchQuery, productText)
      
      return {
        product,
        score: Math.max(nameScore, brandScore, fullScore)
      }
    })
    
    scoredResults.sort((a, b: any) => b.score - a.score)
    
    // Dedup: one item per brand + product + flavour (strip sizes/packaging)
    const seenKeys = new Set<string>()
    return scoredResults
      .filter(r => r.score > 10)
      .filter(r => {
        const key = normalizeProductKey(r.product.productName, r.product.brand || '')
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })
      .slice(0, 30)
      .map((r: any) => r.product)
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

export async function getSearchSuggestions(query: string): Promise<{ product: string; brand: string }[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    // Search with alias expansion for better results
    const searchTerms = generateSearchTerms(query.trim()).slice(0, 3)
    const seen = new Set<string>()
    const results: { product: string; brand: string }[] = []
    
    // Search all terms in parallel for speed
    const promises = searchTerms.map(term => 
      searchOpenFoodFacts(term, SUGGEST_FIELDS, 10).catch(() => ({ products: [] }))
    )
    const allData = await Promise.all(promises)
    
    for (const data of allData) {
      if (data.products && Array.isArray(data.products)) {
        for (const p of data.products) {
          // Prefer English name; skip if neither name is English
          const nameEn = p.product_name_en?.trim()
          const nameRaw = p.product_name?.trim()
          const name = (nameEn && isEnglishName(nameEn)) ? nameEn : (nameRaw && isEnglishName(nameRaw)) ? nameRaw : null
          if (!name) continue
          const brand = p.brands?.split(',')[0]?.trim() || ''
          // Also reject brands with non-Latin scripts
          if (/[\u0400-\u04FF\u0600-\u06FF\u3000-\u9FFF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F\u0590-\u05FF]/.test(brand)) continue
          // Dedup: one item per brand + product + flavour (strip sizes/packaging)
          const dedupKey = normalizeProductKey(name, brand)
          if (seen.has(dedupKey)) continue
          seen.add(dedupKey)
          results.push({ product: name, brand })
        }
      }
    }
    
    // Sort by fuzzy relevance to the original query
    const queryLower = query.toLowerCase()
    return results
      .sort((a, b) => {
        const aScore = fuzzyMatch(queryLower, a.product) + (a.brand ? fuzzyMatch(queryLower, a.brand) * 0.5 : 0)
        const bScore = fuzzyMatch(queryLower, b.product) + (b.brand ? fuzzyMatch(queryLower, b.brand) * 0.5 : 0)
        return bScore - aScore
      })
      .slice(0, 8)
  } catch (error) {
    return []
  }
}

function parseSearchResults(data: any): ProductAnalysis[] {
  if (!data.products || !Array.isArray(data.products)) {
    return []
  }
  
  return data.products
    .filter((p: any) => p.product_name && p.code)
    .map((product: any) => {
      try {
        return parseOpenFoodFactsProduct({ product, status: 1 })
      } catch {
        return null
      }
    })
    .filter((p: ProductAnalysis | null): p is ProductAnalysis => p !== null)
}

/**
 * Pick the best English category from categories_tags_en, avoiding French/dashed slugs
 */
function getBestCategory(tagsEn?: string[], rawCategories?: string): string | undefined {
  if (tagsEn && tagsEn.length > 0) {
    // Filter out entries with language prefixes like "pt:" "fr:" etc.
    const cleaned = tagsEn
      .filter(t => !t.match(/^[a-z]{2}:/))
      .map(t => t.trim())
      .filter(Boolean)
    
    // Prefer entries that look like proper English (contain spaces, no hyphens between words)
    const properEnglish = cleaned.filter(t => t.includes(' ') && !t.match(/^[a-z]+-[a-z]+-/i))
    
    if (properEnglish.length > 0) {
      // Pick the most specific (last) proper English category
      return properEnglish[properEnglish.length - 1]
    }
    
    // If all are dashed slugs, convert the most specific one to readable form
    if (cleaned.length > 0) {
      const best = cleaned[cleaned.length - 1]
      return best
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
    }
  }
  
  // Fallback to raw categories field
  if (rawCategories) {
    const parts = rawCategories.split(',').map(s => s.trim()).filter(Boolean)
    // Try to find an English-looking one (no accented characters)
    const english = parts.find(p => !/[àâéèêëïîôùûüÿçæœ]/i.test(p))
    return english || parts[0]
  }
  
  return undefined
}

function parseOpenFoodFactsProduct(data: OpenFoodFactsProduct): ProductAnalysis {
  const product = data.product
  
  if (!product.product_name) {
    throw new Error('Invalid product data')
  }
  
  const ingredientsText = product.ingredients_text_en || product.ingredients_text || ''
  const ingredients = analyzeIngredients(ingredientsText, product.ingredients || [])
  
  const score = calculateProductScore(ingredients, product)
  const dietaryType = determineDietaryType(ingredients, product)
  const warnings = generateWarnings(ingredients, product)
  const benefits = generateBenefits(ingredients, product)
  
  return {
    id: product.code || Date.now().toString(),
    productName: product.product_name_en || product.product_name,
    barcode: product.code,
    brand: product.brands,
    category: getBestCategory(product.categories_tags_en, product.categories),
    overallScore: score,
    ingredients,
    dietaryType,
    warnings,
    benefits,
    timestamp: Date.now(),
    imageUrl: product.image_url
  }
}

function analyzeIngredients(
  ingredientsText: string,
  ingredientsList: any[]
): Ingredient[] {
  const ingredients: Ingredient[] = []
  
  const textIngredients = ingredientsText
    .split(/[,;]/)
    .map(i => i.trim())
    .filter(i => i.length > 0)
  
  for (const ingredientText of textIngredients) {
    const analysis = analyzeIngredient(ingredientText)
    ingredients.push({
      name: ingredientText.charAt(0).toUpperCase() + ingredientText.slice(1),
      ...analysis
    })
  }
  
  if (ingredients.length === 0 && ingredientsList.length > 0) {
    for (const ing of ingredientsList) {
      const text = ing.text || ing.id || ''
      if (text) {
        const analysis = analyzeIngredient(text)
        ingredients.push({
          name: text.charAt(0).toUpperCase() + text.slice(1),
          ...analysis
        })
      }
    }
  }
  
  return ingredients
}

function analyzeIngredient(ingredientText: string): IngredientAnalysis {
  const lower = ingredientText.toLowerCase()
  
  const isNonVeg = NON_VEG_INDICATORS.some(indicator => lower.includes(indicator))
  const isSynthetic = SYNTHETIC_ADDITIVES.some(additive => lower.includes(additive))
  const isHealthy = HEALTHY_INGREDIENTS.some(healthy => lower.includes(healthy))
  const isUnsafePregnancy = UNSAFE_PREGNANCY_INGREDIENTS.some(unsafe => lower.includes(unsafe))
  const isUnsafeKids = UNSAFE_KID_INGREDIENTS.some(unsafe => lower.includes(unsafe))
  
  let dietaryType: DietaryType = 'veg'
  if (isNonVeg) dietaryType = 'non-veg'
  
  let source: IngredientSource = 'natural'
  if (isSynthetic || lower.match(/e\d{3}/)) source = 'synthetic'
  else if (lower.includes('processed') || lower.includes('refined')) source = 'processed'
  
  let pregnancySafe: SafetyLevel = 'safe'
  if (isUnsafePregnancy) pregnancySafe = 'avoid'
  else if (isSynthetic || lower.includes('artificial')) pregnancySafe = 'caution'
  
  let kidSafe: SafetyLevel = 'safe'
  if (isUnsafeKids) kidSafe = 'avoid'
  else if (isSynthetic || lower.includes('artificial')) kidSafe = 'caution'
  
  const benefits: string[] = []
  const concerns: string[] = []
  let productionMethod = ''
  let origin = ''
  
  if (isHealthy) {
    benefits.push('Natural and nutritious')
  }
  
  if (lower.includes('whole grain')) benefits.push('High in fiber')
  if (lower.includes('protein')) benefits.push('Protein source')
  if (lower.includes('vitamin')) benefits.push('Added vitamins')
  if (lower.includes('probiotic')) benefits.push('Gut health')
  if (lower.includes('organic')) benefits.push('Organically sourced')
  
  if (isSynthetic) concerns.push('Synthetic additive')
  if (lower.includes('artificial')) concerns.push('Artificial ingredient')
  if (lower.includes('palm oil')) concerns.push('High in saturated fat')
  if (lower.includes('sugar') || lower.includes('syrup')) concerns.push('Added sweetener')
  if (lower.includes('sodium') || lower.includes('salt')) concerns.push('High sodium')
  if (isNonVeg) concerns.push('Contains animal-derived ingredients')
  
  if (lower.includes('palm oil')) {
    productionMethod = 'Extracted from palm fruit through mechanical pressing and refining'
    origin = 'Tropical regions (Malaysia, Indonesia)'
  } else if (lower.includes('sugar') || lower.includes('sucrose')) {
    productionMethod = 'Extracted from sugarcane or beet through crushing, crystallization'
    origin = 'Sugarcane: Tropical regions; Beet: Temperate regions'
  } else if (lower.includes('salt') || lower.includes('sodium chloride')) {
    productionMethod = 'Mined from deposits or evaporated from seawater'
    origin = 'Worldwide - sea salt or rock salt mines'
  } else if (lower.includes('flour') || lower.includes('wheat')) {
    productionMethod = 'Milled from wheat grains'
    origin = 'Cultivated globally in temperate regions'
  } else if (isSynthetic) {
    productionMethod = 'Chemically synthesized in laboratories'
    origin = 'Industrial manufacturing facilities'
  } else if (lower.includes('spice') || lower.includes('turmeric') || lower.includes('cumin')) {
    productionMethod = 'Dried and ground from plant parts'
    origin = 'India, Middle East, Asia'
  }
  
  let healthImpact = 'Standard ingredient'
  if (isHealthy) healthImpact = 'Beneficial nutritious ingredient'
  else if (isSynthetic) healthImpact = 'Synthetic additive - limit consumption'
  else if (isUnsafePregnancy || isUnsafeKids) healthImpact = 'Contains ingredients requiring caution'
  
  return {
    dietaryType,
    source,
    pregnancySafe,
    kidSafe,
    healthImpact,
    benefits: benefits.length > 0 ? benefits : undefined,
    concerns: concerns.length > 0 ? concerns : undefined,
    productionMethod: productionMethod || undefined,
    origin: origin || undefined
  }
}

function calculateProductScore(ingredients: Ingredient[], product: any): number {
  // Start with a base score
  let score = 50
  let totalFactors = 0
  
  // ===== 1. Nutri-Score (most reliable signal, heavily weighted) =====
  if (product.nutriscore_grade) {
    const gradeScores: Record<string, number> = { a: 90, b: 75, c: 55, d: 35, e: 15 }
    const nutriScore = gradeScores[product.nutriscore_grade.toLowerCase()]
    if (nutriScore !== undefined) {
      // Nutri-Score is the anchor - weight it at 40%
      score = nutriScore * 0.4
      totalFactors += 0.4
    }
  }
  
  // ===== 2. Nutrient analysis (weighted 30%) =====
  if (product.nutriments) {
    let nutrientScore = 70 // default neutral
    let nutrientPenalties = 0
    let nutrientBonuses = 0
    
    // Sodium analysis
    const sodiumFromSalt = product.nutriments.salt_100g ? product.nutriments.salt_100g / 2.5 : 0
    const sodiumDirect = product.nutriments.sodium_100g || 0
    const sodium = Math.max(sodiumFromSalt, sodiumDirect)
    if (sodium > 1.5) nutrientPenalties += 15
    else if (sodium > 1.0) nutrientPenalties += 10
    else if (sodium > 0.6) nutrientPenalties += 5
    
    // Sugar analysis
    const sugars = product.nutriments.sugars_100g
    if (sugars !== undefined) {
      if (sugars > 22.5) nutrientPenalties += 15
      else if (sugars > 15) nutrientPenalties += 10
      else if (sugars > 10) nutrientPenalties += 5
      else if (sugars < 5) nutrientBonuses += 5
    }
    
    // Saturated fat
    const saturatedFat = product.nutriments['saturated-fat_100g']
    if (saturatedFat !== undefined) {
      if (saturatedFat > 5) nutrientPenalties += 12
      else if (saturatedFat > 3) nutrientPenalties += 7
      else if (saturatedFat < 1.5) nutrientBonuses += 5
    }
    
    // Fiber bonus
    const fiber = product.nutriments.fiber_100g
    if (fiber !== undefined && fiber > 3) {
      nutrientBonuses += 8
    }
    
    // Protein bonus
    const protein = product.nutriments.proteins_100g
    if (protein !== undefined && protein > 5) {
      nutrientBonuses += 5
    }
    
    nutrientScore = Math.max(0, Math.min(100, nutrientScore - nutrientPenalties + nutrientBonuses))
    score += nutrientScore * 0.3
    totalFactors += 0.3
  }
  
  // ===== 3. Ingredient quality analysis (weighted 20%) =====
  if (ingredients.length > 0) {
    let ingredientScore = 70
    
    const syntheticCount = ingredients.filter(i => i.source === 'synthetic').length
    const naturalCount = ingredients.filter(i => i.source === 'natural').length
    const processedCount = ingredients.filter(i => i.source === 'processed').length
    const totalCount = ingredients.length
    
    // Natural ratio bonus/penalty
    const naturalRatio = naturalCount / totalCount
    if (naturalRatio > 0.8) ingredientScore += 15
    else if (naturalRatio > 0.6) ingredientScore += 8
    else if (naturalRatio < 0.3) ingredientScore -= 10
    
    // Synthetic additives penalty (capped)
    ingredientScore -= Math.min(syntheticCount * 5, 20)
    
    // Processed ingredient penalty (minor)
    ingredientScore -= Math.min(processedCount * 2, 10)
    
    // Concerns vs benefits balance
    const totalConcerns = ingredients.reduce((sum, i) => sum + (i.concerns?.length || 0), 0)
    const totalBenefits = ingredients.reduce((sum, i) => sum + (i.benefits?.length || 0), 0)
    ingredientScore += Math.min(totalBenefits * 2, 10)
    ingredientScore -= Math.min(totalConcerns * 2, 15)
    
    ingredientScore = Math.max(0, Math.min(100, ingredientScore))
    score += ingredientScore * 0.2
    totalFactors += 0.2
  }
  
  // ===== 4. Additives analysis (weighted 10%) =====
  let additivesScore = 80
  if (product.additives_tags && product.additives_tags.length > 0) {
    const numAdditives = product.additives_tags.length
    if (numAdditives > 8) additivesScore = 20
    else if (numAdditives > 5) additivesScore = 35
    else if (numAdditives > 3) additivesScore = 50
    else if (numAdditives > 1) additivesScore = 65
  }
  score += additivesScore * 0.1
  totalFactors += 0.1
  
  // Normalize if we didn't use all factors
  if (totalFactors > 0 && totalFactors < 1) {
    score = score / totalFactors
  }
  
  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Generate a human-readable explanation of why the product got its score
 */
export function generateScoreSummary(analysis: ProductAnalysis, product?: any): string[] {
  const reasons: string[] = []
  const score = analysis.overallScore

  // Score label
  if (score >= 80) reasons.push('Excellent overall health profile')
  else if (score >= 60) reasons.push('Good health profile with some concerns')
  else if (score >= 40) reasons.push('Fair health profile — moderate concerns')
  else if (score >= 20) reasons.push('Poor health profile — significant concerns')
  else reasons.push('Very poor health profile — many health concerns')

  // Ingredient-based reasons
  const naturalCount = analysis.ingredients.filter(i => i.source === 'natural').length
  const syntheticCount = analysis.ingredients.filter(i => i.source === 'synthetic').length
  const total = analysis.ingredients.length

  if (total > 0) {
    const naturalPct = Math.round((naturalCount / total) * 100)
    if (naturalPct > 80) reasons.push(`${naturalPct}% natural ingredients — very clean formula`)
    else if (naturalPct > 60) reasons.push(`${naturalPct}% natural ingredients — mostly clean`)
    else if (naturalPct < 40) reasons.push(`Only ${naturalPct}% natural ingredients — heavily processed`)
    
    if (syntheticCount > 3) reasons.push(`Contains ${syntheticCount} synthetic additives`)
    else if (syntheticCount > 0) reasons.push(`Contains ${syntheticCount} synthetic additive(s)`)
  }

  // Warning-based reasons
  for (const w of analysis.warnings.slice(0, 3)) {
    if (w.toLowerCase().includes('sugar')) reasons.push('High sugar content lowers the score')
    else if (w.toLowerCase().includes('saturated fat')) reasons.push('High saturated fat reduces the score')
    else if (w.toLowerCase().includes('sodium') || w.toLowerCase().includes('salt')) reasons.push('High sodium/salt content is a concern')
    else if (w.toLowerCase().includes('allergen')) reasons.push('Contains common allergens')
  }

  // Benefits
  if (analysis.benefits.length > 0) {
    reasons.push(`${analysis.benefits.length} positive health factor(s) boost the score`)
  }

  return reasons
}

function determineDietaryType(ingredients: Ingredient[], product: any): DietaryType {
  const hasNonVeg = ingredients.some(i => i.dietaryType === 'non-veg')
  
  if (hasNonVeg) return 'non-veg'
  
  const productText = [
    product.ingredients_text || '',
    product.product_name || '',
    product.categories || ''
  ].join(' ').toLowerCase()
  
  if (NON_VEG_INDICATORS.some(indicator => productText.includes(indicator))) {
    return 'non-veg'
  }
  
  return 'veg'
}

function generateWarnings(ingredients: Ingredient[], product: any): string[] {
  const warnings: string[] = []
  
  if (product.nutriments) {
    const sodium = product.nutriments.sodium_100g || (product.nutriments.salt_100g ? product.nutriments.salt_100g / 2.5 : 0)
    if (sodium > 1.5) {
      warnings.push(`Very high sodium content (${sodium.toFixed(2)}g per 100g) - exceeds recommended daily intake`)
    } else if (sodium > 1.0) {
      warnings.push(`High sodium content (${sodium.toFixed(2)}g per 100g) - limit consumption`)
    } else if (sodium > 0.6) {
      warnings.push(`Moderate sodium content (${sodium.toFixed(2)}g per 100g)`)
    }
    
    const sugars = product.nutriments.sugars_100g
    if (sugars > 22.5) {
      warnings.push(`Very high sugar content (${sugars.toFixed(1)}g per 100g)`)
    } else if (sugars > 15) {
      warnings.push(`High sugar content (${sugars.toFixed(1)}g per 100g)`)
    }
    
    const saturatedFat = product.nutriments['saturated-fat_100g']
    if (saturatedFat > 5) {
      warnings.push(`High saturated fat (${saturatedFat.toFixed(1)}g per 100g)`)
    }
  }
  
  const pregnancyUnsafe = ingredients.filter(i => i.pregnancySafe === 'avoid')
  if (pregnancyUnsafe.length > 0) {
    warnings.push(`Not safe during pregnancy: ${pregnancyUnsafe.map(i => i.name).join(', ')}`)
  }
  
  const kidUnsafe = ingredients.filter(i => i.kidSafe === 'avoid')
  if (kidUnsafe.length > 0) {
    warnings.push(`Not recommended for children: ${kidUnsafe.map(i => i.name).join(', ')}`)
  }
  
  const synthetic = ingredients.filter(i => i.source === 'synthetic')
  if (synthetic.length > 0) {
    warnings.push(`Contains ${synthetic.length} synthetic additive(s)`)
  }
  
  if (product.additives_tags && product.additives_tags.length > 3) {
    warnings.push(`Contains ${product.additives_tags.length} food additives`)
  }
  
  if (product.allergens) {
    warnings.push(`Allergen warning: ${product.allergens}`)
  }
  
  const allConcerns = ingredients
    .flatMap(i => i.concerns || [])
    .filter((c, i, arr) => arr.indexOf(c) === i)
  
  warnings.push(...allConcerns.slice(0, 2))
  
  return warnings.slice(0, 8)
}

function generateBenefits(ingredients: Ingredient[], product: any): string[] {
  const benefits: string[] = []
  
  const allBenefits = ingredients
    .flatMap(i => i.benefits || [])
    .filter((b, i, arr) => arr.indexOf(b) === i)
  
  benefits.push(...allBenefits)
  
  const naturalCount = ingredients.filter(i => i.source === 'natural').length
  const totalCount = ingredients.length
  
  if (totalCount > 0 && naturalCount / totalCount > 0.7) {
    benefits.push('Mostly natural ingredients')
  }
  
  if (product.nutriscore_grade && ['a', 'b'].includes(product.nutriscore_grade.toLowerCase())) {
    benefits.push('Good nutritional score')
  }
  
  return benefits
}

export async function getAlternatives(productAnalysis: ProductAnalysis): Promise<Alternative[]> {
  if (!productAnalysis.category) {
    return []
  }
  
  try {
    const category = productAnalysis.category.split(',')[0].trim()
    
    const data = await searchOpenFoodFacts(category, SEARCH_FIELDS, 30)
    const alternatives: Alternative[] = []
    
    if (data.products && Array.isArray(data.products)) {
      const parsedProducts = data.products
        .filter((p: any) => 
          p.product_name && 
          p.code !== productAnalysis.barcode &&
          p.product_name !== productAnalysis.productName &&
          isEnglishName(p.product_name_en || p.product_name)
        )
        .map((product: any) => {
          try {
            return parseOpenFoodFactsProduct({ product, status: 1 })
          } catch {
            return null
          }
        })
        .filter((p: any): p is ProductAnalysis => p !== null)
      
      // Dedup: one item per brand + product + flavour
      const seenKeys = new Set<string>()
      const dedupedProducts = parsedProducts.filter((p: ProductAnalysis) => {
        const key = normalizeProductKey(p.productName, p.brand || '')
        if (seenKeys.has(key)) return false
        seenKeys.add(key)
        return true
      })
      
      // For low-score products, show better alternatives
      // For high-score products, show similar good products
      let selectedProducts: ProductAnalysis[]
      if (productAnalysis.overallScore < 70) {
        selectedProducts = dedupedProducts
          .filter((p: ProductAnalysis) => p.overallScore > productAnalysis.overallScore)
          .sort((a: ProductAnalysis, b: ProductAnalysis) => b.overallScore - a.overallScore)
          .slice(0, 5)
      } else {
        selectedProducts = dedupedProducts
          .filter((p: ProductAnalysis) => p.overallScore >= 60)
          .sort((a: ProductAnalysis, b: ProductAnalysis) => b.overallScore - a.overallScore)
          .slice(0, 5)
      }
      
      for (const alt of selectedProducts) {
        const benefits = alt.benefits.slice(0, 3)
        const scoreDiff = alt.overallScore - productAnalysis.overallScore
        
        alternatives.push({
          productName: alt.productName,
          brand: alt.brand || 'Unknown',
          score: alt.overallScore,
          priceComparison: 'similar',
          keyBenefits: benefits.length > 0 ? benefits : [scoreDiff > 0 ? 'Better ingredient profile' : 'Good ingredient profile'],
          availability: 'Check local stores',
          imageUrl: alt.imageUrl
        })
      }
    }
    
    return alternatives
  } catch (error) {
    console.error('Failed to fetch alternatives:', error)
    return []
  }
}

export async function analyzeIngredientImage(_imageData: string): Promise<string> {
  // Without AI, image analysis is not available locally
  throw new Error('Image ingredient analysis requires an AI service. Please enter ingredients manually.')
}

export async function analyzeIngredientsWithAI(ingredientsText: string): Promise<Ingredient[]> {
  // Parse ingredients locally without AI
  const ingredientNames = ingredientsText
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)

  return ingredientNames.map(name => ({
    name,
    dietaryType: 'veg' as DietaryType,
    source: classifyIngredientSource(name),
    pregnancySafe: 'caution' as SafetyLevel,
    kidSafe: 'safe' as SafetyLevel,
    healthImpact: '',
    benefits: [],
    concerns: []
  }))
}

function classifyIngredientSource(name: string): IngredientSource {
  const synthetic = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e9', 'artificial', 'color', 'colour', 'flavor', 'flavour', 'preservative', 'aspartame', 'sucralose', 'acesulfame', 'bht', 'bha', 'tbhq', 'msg', 'sodium benzoate', 'potassium sorbate']
  const processed = ['refined', 'hydrogenated', 'modified', 'maltodextrin', 'corn syrup', 'high fructose', 'palm oil', 'soy lecithin', 'mono and diglycerides', 'carrageenan']
  const lower = name.toLowerCase()
  if (synthetic.some(s => lower.includes(s))) return 'synthetic'
  if (processed.some(p => lower.includes(p))) return 'processed'
  return 'natural'
}
