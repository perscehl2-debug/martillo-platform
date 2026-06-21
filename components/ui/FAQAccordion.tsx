'use client'
import { useState } from 'react'

interface FAQItem { q: string; a: string }

function FAQItem({ q, a }: FAQItem) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-white/6 rounded-lg overflow-hidden hover:border-white/10 transition-colors">
      <button onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-7 py-5 text-left gap-4"
        aria-expanded={open}>
        <span className={`font-medium text-sm md:text-base leading-snug transition-colors ${open ? 'text-amber-400' : 'text-white'}`}>
          {q}
        </span>
        <span className={`flex-shrink-0 w-5 h-5 border rounded-full flex items-center justify-center transition-all ${open ? 'border-amber-500 bg-amber-500/10' : 'border-white/20'}`}>
          <span className={`text-xs font-bold leading-none transition-transform block ${open ? 'text-amber-400 rotate-45' : 'text-white/40'}`}>+</span>
        </span>
      </button>
      {open && (
        <div className="px-7 pb-6 border-t border-white/5">
          <p className="text-gray-400 text-sm leading-relaxed pt-5">{a}</p>
        </div>
      )}
    </div>
  )
}

export function FAQAccordion({ items }: { items: FAQItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => <FAQItem key={item.q} {...item} />)}
    </div>
  )
}
