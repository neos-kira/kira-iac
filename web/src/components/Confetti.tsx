/**
 * 合格演出用の紙吹雪（Confetti）
 */
export function Confetti() {
  const colors = ['#2dd4bf', '#5eead4', '#99f6e4', '#0ea5e9', '#0d9488', '#ec4899', '#f43f5e']
  const count = 50
  const items = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 1.5,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 8,
  }))

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute top-0 rounded-sm animate-confetti-fall"
          style={{
            left: item.left,
            width: item.size,
            height: item.size * 0.6,
            backgroundColor: item.color,
            animationDelay: `${item.delay}s`,
            animationDuration: `${item.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
