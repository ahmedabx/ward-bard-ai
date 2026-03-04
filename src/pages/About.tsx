import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { WardBardLogo } from '@/components/WardBardLogo';
import { ArrowLeft } from 'lucide-react';

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors duration-150">
          <ArrowLeft size={20} />
        </button>
        <WardBardLogo size="sm" />
      </header>

      <div className="max-w-2xl mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="font-heading text-3xl font-bold text-foreground mb-4">About Ward Bard</h1>

          <div className="glass-card p-6 mb-8">
            <p className="text-lg text-primary font-heading font-semibold mb-3">
              Ward Bard is free. Forever.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Ward Bard is an evidence-based clinical decision-support tool designed for medical students
              and residents, especially those in low- and middle-income countries. It provides instant,
              cited answers structured around clinical assessments, management plans, and key points —
              all referencing real textbooks, journals, and guidelines.
            </p>
          </div>

          <div className="glass-card p-6 mb-8">
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              To democratize access to clinical knowledge at the point of care. No paywalls, no
              subscriptions. Just fast, reliable, evidence-based answers when you need them most.
            </p>
          </div>

          <div className="glass-card p-6">
            <h2 className="font-heading text-xl font-semibold text-foreground mb-3">Team</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-heading font-bold text-lg">
                A
              </div>
              <div>
                <p className="text-foreground font-medium">Ahmed Abdullah</p>
                <p className="text-sm text-muted-foreground">Creator & Developer</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
