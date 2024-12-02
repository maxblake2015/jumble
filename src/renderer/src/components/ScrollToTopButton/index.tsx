import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ScrollToTopButton({
  scrollAreaRef,
  className
}: {
  scrollAreaRef: React.RefObject<HTMLDivElement>
  className?: string
}) {
  const [showScrollToTop, setShowScrollToTop] = useState(false)

  const handleScrollToTop = () => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleScroll = () => {
    if (scrollAreaRef.current) {
      setShowScrollToTop(scrollAreaRef.current.scrollTop > 600)
    }
  }

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    scrollArea?.addEventListener('scroll', handleScroll)
    return () => {
      scrollArea?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <Button
      variant="secondary-2"
      className={cn(
        `absolute bottom-8 right-2 rounded-full w-10 h-10 p-0 hover:text-background transition-transform ${showScrollToTop ? '' : 'translate-y-20'}`,
        className
      )}
      onClick={handleScrollToTop}
    >
      <ChevronUp />
    </Button>
  )
}
