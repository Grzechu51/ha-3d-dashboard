import { type CSSProperties, forwardRef, type ImgHTMLAttributes, type SyntheticEvent } from 'react'

type StaticImageDataLike = Readonly<{
  src: string
  width?: number
  height?: number
  blurDataURL?: string
}>

type StaticRequireLike = Readonly<{
  default: StaticImageDataLike
}>

type PortableImageSource = string | StaticImageDataLike | StaticRequireLike

type PortableImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: PortableImageSource
  fill?: boolean
  priority?: boolean
  quality?: number | `${number}`
  unoptimized?: boolean
  placeholder?: string
  blurDataURL?: string
  loader?: unknown
  onLoadingComplete?: (image: HTMLImageElement) => void
}

function resolveImageSource(src: PortableImageSource): string {
  if (typeof src === 'string') return src
  if ('default' in src) return src.default.src
  return src.src
}

export default forwardRef<HTMLImageElement, PortableImageProps>(function PortableNextImage(
  {
    src,
    alt = '',
    fill = false,
    priority = false,
    quality: _quality,
    unoptimized: _unoptimized,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    loader: _loader,
    onLoadingComplete,
    onLoad,
    style,
    loading,
    ...imgProps
  },
  ref,
) {
  const fillStyle: CSSProperties | undefined = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }
    : style

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    onLoad?.(event)
    onLoadingComplete?.(event.currentTarget)
  }

  return (
    <img
      {...imgProps}
      alt={alt}
      loading={priority ? 'eager' : loading}
      onLoad={handleLoad}
      ref={ref}
      src={resolveImageSource(src)}
      style={fillStyle}
    />
  )
})
