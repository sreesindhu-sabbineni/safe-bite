import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ScoreGaugeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}

export function ScoreGauge({ score, size = 'lg', animate = true }: ScoreGaugeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-accent'
    if (score >= 40) return 'text-warning'
    return 'text-destructive'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
  }

  const getStrokeColor = (score: number) => {
    if (score >= 70) return 'oklch(0.55 0.16 165)'
    if (score >= 40) return 'oklch(0.78 0.15 75)'
    return 'oklch(0.55 0.22 25)'
  }

  const sizes = {
    sm: { radius: 40, stroke: 6, fontSize: 'text-2xl', label: 'text-xs' },
    md: { radius: 60, stroke: 8, fontSize: 'text-3xl', label: 'text-sm' },
    lg: { radius: 80, stroke: 10, fontSize: 'text-5xl', label: 'text-base' }
  }

  const { radius, stroke, fontSize, label } = sizes[size]
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={(radius + stroke) * 2}
        height={(radius + stroke) * 2}
        className="transform -rotate-90"
      >
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          stroke="oklch(0.90 0.01 200)"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          stroke={getStrokeColor(score)}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
          animate={{ strokeDashoffset: offset }}
          transition={{
            duration: 1.2,
            ease: [0.34, 1.56, 0.64, 1]
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          className={cn('font-bold tracking-tight', fontSize, getScoreColor(score))}
          initial={animate ? { opacity: 0, scale: 0.5 } : {}}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          {score}
        </motion.div>
        <motion.div
          className={cn('font-medium text-muted-foreground', label)}
          initial={animate ? { opacity: 0 } : {}}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1 }}
        >
          {getScoreLabel(score)}
        </motion.div>
      </div>
    </div>
  )
}
