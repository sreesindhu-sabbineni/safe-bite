import type { Ingredient, ProductAnalysis, Alternative, DietaryType, UserPreferences } from './types'

const INGREDIENT_DATABASE: Record<string, Ingredient> = {
  'wheat flour': {
    name: 'Wheat Flour',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'safe',
    kidSafe: 'safe',
    healthImpact: 'Good source of carbohydrates and fiber',
    benefits: ['Energy source', 'Contains B vitamins', 'Dietary fiber'],
    concerns: ['Contains gluten', 'May cause allergies in sensitive individuals'],
    commonUses: ['Bread', 'Chapati', 'Baked goods']
  },
  'sugar': {
    name: 'Sugar',
    dietaryType: 'veg',
    source: 'processed',
    pregnancySafe: 'caution',
    kidSafe: 'caution',
    healthImpact: 'High glycemic index, limit consumption',
    benefits: ['Quick energy source'],
    concerns: ['Tooth decay', 'Weight gain', 'Diabetes risk', 'Empty calories'],
    commonUses: ['Sweetener in beverages', 'Baked goods', 'Confectionery']
  },
  'palm oil': {
    name: 'Palm Oil',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'caution',
    kidSafe: 'caution',
    healthImpact: 'High in saturated fats',
    benefits: ['Vitamin E', 'Shelf stable'],
    concerns: ['High saturated fat', 'Cardiovascular concerns', 'Environmental impact'],
    commonUses: ['Cooking oil', 'Processed foods', 'Baked goods']
  },
  'gelatin': {
    name: 'Gelatin',
    dietaryType: 'non-veg',
    source: 'natural',
    pregnancySafe: 'safe',
    kidSafe: 'safe',
    healthImpact: 'Animal-derived protein',
    benefits: ['Protein source', 'Joint health'],
    concerns: ['Not suitable for vegetarians/vegans', 'May contain animal traces'],
    commonUses: ['Gelling agent', 'Capsules', 'Desserts']
  },
  'carrageenan': {
    name: 'Carrageenan',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'caution',
    kidSafe: 'avoid',
    healthImpact: 'Controversial food additive',
    benefits: ['Vegetarian gelling agent'],
    concerns: ['May cause digestive inflammation', 'Linked to gut issues'],
    commonUses: ['Thickener', 'Dairy alternatives', 'Processed meats']
  },
  'turmeric': {
    name: 'Turmeric',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'safe',
    kidSafe: 'safe',
    healthImpact: 'Highly beneficial anti-inflammatory spice',
    benefits: ['Anti-inflammatory', 'Antioxidant', 'Traditional medicine', 'Curcumin content'],
    concerns: ['May interfere with blood thinners in high doses'],
    commonUses: ['Spice', 'Coloring', 'Traditional remedies']
  },
  'monosodium glutamate': {
    name: 'Monosodium Glutamate (MSG)',
    dietaryType: 'veg',
    source: 'synthetic',
    pregnancySafe: 'avoid',
    kidSafe: 'avoid',
    healthImpact: 'Flavor enhancer with health concerns',
    benefits: ['Enhances umami flavor'],
    concerns: ['Headaches', 'Allergic reactions', 'Chinese Restaurant Syndrome'],
    commonUses: ['Flavor enhancer', 'Instant noodles', 'Snacks']
  },
  'vitamin d3': {
    name: 'Vitamin D3',
    dietaryType: 'non-veg',
    source: 'processed',
    pregnancySafe: 'safe',
    kidSafe: 'safe',
    healthImpact: 'Essential vitamin, often animal-derived',
    benefits: ['Bone health', 'Immune support', 'Calcium absorption'],
    concerns: ['Often derived from sheep wool lanolin'],
    commonUses: ['Fortification', 'Supplements']
  },
  'artificial colors': {
    name: 'Artificial Colors',
    dietaryType: 'veg',
    source: 'synthetic',
    pregnancySafe: 'avoid',
    kidSafe: 'avoid',
    healthImpact: 'Synthetic dyes with potential health risks',
    benefits: ['Enhances visual appeal'],
    concerns: ['Hyperactivity in children', 'Allergic reactions', 'Carcinogenic potential'],
    commonUses: ['Candies', 'Beverages', 'Processed foods']
  },
  'whole grain oats': {
    name: 'Whole Grain Oats',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'safe',
    kidSafe: 'safe',
    healthImpact: 'Highly nutritious whole grain',
    benefits: ['High fiber', 'Heart health', 'Cholesterol reduction', 'Sustained energy'],
    concerns: ['May contain gluten from cross-contamination'],
    commonUses: ['Breakfast cereals', 'Porridge', 'Baked goods']
  },
  'salt': {
    name: 'Salt',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'caution',
    kidSafe: 'caution',
    healthImpact: 'Essential mineral, limit intake',
    benefits: ['Essential electrolyte', 'Food preservation'],
    concerns: ['High blood pressure', 'Water retention', 'Cardiovascular risks'],
    commonUses: ['Seasoning', 'Preservation', 'All cuisines']
  },
  'ghee': {
    name: 'Ghee',
    dietaryType: 'veg',
    source: 'natural',
    pregnancySafe: 'safe',
    kidSafe: 'safe',
    healthImpact: 'Traditional Indian clarified butter with health benefits',
    benefits: ['Rich in fat-soluble vitamins', 'Lactose-free', 'High smoke point', 'Ayurvedic benefits'],
    concerns: ['High in saturated fat', 'Calorie-dense'],
    commonUses: ['Cooking', 'Traditional sweets', 'Ayurvedic medicine']
  }
}

const PRODUCT_DATABASE: Record<string, Omit<ProductAnalysis, 'timestamp' | 'id'>> = {
  '8901234567890': {
    productName: 'Maggi 2-Minute Noodles',
    barcode: '8901234567890',
    brand: 'Nestlé',
    category: 'Instant Noodles',
    overallScore: 42,
    ingredients: [
      INGREDIENT_DATABASE['wheat flour'],
      INGREDIENT_DATABASE['palm oil'],
      INGREDIENT_DATABASE['salt'],
      INGREDIENT_DATABASE['monosodium glutamate'],
      INGREDIENT_DATABASE['artificial colors']
    ],
    dietaryType: 'veg',
    warnings: ['Contains MSG', 'High sodium content', 'Artificial colors not safe for children'],
    benefits: ['Quick preparation', 'Vegetarian'],
    price: 12
  },
  '8901030123456': {
    productName: 'Amul Pure Ghee',
    barcode: '8901030123456',
    brand: 'Amul',
    category: 'Dairy',
    overallScore: 78,
    ingredients: [
      INGREDIENT_DATABASE['ghee']
    ],
    dietaryType: 'veg',
    warnings: ['High in saturated fat', 'Calorie-dense - use in moderation'],
    benefits: ['100% natural', 'Rich in vitamins', 'Traditional Indian ingredient', 'No additives'],
    price: 550
  },
  '1234567890123': {
    productName: 'Organic Oats Breakfast Cereal',
    barcode: '1234567890123',
    brand: 'Kellogg\'s',
    category: 'Breakfast Cereals',
    overallScore: 85,
    ingredients: [
      INGREDIENT_DATABASE['whole grain oats'],
      INGREDIENT_DATABASE['sugar']
    ],
    dietaryType: 'veg',
    warnings: ['Contains added sugar'],
    benefits: ['Whole grain', 'Heart healthy', 'High fiber', 'Natural ingredients'],
    price: 220
  }
}

export async function analyzeBarcode(barcode: string): Promise<ProductAnalysis> {
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  const product = PRODUCT_DATABASE[barcode]
  
  if (product) {
    return {
      ...product,
      id: Date.now().toString(),
      timestamp: Date.now()
    }
  }
  
  throw new Error('Product not found in database')
}

export async function analyzeIngredientText(text: string): Promise<ProductAnalysis> {
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const ingredientNames = text.toLowerCase().split(',').map(i => i.trim())
  const foundIngredients: Ingredient[] = []
  
  for (const name of ingredientNames) {
    const ingredient = INGREDIENT_DATABASE[name]
    if (ingredient) {
      foundIngredients.push(ingredient)
    } else {
      foundIngredients.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        dietaryType: 'unknown',
        source: 'unknown',
        pregnancySafe: 'caution',
        kidSafe: 'caution',
        healthImpact: 'Unknown ingredient - could not analyze'
      })
    }
  }
  
  const score = calculateScore(foundIngredients)
  const dietaryType = determineDietaryType(foundIngredients)
  const warnings = generateWarnings(foundIngredients)
  const benefits = generateBenefits(foundIngredients)
  
  return {
    id: Date.now().toString(),
    productName: 'Custom Product Analysis',
    ingredients: foundIngredients,
    overallScore: score,
    dietaryType,
    warnings,
    benefits,
    timestamp: Date.now()
  }
}

export async function searchProducts(query: string): Promise<ProductAnalysis[]> {
  await new Promise(resolve => setTimeout(resolve, 800))
  
  const results: ProductAnalysis[] = []
  
  for (const [barcode, product] of Object.entries(PRODUCT_DATABASE)) {
    if (
      product.productName.toLowerCase().includes(query.toLowerCase()) ||
      product.brand?.toLowerCase().includes(query.toLowerCase())
    ) {
      results.push({
        ...product,
        id: barcode,
        timestamp: Date.now()
      })
    }
  }
  
  return results
}

export async function getAlternatives(productAnalysis: ProductAnalysis): Promise<Alternative[]> {
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const alternatives: Alternative[] = []
  
  if (productAnalysis.category === 'Instant Noodles') {
    alternatives.push({
      productName: 'Atta Noodles',
      brand: 'Sunfeast',
      score: 68,
      priceComparison: 'similar',
      keyBenefits: ['Made with whole wheat', 'Lower sodium', 'No MSG'],
      availability: 'Available at most supermarkets'
    })
    alternatives.push({
      productName: 'Organic Veggie Pasta',
      brand: 'Whole Farm',
      score: 82,
      priceComparison: 'expensive',
      keyBenefits: ['100% organic', 'Vegetable-based', 'No preservatives', 'High protein'],
      availability: 'Available online and organic stores'
    })
  }
  
  if (productAnalysis.category === 'Breakfast Cereals') {
    alternatives.push({
      productName: 'Steel Cut Oats',
      brand: 'Saffola',
      score: 92,
      priceComparison: 'cheaper',
      keyBenefits: ['Zero added sugar', '100% whole grain', 'High fiber', 'Minimal processing'],
      availability: 'Available at most supermarkets'
    })
  }
  
  return alternatives
}

function calculateScore(ingredients: Ingredient[]): number {
  let score = 100
  
  for (const ingredient of ingredients) {
    if (ingredient.source === 'synthetic') score -= 15
    if (ingredient.source === 'processed') score -= 8
    if (ingredient.pregnancySafe === 'avoid') score -= 12
    if (ingredient.pregnancySafe === 'caution') score -= 6
    if (ingredient.kidSafe === 'avoid') score -= 12
    if (ingredient.kidSafe === 'caution') score -= 6
    if (ingredient.dietaryType === 'unknown') score -= 10
  }
  
  return Math.max(0, Math.min(100, score))
}

function determineDietaryType(ingredients: Ingredient[]): DietaryType {
  const hasNonVeg = ingredients.some(i => i.dietaryType === 'non-veg')
  const hasUnknown = ingredients.some(i => i.dietaryType === 'unknown')
  
  if (hasNonVeg) return 'non-veg'
  if (hasUnknown) return 'unknown'
  return 'veg'
}

function generateWarnings(ingredients: Ingredient[]): string[] {
  const warnings: string[] = []
  
  for (const ingredient of ingredients) {
    if (ingredient.pregnancySafe === 'avoid') {
      warnings.push(`${ingredient.name} is not safe during pregnancy`)
    }
    if (ingredient.kidSafe === 'avoid') {
      warnings.push(`${ingredient.name} is not recommended for children`)
    }
    if (ingredient.concerns && ingredient.concerns.length > 0) {
      warnings.push(...ingredient.concerns.map(c => `${ingredient.name}: ${c}`))
    }
  }
  
  return [...new Set(warnings)]
}

function generateBenefits(ingredients: Ingredient[]): string[] {
  const benefits: string[] = []
  
  for (const ingredient of ingredients) {
    if (ingredient.benefits && ingredient.benefits.length > 0) {
      benefits.push(...ingredient.benefits)
    }
  }
  
  return [...new Set(benefits)]
}

export function filterByPreferences(
  analysis: ProductAnalysis,
  preferences: UserPreferences
): { passes: boolean; violations: string[] } {
  const violations: string[] = []
  
  if (preferences.dietaryPreference === 'veg' && analysis.dietaryType === 'non-veg') {
    violations.push('Contains non-vegetarian ingredients')
  }
  
  if (preferences.dietaryPreference === 'vegan' && 
      (analysis.dietaryType === 'non-veg' || analysis.productName.toLowerCase().includes('ghee'))) {
    violations.push('Contains animal-derived ingredients')
  }
  
  if (preferences.isPregnant) {
    const unsafeIngredients = analysis.ingredients.filter(i => i.pregnancySafe === 'avoid')
    if (unsafeIngredients.length > 0) {
      violations.push(`Not safe during pregnancy: ${unsafeIngredients.map(i => i.name).join(', ')}`)
    }
  }
  
  if (preferences.hasKids && preferences.kidsAge && preferences.kidsAge < 12) {
    const unsafeIngredients = analysis.ingredients.filter(i => i.kidSafe === 'avoid')
    if (unsafeIngredients.length > 0) {
      violations.push(`Not safe for children: ${unsafeIngredients.map(i => i.name).join(', ')}`)
    }
  }
  
  return {
    passes: violations.length === 0,
    violations
  }
}
