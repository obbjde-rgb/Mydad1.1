import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const Octagram = () => {
  const [isGlowing, setIsGlowing] = useState(false);
  
  const points = [
    { name: "الله جل جلاله", pos: "top" },
    { name: "جبريل عليه السلام", pos: "top-right" },
    { name: "محمد صلى الله عليه وسلم", pos: "top-left" },
    { name: "أبو بكر الصديق", pos: "right" },
    { name: "عمر بن الخطاب", pos: "bottom-right" },
    { name: "عثمان بن عفان", pos: "bottom" },
    { name: "علي بن أبي طالب", pos: "bottom-left" },
    { name: "الحسن والحسين", pos: "left" },
  ];

  return (
    <motion.div 
      className="relative w-40 h-40 flex items-center justify-center cursor-pointer group"
      onClick={() => setIsGlowing(!isGlowing)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Dynamic Glow Background */}
      <AnimatePresence>
        {isGlowing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: [0.4, 0.7, 0.4], 
              scale: [1, 1.3, 1],
              rotate: [0, 90, 180, 270, 360]
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute inset-0 bg-gradient-to-tr from-amber-400 via-orange-500 to-yellow-300 blur-2xl rounded-full -z-10 opacity-50"
          />
        )}
      </AnimatePresence>

      {/* Octagram shape layers */}
      <motion.div 
        animate={isGlowing ? { rotate: 405, scale: 1.1 } : { rotate: 45, scale: 1 }}
        className="absolute w-24 h-24 border-2 border-amber-600/60 rounded-sm shadow-lg shadow-amber-500/20"
      ></motion.div>
      <motion.div 
        animate={isGlowing ? { rotate: 360, scale: 1.1 } : { rotate: 0, scale: 1 }}
        className="absolute w-24 h-24 border-2 border-amber-600/60 rounded-sm shadow-lg shadow-amber-500/20"
      ></motion.div>
      
      {/* Central point - The "Heart" */}
      <motion.div 
        animate={isGlowing ? { 
          scale: [1, 1.5, 1],
          backgroundColor: ["#d97706", "#fbbf24", "#d97706"],
          boxShadow: ["0 0 10px #d97706", "0 0 30px #fbbf24", "0 0 10px #d97706"]
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute w-6 h-6 bg-amber-600 rounded-full z-10"
      ></motion.div>

      {/* Decorative Particles when glowing */}
      {isGlowing && [...Array(8)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ 
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            x: Math.cos(i * Math.PI / 4) * 60,
            y: Math.sin(i * Math.PI / 4) * 60
          }}
          transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
          className="absolute w-2 h-2 bg-amber-400 rounded-full blur-[1px]"
        />
      ))}

      {points.map((p, i) => (
        <motion.div 
          key={i} 
          animate={isGlowing ? { 
            y: [0, -5, 0],
            color: ["#78350f", "#b45309", "#78350f"]
          } : {}}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.1 }}
          className={`absolute text-amber-900 dark:text-amber-100 text-[10px] font-kufi font-bold whitespace-nowrap z-20 ${getPosClass(p.pos)}`}
        >
          {p.name}
        </motion.div>
      ))}
    </motion.div>
  );
};

const getPosClass = (pos: string) => {
  switch (pos) {
    case "top": return "-top-8";
    case "top-right": return "-top-4 -right-14";
    case "top-left": return "-top-4 -left-14";
    case "right": return "-right-16";
    case "bottom-right": return "-bottom-4 -right-14";
    case "bottom": return "-bottom-8";
    case "bottom-left": return "-bottom-4 -left-14";
    case "left": return "-left-16";
    default: return "";
  }
};
