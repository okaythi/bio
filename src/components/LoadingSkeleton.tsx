import { motion } from 'framer-motion';

export default function LoadingSkeleton() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <motion.div 
      className="skeleton-container"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div className="skeleton-hero" variants={itemVariants} />
      <motion.div className="skeleton-row-title" variants={itemVariants} />
      <motion.div className="skeleton-row" variants={itemVariants}>
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div 
            key={i}
            className="skeleton-card"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
