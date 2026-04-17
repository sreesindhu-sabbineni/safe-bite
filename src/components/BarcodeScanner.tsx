import { useState, useRef, useEffect } from 'react'
import { Camera, X, CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onBarcodeDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(true)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)
  const detectedRef = useRef(false)

  useEffect(() => {
    let mounted = true

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('barcode-scanner-region')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.777,
          },
          (decodedText) => {
            if (detectedRef.current) return
            detectedRef.current = true
            setDetectedBarcode(decodedText)
            setIsScanning(false)
            toast.success(`Barcode detected: ${decodedText}`)
            setTimeout(() => {
              onBarcodeDetected(decodedText)
            }, 800)
          },
          () => {
            // Scan failure — expected on every frame without barcode, ignore
          }
        )

        if (mounted) setCameraReady(true)
      } catch (error) {
        console.error('Scanner error:', error)
        // Try fallback: any camera
        try {
          const devices = await Html5Qrcode.getCameras()
          if (devices.length === 0) throw new Error('No cameras')
          
          const scanner = scannerRef.current || new Html5Qrcode('barcode-scanner-region')
          scannerRef.current = scanner

          await scanner.start(
            devices[0].id,
            {
              fps: 10,
              qrbox: { width: 280, height: 180 },
            },
            (decodedText) => {
              if (detectedRef.current) return
              detectedRef.current = true
              setDetectedBarcode(decodedText)
              setIsScanning(false)
              toast.success(`Barcode detected: ${decodedText}`)
              setTimeout(() => {
                onBarcodeDetected(decodedText)
              }, 800)
            },
            () => {}
          )

          if (mounted) setCameraReady(true)
        } catch (fallbackError) {
          console.error('Camera fallback error:', fallbackError)
          if (mounted) {
            const msg = 'Unable to access camera. Please allow camera permission and ensure a camera is connected.'
            setCameraError(msg)
            toast.error(msg)
          }
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current.clear()
      }
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black"
    >
      <div className="relative h-full w-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/80 z-10">
          <h2 className="text-xl font-bold text-white">
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

        {/* Camera view - html5-qrcode renders here */}
        <div className="flex-1 relative overflow-hidden">
          <div id="barcode-scanner-region" className="h-full w-full" />
          
          <AnimatePresence>
            {detectedBarcode && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-green-500/80 z-20"
              >
                <div className="text-center text-white">
                  <CheckCircle size={64} weight="fill" className="mx-auto mb-2" />
                  <p className="text-lg font-bold">Barcode Detected!</p>
                  <p className="text-sm opacity-90">{detectedBarcode}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom status */}
        <div className="p-4 bg-black/80">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="p-4 text-center">
              {cameraError ? (
                <div className="space-y-3">
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Go Back
                  </Button>
                </div>
              ) : !cameraReady ? (
                <div className="space-y-2">
                  <Camera size={24} className="mx-auto animate-pulse text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Starting camera...</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isScanning
                    ? 'Point your camera at a barcode'
                    : `Detected: ${detectedBarcode}`}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  )
}
