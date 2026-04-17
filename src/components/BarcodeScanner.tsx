import { useState, useRef, useEffect } from 'react'
import { Camera, X, CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { useBarcodeScanner } from '@/hooks/use-barcode-scanner'

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onBarcodeDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(true)
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const { startScanning, stopScanning } = useBarcodeScanner({
    videoRef,
    onDetected: (barcode) => {
      setDetectedBarcode(barcode)
      setIsScanning(false)
      setTimeout(() => {
        onBarcodeDetected(barcode)
      }, 1000)
    },
    onError: (error) => {
      toast.error(error)
      onClose()
    }
  })

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          await videoRef.current.play()
          startScanning()
        }
      } catch (error) {
        console.error('Camera access error:', error)
        toast.error('Unable to access camera. Please check permissions.')
        onClose()
      }
    }

    initCamera()

    return () => {
      stopScanning()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background"
    >
      <div className="relative h-full w-full">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />
        
        <canvas ref={canvasRef} className="hidden" />

        <div className="absolute inset-0 flex flex-col items-center justify-between p-6">
          <div className="w-full flex items-center justify-between">
            <h2 className="text-xl font-bold text-white drop-shadow-lg">
              Scan Barcode
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X size={24} />
            </Button>
          </div>

          <div className="relative">
            <div className="relative w-72 h-48 border-4 border-white/80 rounded-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary" />
              
              <AnimatePresence>
                {isScanning && (
                  <motion.div
                    className="absolute w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
                    initial={{ top: 0 }}
                    animate={{ top: '100%' }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'linear'
                    }}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {detectedBarcode && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-success/90"
                  >
                    <CheckCircle size={64} weight="fill" className="text-white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <Card className="w-full max-w-md">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {isScanning
                  ? 'Position the barcode within the frame'
                  : detectedBarcode
                  ? `Detected: ${detectedBarcode}`
                  : 'Processing...'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
