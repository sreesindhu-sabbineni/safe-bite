import type { ProductAnalysis, Ingredient, DietaryType, IngredientSource, SafetyLevel, Alternative } from './types'

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2'

interface OpenFoodFactsProduct {
  product: {
    product_name?: string
    brands?: string
    categories?: string
    ingredients_text?: string
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
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_API}/product/${barcode}.json`)
    
    if (!response.ok) {
      throw new Error('Product not found')
    }
    
    const data: OpenFoodFactsProduct = await response.json()
    
    if (data.status !== 1 || !data.product) {
      throw new Error('Product not found')
    }
    
    return parseOpenFoodFactsProduct(data)
  } catch (error) {
    throw new Error('Failed to fetch product from API')
  }
}

export async function searchProductsByName(query: string): Promise<ProductAnalysis[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    const searchQuery = query.trim()
    
    const promptText = `You are a food product search assistant. Given the user's search query, generate 3-5 optimal search terms that would help find relevant food products in a database. Consider brand names, product types, and common variations.

User query: "${searchQuery}"

Return a JSON object with a "terms" property containing an array of search terms. Example: {"terms": ["maggi noodles", "maggi", "instant noodles"]}`
    
    const aiPrompt = window.spark.llmPrompt([promptText] as any, searchQuery)
    
    let searchTerms = [searchQuery]
    try {
      const aiResult = await window.spark.llm(aiPrompt, 'gpt-4o', true)
      const parsed = JSON.parse(aiResult)
      if (parsed.terms && Array.isArray(parsed.terms)) {
        searchTerms = parsed.terms
      }
    } catch (e) {
      console.log('Using original search term')
    }
    
    const allResults = new Map<string, ProductAnalysis>()
    
    for (const term of searchTerms.slice(0, 3)) {
      const encodedQuery = encodeURIComponent(term)
      
      const response = await fetch(
        `${OPEN_FOOD_FACTS_API}/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&page_size=50&json=true&fields=code,product_name,brands,categories,ingredients_text,ingredients,nutriscore_grade,image_url,nutriments,additives_tags,allergens`
      )
      
      if (!response.ok) {
        continue
      }
      
      const data = await response.json()
      const results = parseSearchResults(data)
      
      results.forEach(product => {
        if (!allResults.has(product.id)) {
          allResults.set(product.id, product)
        }
      })
    }
    
    const results = Array.from(allResults.values())
    
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
    
    return scoredResults
      .filter(r => r.score > 10)
      .slice(0, 30)
      .map((r: any) => r.product)
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim())
    
    // Use the search API with small page size for fast autocomplete
    const response = await fetch(
      `${OPEN_FOOD_FACTS_API}/cgi/search.pl?search_terms=${encodedQuery}&search_simple=1&action=process&page_size=8&json=true&fields=product_name,brands`
    )
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const suggestions = new Set<string>()
    
    if (data.products && Array.isArray(data.products)) {
      for (const product of data.products) {
        if (product.product_name) {
          suggestions.add(product.product_name)
        }
        if (product.brands && product.product_name) {
          suggestions.add(`${product.brands} - ${product.product_name}`)
        }
      }
    }
    
    // Sort by fuzzy relevance
    const queryLower = query.toLowerCase()
    return Array.from(suggestions)
      .sort((a, b) => {
        const aScore = fuzzyMatch(queryLower, a)
        const bScore = fuzzyMatch(queryLower, b)
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

function parseOpenFoodFactsProduct(data: OpenFoodFactsProduct): ProductAnalysis {
  const product = data.product
  
  if (!product.product_name) {
    throw new Error('Invalid product data')
  }
  
  const ingredientsText = product.ingredients_text || ''
  const ingredients = analyzeIngredients(ingredientsText, product.ingredients || [])
  
  const score = calculateProductScore(ingredients, product)
  const dietaryType = determineDietaryType(ingredients, product)
  const warnings = generateWarnings(ingredients, product)
  const benefits = generateBenefits(ingredients, product)
  
  return {
    id: product.code || Date.now().toString(),
    productName: product.product_name,
    barcode: product.code,
    brand: product.brands,
    category: product.categories?.split(',')[0]?.trim(),
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
    const encodedCategory = encodeURIComponent(category)
    
    const response = await fetch(
      `${OPEN_FOOD_FACTS_API}/category/${encodedCategory}.json?page_size=30`
    )
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const alternatives: Alternative[] = []
    
    if (data.products && Array.isArray(data.products)) {
      const parsedProducts = data.products
        .filter((p: any) => 
          p.product_name && 
          p.code !== productAnalysis.barcode &&
          p.product_name !== productAnalysis.productName
        )
        .map((product: any) => {
          try {
            return parseOpenFoodFactsProduct({ product, status: 1 })
          } catch {
            return null
          }
        })
        .filter((p: any): p is ProductAnalysis => p !== null)
      
      // For low-score products, show better alternatives
      // For high-score products, show similar good products
      let selectedProducts: ProductAnalysis[]
      if (productAnalysis.overallScore < 70) {
        selectedProducts = parsedProducts
          .filter((p: ProductAnalysis) => p.overallScore > productAnalysis.overallScore)
          .sort((a: ProductAnalysis, b: ProductAnalysis) => b.overallScore - a.overallScore)
          .slice(0, 5)
      } else {
        selectedProducts = parsedProducts
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

export async function analyzeIngredientImage(imageData: string): Promise<string> {
  const promptText = `You are an expert at reading food ingredient labels from images. 
  
Extract the complete ingredients list from this image. Return ONLY the comma-separated list of ingredients, nothing else.

If you cannot read the ingredients clearly, return "UNREADABLE".

Image: ${imageData}`
  
  const prompt = window.spark.llmPrompt([promptText] as any)

  try {
    const result = await window.spark.llm(prompt, 'gpt-4o')
    return result.trim()
  } catch (error) {
    throw new Error('Failed to analyze ingredient image')
  }
}

export async function analyzeIngredientsWithAI(ingredientsText: string): Promise<Ingredient[]> {
  const promptText = `Analyze the following food ingredients list and provide detailed safety and nutritional information for each ingredient.

Ingredients: ${ingredientsText}

For each ingredient, determine:
1. Is it vegetarian, non-vegetarian, or vegan?
2. Is it natural, processed, or synthetic?
3. Is it safe during pregnancy (safe/caution/avoid)?
4. Is it safe for children (safe/caution/avoid)?
5. Health benefits (if any)
6. Health concerns (if any)
7. Overall health impact summary

Return the result as a valid JSON object with a single property "ingredients" containing an array of ingredient objects.`

  const prompt = window.spark.llmPrompt([promptText] as any)

  try {
    const result = await window.spark.llm(prompt, 'gpt-4o', true)
    const parsed = JSON.parse(result)
    
    if (parsed.ingredients && Array.isArray(parsed.ingredients)) {
      return parsed.ingredients.map((ing: any) => ({
        name: ing.name || 'Unknown',
        dietaryType: ing.dietaryType || 'veg',
        source: ing.source || 'natural',
        pregnancySafe: ing.pregnancySafe || 'caution',
        kidSafe: ing.kidSafe || 'caution',
        healthImpact: ing.healthImpact || 'Unknown',
        benefits: ing.benefits || [],
        concerns: ing.concerns || []
      }))
    }
    
    return []
  } catch (error) {
    console.error('AI analysis failed:', error)
    return []
  }
}
