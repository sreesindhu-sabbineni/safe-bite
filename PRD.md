# Product Requirements Document: NutriScan Global

A comprehensive food ingredient analysis platform that empowers consumers worldwide to make informed dietary choices by scanning products, analyzing ingredients for dietary restrictions, safety, and nutritional value, similar to Yuka but with personalized user profiles and global product coverage.

**Experience Qualities**:
1. **Trustworthy** - Users should feel confident in ingredient analysis with clear, science-backed safety ratings and culturally relevant dietary classifications
2. **Effortless** - Scanning and understanding product information should be instantaneous and require minimal user input
3. **Empowering** - Users should feel in control of their dietary choices with personalized recommendations based on their specific needs

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This application requires multiple sophisticated features including image recognition, ingredient database management, complex filtering logic for dietary restrictions and safety profiles, personalized recommendations, and alternative product suggestions.

## Essential Features

### Barcode/Image Scanning
- **Functionality**: Camera-based barcode scanner and ingredient photo capture with OCR text extraction
- **Purpose**: Enable quick product analysis without manual data entry
- **Trigger**: User taps "Scan Product" button or camera icon
- **Progression**: Camera opens → User positions barcode/label → Auto-detect and capture → Image processing → Results display
- **Success criteria**: Barcode recognized within 2 seconds, ingredient text extracted with >90% accuracy

### Ingredient Analysis Engine
- **Functionality**: Analyzes extracted ingredients against dietary, safety, and nutritional databases
- **Purpose**: Provide comprehensive health and safety assessment tailored to Indian dietary practices
- **Trigger**: After successful scan or search query submission
- **Progression**: Ingredient list parsed → Individual ingredient lookup → Classification (veg/non-veg, natural/synthetic) → Safety scoring (pregnancy/kid-safe) → Aggregate health score calculation → Results display with color-coded rating
- **Success criteria**: Analysis completes in <3 seconds, provides score 0-100, flags all dietary concerns

### Product Search
- **Functionality**: Text-based search for products and individual ingredients with autocomplete
- **Purpose**: Allow users to research products before purchase or check specific ingredients
- **Trigger**: User types in search bar
- **Progression**: User enters query → Autocomplete suggestions appear → User selects or submits → Database lookup → Results display with full analysis
- **Success criteria**: Search returns relevant results in <1 second, autocomplete suggestions appear after 2 characters

### Alternative Recommendations
- **Functionality**: Suggests better-rated products in the same category with superior ingredient profiles
- **Purpose**: Help users discover healthier alternatives and maximize value for money
- **Trigger**: Displayed automatically after product analysis if score is below 70/100
- **Progression**: Product category identified → Query alternatives with better scores → Filter by availability → Rank by score and value → Display top 3-5 alternatives with comparison
- **Success criteria**: Provides at least 2 relevant alternatives for 80% of scanned products

### Personalized Safety Filters
- **Functionality**: Customizable user profile for pregnancy status, children's age, dietary preferences (veg/non-veg), age group
- **Purpose**: Surface safety warnings and recommendations specific to user's life situation
- **Trigger**: User sets preferences in profile settings
- **Progression**: User selects applicable filters → Preferences saved → All analyses apply filters → Warnings highlighted for unsafe ingredients → Safe alternatives prioritized
- **Success criteria**: Correctly flags pregnancy-unsafe ingredients, child-age restrictions, dietary violations

### Detailed Ingredient Breakdown
- **Functionality**: Expandable view showing each ingredient with individual classification and health impact
- **Purpose**: Educate users about specific ingredients and build trust in scoring
- **Trigger**: User taps "View Ingredients" or expands ingredient list
- **Progression**: Ingredient list expands → Each ingredient shows icon badges (veg/non-veg, natural/synthetic, safety flags) → User taps individual ingredient → Detailed modal with benefits, concerns, common sources
- **Success criteria**: All ingredients properly classified, safety concerns clearly highlighted

## Edge Case Handling

- **Unclear Barcode/Label**: Prompt user to retake photo with better lighting/angle; offer manual product name entry
- **Unknown Ingredients**: Flag as "unrecognized" in analysis, reduce confidence score, allow user to report for database improvement
- **Multiple Products in Frame**: Highlight detected regions, ask user to select which product to analyze
- **Offline Mode**: Display cached previously scanned products, show "limited functionality" banner for new scans
- **Conflicting Ingredient Information**: Show multiple source data with confidence levels, prefer official Indian regulatory data (FSSAI)
- **Regional Language Ingredients**: OCR should detect Hindi/regional text, translate for analysis, display in user's preferred language
- **Value for Money Calculation**: If price unavailable, score only on ingredient quality; allow manual price entry

## Design Direction

The design should evoke trust, clarity, and health-consciousness while feeling modern and distinctly Indian. Colors should communicate safety levels intuitively (green for safe, amber for caution, red for avoid). The interface should feel clinical and scientific yet approachable, similar to a health app you'd trust for medical information but not intimidating for everyday grocery shopping.

## Color Selection

A health-focused palette with strong semantic color associations and vibrant Indian-inspired accents.

- **Primary Color**: Deep Teal `oklch(0.45 0.12 200)` - Communicates trust, health, and scientific credibility without medical sterility
- **Secondary Colors**: 
  - Soft Sage Green `oklch(0.88 0.05 145)` - Supporting backgrounds and low-emphasis actions
  - Warm Terracotta `oklch(0.65 0.15 35)` - Accent for Indian cultural connection and warmth
- **Accent Color**: Vibrant Emerald `oklch(0.55 0.18 155)` - CTAs, safe ingredient badges, high scores (70-100)
- **Semantic Colors**:
  - Warning Amber `oklch(0.75 0.15 75)` - Moderate concern scores (40-69)
  - Alert Red `oklch(0.55 0.22 25)` - Unsafe ingredients, low scores (0-39)
  - Veg Green `oklch(0.60 0.20 145)` - Vegetarian indicator
  - Non-veg Red `oklch(0.55 0.20 25)` - Non-vegetarian indicator
- **Foreground/Background Pairings**:
  - Primary Teal on White `oklch(0.45 0.12 200)` on `oklch(1 0 0)` - Ratio 7.2:1 ✓
  - White on Primary Teal `oklch(1 0 0)` on `oklch(0.45 0.12 200)` - Ratio 7.2:1 ✓
  - Accent Emerald on White `oklch(0.55 0.18 155)` on `oklch(1 0 0)` - Ratio 4.9:1 ✓
  - Dark Text on Sage Background `oklch(0.25 0.02 200)` on `oklch(0.88 0.05 145)` - Ratio 11.8:1 ✓

## Font Selection

Typography should balance scientific credibility with approachability and excellent multilingual support for Indian languages.

- **Primary Font**: **Plus Jakarta Sans** - Modern geometric sans-serif that feels professional yet friendly, excellent readability at small sizes for ingredient lists
- **Secondary Font**: **Poppins** - Clean Indian-designed typeface with excellent Devanagari support for Hindi ingredient labels

- **Typographic Hierarchy**:
  - H1 (Screen Titles): Plus Jakarta Sans Bold / 28px / -0.02em letter spacing / 1.2 line height
  - H2 (Product Names): Plus Jakarta Sans Semibold / 22px / -0.01em letter spacing / 1.3 line height
  - H3 (Section Headers): Plus Jakarta Sans Semibold / 18px / 0em letter spacing / 1.4 line height
  - Body (Ingredient Lists): Plus Jakarta Sans Regular / 15px / 0em letter spacing / 1.6 line height
  - Caption (Safety Labels): Plus Jakarta Sans Medium / 13px / 0.01em letter spacing / 1.4 line height
  - Score Display: Plus Jakarta Sans Bold / 48px / -0.03em letter spacing / 1.0 line height

## Animations

Animations should reinforce feedback during scanning and analysis while creating moments of delight when users discover safer alternatives. Use purposeful motion to guide attention to safety warnings and scores.

- **Scan Animation**: Pulsing scan line with subtle glow when camera is active, celebratory micro-interaction on successful capture
- **Score Reveal**: Circular progress animation filling score ring from 0 to final value over 1.2s with spring easing
- **Ingredient Classification**: Staggered fade-in of ingredient badges (50ms delay between each) to show systematic analysis
- **Alternative Cards**: Slide-in from right with slight bounce, emphasizing "better option discovered"
- **Tab Transitions**: Smooth crossfade between search/scan/history views (250ms)
- **Warning Flags**: Gentle shake animation (200ms) on pregnancy/kid-unsafe ingredients to draw immediate attention

## Component Selection

- **Components**:
  - **Camera Overlay**: Custom component with centered targeting frame, corner guides, instruction text overlay
  - **Score Card**: Card with large circular progress indicator (recharts radial chart), color-coded by score range
  - **Ingredient List**: Accordion with each ingredient row showing badge icons (vegetarian status, natural/synthetic, safety flags)
  - **Search Bar**: Input with Phosphor MagnifyingGlass icon, clear button, autocomplete dropdown using Command component
  - **Alternative Product Cards**: Carousel (embla-carousel-react) showing horizontal scrollable cards with comparison badges
  - **Filter Badges**: Toggle pills using Badge component for dietary preferences (All/Veg/Non-veg)
  - **Safety Profile Sheet**: Sheet (bottom drawer on mobile) for user preferences with Switch components
  - **Product Detail Modal**: Dialog with tabbed content (Tabs component) for Overview/Ingredients/Alternatives
  - **History List**: Scroll-area with Card components showing recent scans

- **Customizations**:
  - Custom camera component using Web Camera API with barcode detection via browser APIs
  - Custom OCR integration for ingredient text extraction
  - Custom circular score gauge using SVG or recharts
  - Badge component variants for dietary tags (veg-badge with green dot, non-veg-badge with red dot)

- **States**:
  - **Buttons**: Primary scan button uses Accent color with pressed scale(0.97), disabled shows muted with reduced opacity
  - **Search Input**: Focus state shows Primary border with subtle glow shadow, error state for no results uses Warning color
  - **Score Display**: Color transitions from Alert Red (0-39) → Warning Amber (40-69) → Accent Green (70-100)
  - **Ingredient Rows**: Hover shows subtle background highlight, expanded state reveals detailed info card

- **Icon Selection**:
  - Scan: Phosphor `Barcode`, `Camera` for manual photo
  - Search: Phosphor `MagnifyingGlass`
  - Dietary: Phosphor `Leaf` (veg), `Drop` (non-veg marker)
  - Safety: Phosphor `ShieldCheck` (safe), `ShieldWarning` (caution), `X` (unsafe)
  - Natural/Synthetic: Phosphor `Plant` (natural), `Flask` (synthetic)
  - Alternatives: Phosphor `ArrowsLeftRight`, `TrendUp` (better score)
  - Pregnancy: Phosphor `Baby`
  - Value: Phosphor `CurrencyInr`
  - Info: Phosphor `Info`

- **Spacing**:
  - Screen padding: `p-6` (24px) on desktop, `p-4` (16px) on mobile
  - Card padding: `p-5` (20px)
  - Section gaps: `gap-6` (24px) between major sections
  - List items: `gap-3` (12px) between ingredient rows
  - Button groups: `gap-2` (8px) between related buttons

- **Mobile**:
  - Bottom navigation bar with 3 tabs: Scan (center, enlarged), Search, History
  - Camera view takes full viewport on scan
  - Product detail sheets slide up from bottom (Sheet component) instead of centered modals
  - Alternative products in horizontal scroll carousel
  - Sticky score card at top during scroll through ingredients
  - Larger touch targets (minimum 44px) for all interactive elements
  - Simplified filter chips that expand to full sheet on tap
