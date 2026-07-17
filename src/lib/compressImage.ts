const MAX_WIDTH = 1920
const QUALITY = 0.8

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width)
        width = MAX_WIDTH
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        QUALITY
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

const AVATAR_SIZE = 400
const AVATAR_QUALITY = 0.85

// Skaliert und beschneidet auf ein Quadrat — für kleine Rund-Icons (z.B. Profilbilder),
// wo die volle Auflösung aus compressImage() unnötig groß wäre und Ladezeiten verzögert.
export async function compressAvatar(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img
      const cropSize = Math.min(width, height)
      const sx = (width - cropSize) / 2
      const sy = (height - cropSize) / 2

      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      canvas.getContext('2d')!.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE)

      canvas.toBlob(
        blob => {
          if (!blob) { resolve(file); return }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        AVATAR_QUALITY
      )
    }

    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
