import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  })

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
  pdf.save(`${filename}.pdf`)
}

export async function exportToImage(elementId: string, filename: string, format: 'png' | 'jpg') {
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  const quality = format === 'jpg' ? 0.95 : undefined

  const link = document.createElement('a')
  link.download = `${filename}.${format}`
  link.href = canvas.toDataURL(mimeType, quality)
  link.click()
}
