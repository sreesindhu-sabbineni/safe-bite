import { useEffect, useRef, RefObject } from 'react'

interface UseBarcodeScannerOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  onDetected: (barcode: string) => void
  onError: (error: string) => void
}

declare global {
  interface Window {
    BarcodeDetector?: any
  }
}

export function useBarcodeScanner({ videoRef, onDetected, onError }: UseBarcodeScannerOptions) {
  const scanningRef = useRef(false)
  const detectorRef = useRef<any>(null)
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
      if ('BarcodeDetector' in window) {
        if (!detectorRef.current) {
          detectorRef.current = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
          })
        }

        scanningRef.current = true
        scanFrame()
      } else {
        onError('Barcode scanning not supported on this browser. Try using Chrome on Android or use manual barcode entry.')
      }
    } catch (error) {
      console.error('Failed to initialize barcode detector:', error)
      onError('Barcode scanning not supported on this device')
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
