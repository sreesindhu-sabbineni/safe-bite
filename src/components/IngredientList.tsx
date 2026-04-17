import { motion } from 'framer-motion'
import { Leaf, Drop, Plant, Flask, ShieldCheck, ShieldWarning, X, Info } from '@phosphor-icons/react'
import type { Ingredient } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { cn } from '@/lib/utils'

interface IngredientListProps {
  ingredients: Ingredient[]
}

export function IngredientList({ ingredients }: IngredientListProps) {
  return (
    <div className="space-y-2">
      <Accordion type="multiple" className="w-full">
        {ingredients.map((ingredient, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <AccordionItem value={`ingredient-${index}`} className="border-b border-border">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-medium text-foreground">{ingredient.name}</span>
                  <div className="flex items-center gap-1.5">
                    <DietaryBadge type={ingredient.dietaryType} />
                    <SourceBadge source={ingredient.source} />
                    <SafetyBadge pregnancySafe={ingredient.pregnancySafe} kidSafe={ingredient.kidSafe} />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-muted-foreground">{ingredient.healthImpact}</p>
                  
                  {ingredient.productionMethod && (
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-1.5">Production Method</h4>
                      <p className="text-sm text-muted-foreground">{ingredient.productionMethod}</p>
                    </div>
                  )}
                  
                  {ingredient.origin && (
                    <div>
                      <h4 className="text-sm font-semibold text-primary mb-1.5">Origin</h4>
                      <p className="text-sm text-muted-foreground">{ingredient.origin}</p>
                    </div>
                  )}
                  
                  {ingredient.benefits && ingredient.benefits.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-success mb-1.5">Benefits</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {ingredient.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-success mt-0.5">•</span>
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {ingredient.concerns && ingredient.concerns.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-destructive mb-1.5">Concerns</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {ingredient.concerns.map((concern, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-destructive mt-0.5">•</span>
                            <span>{concern}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {ingredient.commonUses && ingredient.commonUses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1.5">Common Uses</h4>
                      <p className="text-sm text-muted-foreground">{ingredient.commonUses.join(', ')}</p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
    </div>
  )
}

function DietaryBadge({ type }: { type: Ingredient['dietaryType'] }) {
  if (type === 'veg') {
    return (
      <Badge variant="outline" className="gap-1 border-success text-success bg-success/10">
        <Leaf size={12} weight="fill" />
        <span className="text-xs">Veg</span>
      </Badge>
    )
  }
  
  if (type === 'non-veg') {
    return (
      <Badge variant="outline" className="gap-1 border-destructive text-destructive bg-destructive/10">
        <Drop size={12} weight="fill" />
        <span className="text-xs">Non-Veg</span>
      </Badge>
    )
  }
  
  if (type === 'vegan') {
    return (
      <Badge variant="outline" className="gap-1 border-success text-success bg-success/10">
        <Plant size={12} weight="fill" />
        <span className="text-xs">Vegan</span>
      </Badge>
    )
  }
  
  return (
    <Badge variant="outline" className="gap-1">
      <Info size={12} />
      <span className="text-xs">Unknown</span>
    </Badge>
  )
}

function SourceBadge({ source }: { source: Ingredient['source'] }) {
  if (source === 'natural') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Plant size={12} />
        <span className="text-xs">Natural</span>
      </Badge>
    )
  }
  
  if (source === 'synthetic') {
    return (
      <Badge variant="outline" className="gap-1 border-warning text-warning bg-warning/10">
        <Flask size={12} />
        <span className="text-xs">Synthetic</span>
      </Badge>
    )
  }
  
  if (source === 'processed') {
    return (
      <Badge variant="outline" className="gap-1">
        <span className="text-xs">Processed</span>
      </Badge>
    )
  }
  
  return null
}

function SafetyBadge({ pregnancySafe, kidSafe }: { pregnancySafe: Ingredient['pregnancySafe'], kidSafe: Ingredient['kidSafe'] }) {
  const hasWarnings = pregnancySafe === 'avoid' || kidSafe === 'avoid' || pregnancySafe === 'caution' || kidSafe === 'caution'
  
  if (!hasWarnings) {
    return (
      <Badge variant="outline" className="gap-1 border-success text-success bg-success/5">
        <ShieldCheck size={12} weight="fill" />
      </Badge>
    )
  }
  
  if (pregnancySafe === 'avoid' || kidSafe === 'avoid') {
    return (
      <motion.div
        animate={{ x: [-2, 2, -2, 2, 0] }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Badge variant="outline" className="gap-1 border-destructive text-destructive bg-destructive/10">
          <X size={12} weight="bold" />
        </Badge>
      </motion.div>
    )
  }
  
  return (
    <Badge variant="outline" className="gap-1 border-warning text-warning bg-warning/10">
      <ShieldWarning size={12} />
    </Badge>
  )
}
