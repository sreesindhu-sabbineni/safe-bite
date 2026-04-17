import { useState, useEffect, useRef } from 'react'
import { useKV } from '@/hooks/use-kv'
import { Barcode, MagnifyingGlass, ClockCounterClockwise, SlidersHorizontal, Camera, Sparkle, ArrowsLeftRight, TrendUp, CurrencyInr, Baby, X, SignOut, User as UserIcon, CircleNotch, CheckCircle, Brain } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast, Toaster } from 'sonner'
import { ScoreGauge } from '@/components/ScoreGauge'
import { IngredientList } from '@/components/IngredientList'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { AuthDialog } from '@/components/AuthDialog'
import type { ProductAnalysis, UserPreferences, Alternative, ScanHistoryItem, UserProfile } from '@/lib/types'
import { fetchProductByBarcode, searchProductsByName, getAlternatives, getSearchSuggestions, generateScoreSummary } from '@/lib/api'
import { analyzeIngredientsAI, getAIRecommendation, setApiKey, getStoredApiKey, isAIEnabled } from '@/lib/ai'
import { filterByPreferences } from '@/lib/analysis'
import { motion, AnimatePresence } from 'framer-motion'

function App() {
  const [activeTab, setActiveTab] = useState('scan')
  const [previousTab, setPreviousTab] = useState('scan')
  const [currentAnalysis, setCurrentAnalysis] = useState<ProductAnalysis | null>(null)
  const [alternatives, setAlternatives] = useState<Alternative[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductAnalysis[]>([])
  const [searchResultsAlternatives, setSearchResultsAlternatives] = useState<Record<string, Alternative[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<{ product: string; brand: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingAlternativesFor, setLoadingAlternativesFor] = useState<Set<string>>(new Set())
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [aiAnalysis, setAiAnalysis] = useState<{ summary: string; healthRating: string; concerns: string[]; benefits: string[]; recommendation: string } | null>(null)
  const [aiRecommendation, setAiRecommendation] = useState<string>('')
  const [apiKeyInput, setApiKeyInput] = useState(getStoredApiKey())
  const [aiEnabled, setAiEnabled] = useState(isAIEnabled())
  
  const [userProfile, setUserProfile] = useKV<UserProfile | null>('user-profile', null)
  const [userScanHistory = [], setUserScanHistory] = useKV<ScanHistoryItem[]>('user-scan-history', [])
  const [sessionHistory, setSessionHistory] = useState<ScanHistoryItem[]>([])
  const [preferences = {
    isPregnant: false,
    hasKids: false,
    dietaryPreference: 'all' as const
  }, setPreferences] = useKV<UserPreferences>('user-preferences', {
    isPregnant: false,
    hasKids: false,
    dietaryPreference: 'all'
  })

  const scanHistory = userProfile ? userScanHistory : sessionHistory

  useEffect(() => {
    if (currentAnalysis) {
      loadAlternatives(currentAnalysis)
    }
  }, [currentAnalysis])

  useEffect(() => {
    if (searchQuery.length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      
      searchTimeoutRef.current = setTimeout(async () => {
        const suggestions = await getSearchSuggestions(searchQuery)
        setSearchSuggestions(suggestions)
        setShowSuggestions(suggestions.length > 0)
      }, 300)
    } else {
      setSearchSuggestions([])
      setShowSuggestions(false)
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const loadAlternatives = async (product: ProductAnalysis) => {
    setIsLoadingAlternatives(true)
    try {
      const alts = await getAlternatives(product)
      setAlternatives(alts)
    } catch (error) {
      console.error('Failed to load alternatives:', error)
    } finally {
      setIsLoadingAlternatives(false)
    }
  }

  const loadAlternativesForSearchResult = async (product: ProductAnalysis) => {
    if (searchResultsAlternatives[product.id]) {
      return
    }

    setLoadingAlternativesFor(prev => new Set([...prev, product.id]))
    
    try {
      const alts = await getAlternatives(product)
      setSearchResultsAlternatives(prev => ({
        ...prev,
        [product.id]: alts
      }))
    } catch (error) {
      console.error('Failed to load alternatives:', error)
    } finally {
      setLoadingAlternativesFor(prev => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
  }

  const addToHistory = (product: ProductAnalysis) => {
    const newItem: ScanHistoryItem = {
      id: product.id,
      productName: product.productName,
      score: product.overallScore,
      timestamp: Date.now(),
      imageUrl: product.imageUrl
    }

    if (userProfile) {
      setUserScanHistory(current => [newItem, ...(current || []).filter(h => h.id !== product.id).slice(0, 49)])
    } else {
      setSessionHistory(current => [newItem, ...current.filter(h => h.id !== product.id).slice(0, 49)])
    }
  }

  const analyzeProduct = async (barcode: string, fromTab?: string) => {
    setIsLoading(true)
    try {
      const analysis = await fetchProductByBarcode(barcode)
      setCurrentAnalysis(analysis)
      setAiAnalysis(null)
      setAiRecommendation('')
      
      addToHistory(analysis)
      
      const { passes, violations } = filterByPreferences(analysis, preferences)
      if (!passes) {
        violations.forEach(v => toast.warning(v))
      }
      
      toast.success('Product analyzed successfully!')
      
      // Run AI analysis in background if enabled
      if (isAIEnabled()) {
        const ingredientsText = analysis.ingredients.map(i => i.name).join(', ')
        analyzeIngredientsAI(ingredientsText, analysis.productName)
          .then(result => setAiAnalysis(result))
          .catch(() => {})
        getAIRecommendation(analysis.productName, analysis.overallScore, analysis.warnings, analysis.category || '')
          .then(result => setAiRecommendation(result))
          .catch(() => {})
      }
      
      if (fromTab) {
        setPreviousTab(fromTab)
      }
      
      return analysis
    } catch (error) {
      toast.error('Product not found in our database. Try searching by name.')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const handleBarcodeSubmit = async () => {
    if (!barcodeInput.trim()) {
      toast.error('Please enter a barcode')
      return
    }

    await analyzeProduct(barcodeInput.trim(), 'scan')
  }

  const handleBarcodeDetected = async (barcode: string) => {
    setShowScanner(false)
    setBarcodeInput(barcode)
    toast.success(`Barcode detected: ${barcode}`)
    await analyzeProduct(barcode, 'scan')
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term')
      return
    }

    setIsLoading(true)
    setShowSuggestions(false)
    setSearchResults([])
    setSearchResultsAlternatives({})
    
    try {
      const results = await searchProductsByName(searchQuery)
      setSearchResults(results)
      
      if (results.length === 0) {
        toast.error('No products found matching your search')
      } else {
        toast.success(`Found ${results.length} product(s)`)
        
        results.slice(0, 5).forEach(product => {
          loadAlternativesForSearchResult(product)
        })
      }
    } catch (error) {
      console.error('Search error:', error)
      toast.error('Search failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const selectProduct = async (product: ProductAnalysis) => {
    setCurrentAnalysis(product)
    setPreviousTab(activeTab)
    setActiveTab('scan')
    
    addToHistory(product)
    
    const { passes, violations } = filterByPreferences(product, preferences)
    if (!passes) {
      violations.forEach(v => toast.warning(v))
    }
  }

  const handleCloseProduct = () => {
    setCurrentAnalysis(null)
    setAlternatives([])
    if (previousTab !== activeTab) {
      setActiveTab(previousTab)
    }
  }

  const handleAuthSuccess = (profile: UserProfile) => {
    setUserProfile(profile)
    toast.success(`Welcome, ${profile.displayName}!`)
  }

  const handleSignOut = () => {
    setUserProfile(null)
    toast.success('Signed out successfully')
  }

  const handleSuggestionSelect = (suggestion: { product: string; brand: string }) => {
    setSearchQuery(suggestion.product)
    setShowSuggestions(false)
    setTimeout(() => {
      handleSearch()
    }, 100)
  }

  return (
    <>
      <AnimatePresence>
        {showScanner && (
          <BarcodeScanner
            onBarcodeDetected={handleBarcodeDetected}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>

      <AuthDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthSuccess={handleAuthSuccess}
      />

      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/5">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">Safe Bite</h1>
            <p className="text-sm text-muted-foreground mt-1">Know what you eat, choose what's best</p>
          </div>
          
          <div className="flex items-center gap-2">
            {userProfile ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={userProfile.photoUrl} />
                      <AvatarFallback>
                        <UserIcon size={16} />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Profile</SheetTitle>
                    <SheetDescription>
                      Manage your account and preferences
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="space-y-6 mt-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={userProfile.photoUrl} />
                        <AvatarFallback>
                          <UserIcon size={24} />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{userProfile.displayName}</p>
                        <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                        <p className="text-xs text-muted-foreground capitalize mt-1">
                          Signed in with {userProfile.authProvider}
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Statistics</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-primary">{userScanHistory.length}</p>
                            <p className="text-xs text-muted-foreground">Products Scanned</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-accent">
                              {userScanHistory.length > 0 
                                ? Math.round(userScanHistory.reduce((acc, item) => acc + item.score, 0) / userScanHistory.length)
                                : 0}
                            </p>
                            <p className="text-xs text-muted-foreground">Avg Score</p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                    
                    <Button 
                      variant="destructive" 
                      className="w-full gap-2"
                      onClick={handleSignOut}
                    >
                      <SignOut size={16} />
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button 
                variant="default" 
                onClick={() => setShowAuthDialog(true)}
                className="gap-2"
              >
                <UserIcon size={16} />
                Sign In
              </Button>
            )}
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Safety Preferences</SheetTitle>
                  <SheetDescription>
                    Customize analysis based on your dietary needs and safety requirements
                  </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="pregnant" className="flex items-center gap-2">
                          <Baby size={16} />
                          Pregnancy Safe
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Flag ingredients unsafe during pregnancy
                        </p>
                      </div>
                      <Switch
                        id="pregnant"
                        checked={preferences.isPregnant}
                        onCheckedChange={(checked) => 
                          setPreferences(current => ({ 
                            ...(current || { isPregnant: false, hasKids: false, dietaryPreference: 'all' as const }), 
                            isPregnant: checked 
                          }))
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="kids">Kid Safe</Label>
                        <p className="text-xs text-muted-foreground">
                          Flag ingredients not suitable for children
                        </p>
                      </div>
                      <Switch
                        id="kids"
                        checked={preferences.hasKids}
                        onCheckedChange={(checked) => 
                          setPreferences(current => ({ 
                            ...(current || { isPregnant: false, hasKids: false, dietaryPreference: 'all' as const }), 
                            hasKids: checked 
                          }))
                        }
                      />
                    </div>

                    {preferences.hasKids && (
                      <div className="pl-4">
                        <Label htmlFor="kids-age" className="text-sm">Child's Age</Label>
                        <Input
                          id="kids-age"
                          type="number"
                          placeholder="Age in years"
                          className="mt-1.5"
                          value={preferences.kidsAge || ''}
                          onChange={(e) => 
                            setPreferences(current => ({ 
                              ...(current || { isPregnant: false, hasKids: false, dietaryPreference: 'all' as const }), 
                              kidsAge: parseInt(e.target.value) || undefined 
                            }))
                          }
                        />
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <Label>Dietary Preference</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={preferences.dietaryPreference === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPreferences(current => ({ 
                            ...(current || { isPregnant: false, hasKids: false, dietaryPreference: 'all' as const }), 
                            dietaryPreference: 'all' 
                          }))}
                        >
                          All
                        </Button>
                        <Button
                          variant={preferences.dietaryPreference === 'veg' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPreferences(current => ({ 
                            ...(current || { isPregnant: false, hasKids: false, dietaryPreference: 'all' as const }), 
                            dietaryPreference: 'veg' 
                          }))}
                        >
                          Vegetarian
                        </Button>
                        <Button
                          variant={preferences.dietaryPreference === 'vegan' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPreferences(current => ({ 
                            ...(current || { isPregnant: false, hasKids: false, dietaryPreference: 'all' as const }), 
                            dietaryPreference: 'vegan' 
                          }))}
                        >
                          Vegan
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <Sparkle size={16} />
                      AI Analysis (Gemini)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Add a free Google Gemini API key for AI-powered ingredient analysis, smart search with typo correction, and personalized health recommendations.
                    </p>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder="Paste Gemini API key"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          setApiKey(apiKeyInput)
                          setAiEnabled(apiKeyInput.length > 10)
                          toast.success(apiKeyInput.length > 10 ? 'AI enabled!' : 'AI disabled')
                        }}
                      >
                        Save
                      </Button>
                    </div>
                    {aiEnabled && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle size={12} /> AI analysis active
                      </p>
                    )}
                    <a
                      href="https://aistudio.google.com/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Get a free Gemini API key →
                    </a>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="scan" className="gap-2 py-3">
              <Barcode size={20} />
              <span>Scan</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2 py-3">
              <MagnifyingGlass size={20} />
              <span>Search</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 py-3">
              <ClockCounterClockwise size={20} />
              <span>History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Barcode size={24} className="text-primary" />
                  Scan Product
                </CardTitle>
                <CardDescription>
                  Enter a barcode number or use your camera to scan a product
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter barcode (e.g., 8901234567890)"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeSubmit()}
                    className="flex-1"
                  />
                  <Button onClick={handleBarcodeSubmit} disabled={isLoading} className="gap-2">
                    {isLoading ? (
                      <CircleNotch size={16} className="animate-spin" />
                    ) : (
                      <Sparkle size={16} weight="fill" />
                    )}
                    Analyze
                  </Button>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={() => setShowScanner(true)}
                >
                  <Camera size={20} />
                  Open Camera Scanner
                </Button>
              </CardContent>
            </Card>

            {currentAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        {currentAnalysis.imageUrl && (
                          <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted border">
                            <img
                              src={currentAnalysis.imageUrl}
                              alt={currentAnalysis.productName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-2xl">{currentAnalysis.productName}</CardTitle>
                          {currentAnalysis.brand && (
                            <CardDescription className="text-base mt-1">
                              {currentAnalysis.brand}
                            </CardDescription>
                          )}
                          {currentAnalysis.category && (
                            <Badge variant="secondary" className="mt-2">{currentAnalysis.category}</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCloseProduct}
                      >
                        <X size={20} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col items-center justify-center py-4">
                      <ScoreGauge score={currentAnalysis.overallScore} />
                      <p className="text-sm text-muted-foreground mt-4">Overall Health Score</p>
                    </div>

                    {/* Score Summary */}
                    <div className="rounded-lg bg-muted/50 border p-4">
                      <h3 className="font-semibold mb-2 text-sm">Why this score?</h3>
                      <ul className="space-y-1">
                        {generateScoreSummary(currentAnalysis).map((reason, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1 text-xs">
                              {i === 0 ? '📊' : reason.includes('boost') || reason.includes('clean') || reason.includes('natural') ? '✅' : '⚠️'}
                            </span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {currentAnalysis.warnings.length > 0 && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                        <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                          <X size={18} weight="bold" />
                          Warnings
                        </h3>
                        <ul className="space-y-1">
                          {currentAnalysis.warnings.slice(0, 5).map((warning, i) => (
                            <li key={i} className="text-sm text-destructive/90">• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {currentAnalysis.benefits.length > 0 && (
                      <div className="rounded-lg bg-success/10 border border-success/20 p-4">
                        <h3 className="font-semibold text-success mb-2">Benefits</h3>
                        <ul className="space-y-1">
                          {currentAnalysis.benefits.slice(0, 5).map((benefit, i) => (
                            <li key={i} className="text-sm text-success/90">• {benefit}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(aiAnalysis || aiRecommendation) && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                        <h3 className="font-semibold flex items-center gap-2 text-primary">
                          <Brain size={18} />
                          AI Health Analysis
                        </h3>
                        {aiAnalysis && (
                          <>
                            <p className="text-sm">{aiAnalysis.summary}</p>
                            {aiAnalysis.concerns.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-destructive mb-1">Concerns:</p>
                                <ul className="space-y-0.5">
                                  {aiAnalysis.concerns.map((c, i) => (
                                    <li key={i} className="text-xs text-destructive/80">• {c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aiAnalysis.benefits.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-green-600 mb-1">Benefits:</p>
                                <ul className="space-y-0.5">
                                  {aiAnalysis.benefits.map((b, i) => (
                                    <li key={i} className="text-xs text-green-600/80">• {b}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                        {aiRecommendation && (
                          <p className="text-sm italic text-muted-foreground border-t border-primary/10 pt-2">
                            💡 {aiRecommendation}
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <h3 className="font-semibold mb-3">Ingredients Analysis</h3>
                      <IngredientList ingredients={currentAnalysis.ingredients} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-accent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-accent">
                        <ArrowsLeftRight size={24} />
                        {currentAnalysis.overallScore >= 70 ? 'Similar Products' : 'Better Alternatives'}
                      </CardTitle>
                      <CardDescription>
                        {currentAnalysis.overallScore >= 70 
                          ? 'Other good products in this category you might like'
                          : 'Consider these healthier options with better ingredient profiles'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAlternatives ? (
                        <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                          <CircleNotch size={20} className="animate-spin" />
                          <p>Loading alternatives...</p>
                        </div>
                      ) : alternatives.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No better alternatives found in this category</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {alternatives.map((alt, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="rounded-lg border border-border p-4 hover:border-accent hover:bg-accent/5 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                {alt.imageUrl && (
                                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                                    <img
                                      src={alt.imageUrl}
                                      alt={alt.productName}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                      }}
                                    />
                                  </div>
                                )}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold">{alt.productName}</h4>
                                    {alt.score > currentAnalysis.overallScore && (
                                      <Badge variant="outline" className="gap-1 border-accent text-accent">
                                        <TrendUp size={12} />
                                        +{alt.score - currentAnalysis.overallScore}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-2">{alt.brand}</p>
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {alt.keyBenefits.map((benefit, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {benefit}
                                      </Badge>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <CurrencyInr size={14} />
                                      {alt.priceComparison === 'cheaper' && 'More affordable'}
                                      {alt.priceComparison === 'similar' && 'Similar price'}
                                      {alt.priceComparison === 'expensive' && 'Premium option'}
                                    </span>
                                    <span>•</span>
                                    <span>{alt.availability}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-center">
                                  <div className="text-2xl font-bold text-accent">{alt.score}</div>
                                  <div className="text-xs text-muted-foreground">score</div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MagnifyingGlass size={24} className="text-primary" />
                  Search Products
                </CardTitle>
                <CardDescription>
                  Search for products worldwide by name or ingredient (fuzzy search enabled)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Search products (e.g., Maggi, Oats, Ghee, Coca Cola)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    />
                    {showSuggestions && searchSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                        {searchSuggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2 hover:bg-accent/10 flex items-center gap-2 transition-colors"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSuggestionSelect(suggestion)}
                          >
                            <MagnifyingGlass size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="truncate text-sm font-medium">{suggestion.product}</span>
                            {suggestion.brand && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">• {suggestion.brand}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleSearch} disabled={isLoading}>
                    {isLoading ? <CircleNotch size={20} className="animate-spin" /> : 'Search'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isLoading && (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <CircleNotch size={32} className="animate-spin text-primary" />
                    <p className="text-muted-foreground">Searching products...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && searchResults.length > 0 && (
              <div className="grid gap-3">
                {searchResults.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <CardContent className="p-4 space-y-3">
                      <div 
                        className="flex items-start justify-between gap-4"
                        onClick={() => selectProduct(product)}
                      >
                        {product.imageUrl && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                            <img 
                              src={product.imageUrl} 
                              alt={product.productName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{product.productName}</h3>
                          {product.brand && (
                            <p className="text-sm text-muted-foreground truncate">{product.brand}</p>
                          )}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Badge variant={product.dietaryType === 'veg' ? 'outline' : 'destructive'}>
                              {product.dietaryType}
                            </Badge>
                            {product.category && (
                              <Badge variant="secondary" className="truncate max-w-[150px]">{product.category}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-center flex-shrink-0">
                          <ScoreGauge score={product.overallScore} size="sm" animate={false} />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-accent flex items-center gap-2">
                              <ArrowsLeftRight size={16} />
                              {product.overallScore >= 70 ? 'Similar Products' : 'Better Alternatives'}
                            </h4>
                          </div>
                          
                          {loadingAlternativesFor.has(product.id) ? (
                            <div className="text-center py-4 text-muted-foreground flex items-center justify-center gap-2">
                              <CircleNotch size={16} className="animate-spin" />
                              <p className="text-xs">Loading alternatives...</p>
                            </div>
                          ) : searchResultsAlternatives[product.id]?.length > 0 ? (
                            <div className="space-y-2">
                              {searchResultsAlternatives[product.id].slice(0, 3).map((alt, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded bg-accent/5 border border-accent/20">
                                  <div className="flex items-center gap-2 flex-1">
                                    {alt.imageUrl && (
                                      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 bg-muted">
                                        <img src={alt.imageUrl} alt={alt.productName} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-sm font-medium">{alt.productName}</p>
                                      <p className="text-xs text-muted-foreground">{alt.brand}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {alt.score > product.overallScore && (
                                      <Badge variant="outline" className="border-accent text-accent">
                                        <TrendUp size={10} className="mr-1" />
                                        +{alt.score - product.overallScore}
                                      </Badge>
                                    )}
                                    <span className="text-sm font-bold text-accent">{alt.score}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">No alternatives found</p>
                          )}
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClockCounterClockwise size={24} className="text-primary" />
                  Scan History
                </CardTitle>
                <CardDescription>
                  {userProfile 
                    ? `Your scan history (synced across devices)` 
                    : `Session history (sign in to sync across devices)`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scanHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No scans yet</p>
                    <p className="text-sm mt-1">Start scanning products to see your history</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {scanHistory.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {item.imageUrl && (
                              <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-muted">
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              </div>
                            )}
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(item.timestamp).toLocaleDateString()} at{' '}
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              item.score >= 70 ? 'text-accent' :
                              item.score >= 40 ? 'text-warning' :
                              'text-destructive'
                            }`}>
                              {item.score}
                            </div>
                            <div className="text-xs text-muted-foreground">score</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      <footer className="text-center py-4 text-xs text-muted-foreground border-t border-border mt-8">
        <p>Safe Bite • Powered by Open Food Facts API • AI-Powered Analysis</p>
      </footer>
    </div>
    <Toaster position="top-center" richColors />
    </>
  )
}

export default App
