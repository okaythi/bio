import { motion } from 'framer-motion';

export default function LoadingSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-hero" />
      <div className="skeleton-row-title" />
      <div className="skeleton-row">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div 
            key={i}
            className="skeleton-card"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}
