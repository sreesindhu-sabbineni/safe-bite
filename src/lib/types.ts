export type DietaryType = 'veg' | 'non-veg' | 'vegan' | 'unknown'
export type IngredientSource = 'natural' | 'synthetic' | 'processed' | 'unknown'
export type SafetyLevel = 'safe' | 'caution' | 'avoid'
export type AuthProvider = 'google' | 'facebook' | 'instagram' | 'x' | 'apple'

export interface UserProfile {
  id: string
  email: string
  displayName: string
  photoUrl?: string
  authProvider: AuthProvider
  createdAt: number
  lastLogin: number
}

export interface UserPreferences {
  isPregnant: boolean
  hasKids: boolean
  kidsAge?: number
  dietaryPreference: 'all' | 'veg' | 'vegan'
  userAge?: number
  gender?: 'male' | 'female' | 'other'
}

export interface Ingredient {
  name: string
  dietaryType: DietaryType
  source: IngredientSource
  pregnancySafe: SafetyLevel
  kidSafe: SafetyLevel
  healthImpact: string
  benefits?: string[]
  concerns?: string[]
  commonUses?: string[]
  productionMethod?: string
  origin?: string
}

export interface ProductAnalysis {
  id: string
  productName: string
  barcode?: string
  brand?: string
  category?: string
  overallScore: number
  ingredients: Ingredient[]
  dietaryType: DietaryType
  warnings: string[]
  benefits: string[]
  timestamp: number
  imageUrl?: string
  price?: number
}

export interface Alternative {
  productName: string
  brand: string
  score: number
  priceComparison: 'cheaper' | 'similar' | 'expensive'
  keyBenefits: string[]
  availability: string
  imageUrl?: string
}

export interface ScanHistoryItem {
  id: string
  productName: string
  score: number
  timestamp: number
  imageUrl?: string
}
