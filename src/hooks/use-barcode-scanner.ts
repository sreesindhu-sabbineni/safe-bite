import { useEffect, useRef, RefObject } from 'react'
import { BarcodeDetector } from 'barcode-detector'

interface UseBarcodeScannerOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  onDetected: (barcode: string) => void
  onError: (error: string) => void
}

export function useBarcodeScanner({ videoRef, onDetected, onError }: UseBarcodeScannerOptions) {
  const scanningRef = useRef(false)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const scanFrame = async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) {
      return
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current)
      
      if (barcodes && barcodes.length > 0) {
        const barcode = barcodes[0]
        if (barcode.rawValue) {
          scanningRef.current = false
          onDetected(barcode.rawValue)
          return
        }
      }
    } catch (error) {
      console.error('Barcode detection error:', error)
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame)
    }
  }

  const startScanning = async () => {
    try {
      if (!detectorRef.current) {
        detectorRef.current = new BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        })
      }

      scanningRef.current = true
      scanFrame()
    } catch (error) {
      console.error('Failed to initialize barcode detector:', error)
      onError('Failed to initialize barcode scanner. Please use manual barcode entry.')
    }
  }

  const stopScanning = () => {
    scanningRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  return { startScanning, stopScanning }
}
