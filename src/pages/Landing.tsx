import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WardBardLogo } from '@/components/WardBardLogo';
import { exampleQueries } from '@/lib/specialties';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
        {/* Animated Orb */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            className="w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full opacity-30"
            style={{
              background: 'radial-gradient(circle, hsl(168 100% 39% / 0.4), hsl(168 100% 39% / 0.05) 70%, transparent)',
              filter: 'blur(60px)',
            }}
            animate={{ scale: [1, 1.1, 1], y: [0, -15, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 text-center"
        >
          <div className="flex justify-center mb-8">
            <WardBardLogo size="lg" />
          </div>

          <motion.h1
            className="font-heading text-4xl md:text-6xl font-bold text-foreground mb-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            Evidence at the Bedside.
          </motion.h1>

          <motion.p
            className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            Instant, cited clinical answers for medical students and residents.
          </motion.p>

          <motion.button
            onClick={() => navigate('/chat')}
            className="px-8 py-3.5 bg-primary text-primary-foreground font-heading font-semibold text-lg rounded-full glow-pulse transition-all duration-150 hover:scale-105 active:scale-95"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.3 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Start Querying →
          </motion.button>
        </motion.div>
      </section>

      {/* Example Queries */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 pb-20">
        <h2 className="font-heading text-2xl font-bold text-foreground text-center mb-10">
          Example Questions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {exampleQueries.map((q, i) => (
            <motion.button
              key={i}
              className="glass-card p-4 text-left text-sm text-muted-foreground hover:text-foreground transition-all duration-150"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              whileHover={{ y: -4 }}
              onClick={() => navigate(`/chat?q=${encodeURIComponent(q)}`)}
            >
              "{q}"
            </motion.button>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section className="relative z-10 max-w-2xl mx-auto px-4 pb-12">
        <div className="glass-card p-5 text-center border border-primary/10">
          <p className="text-sm text-muted-foreground">
            📚 <span className="font-medium text-foreground/80">For educational purposes only.</span> Ward Bard is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider. We are not responsible for any clinical decisions made based on this tool.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 text-center">
        <p className="text-muted-foreground text-sm">
          Created by <span className="text-foreground font-medium">Ahmed Abdullah</span>
        </p>
        <div className="flex justify-center gap-6 mt-3">
          <button onClick={() => navigate('/about')} className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150">
            About
          </button>
          <button onClick={() => navigate('/chat')} className="text-sm text-muted-foreground hover:text-primary transition-colors duration-150">
            Chat
          </button>
        </div>
      </footer>
    </div>
  );
}
