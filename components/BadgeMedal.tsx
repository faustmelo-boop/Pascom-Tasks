import React from 'react';
import { motion } from 'framer-motion';
import { 
  Camera, Tv, Feather, Palette, Film, Mic, Award, Heart, Star, Check
} from 'lucide-react';
import { Badge } from '../types';

interface BadgeMedalProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  animate?: boolean;
}

export const getBadgeSpecs = (id: string) => {
  switch (id) {
    case 'mestre_lentes':
      return {
        icon: Camera,
        metalStyle: 'bg-gradient-to-tr from-cyan-600 via-blue-400 to-cyan-200 border-cyan-300 shadow-blue-500/25',
        ribbonColors: 'from-blue-600 to-cyan-500',
        label: 'Platina',
      };
    case 'conexao_divina':
      return {
        icon: Tv,
        metalStyle: 'bg-gradient-to-tr from-emerald-600 via-teal-400 to-emerald-200 border-emerald-300 shadow-emerald-500/25',
        ribbonColors: 'from-emerald-600 to-teal-500',
        label: 'Esmeralda',
      };
    case 'pena_ouro':
      return {
        icon: Feather,
        metalStyle: 'bg-gradient-to-tr from-amber-600 via-orange-400 to-amber-200 border-amber-300 shadow-orange-500/25',
        ribbonColors: 'from-amber-500 to-orange-500',
        label: 'Bronze Real',
      };
    case 'estetica_dom':
      return {
        icon: Palette,
        metalStyle: 'bg-gradient-to-tr from-purple-600 via-fuchsia-400 to-purple-250 border-purple-300 shadow-fuchsia-500/25',
        ribbonColors: 'from-purple-600 to-fuchsia-500',
        label: 'Ametista',
      };
    case 'guardiao_historias':
      return {
        icon: Film,
        metalStyle: 'bg-gradient-to-tr from-indigo-600 via-indigo-400 to-cyan-300 border-indigo-300 shadow-indigo-500/25',
        ribbonColors: 'from-indigo-600 to-cyan-500',
        label: 'Safira',
      };
    case 'voz_pastoral':
      return {
        icon: Mic,
        metalStyle: 'bg-gradient-to-tr from-rose-600 via-pink-400 to-rose-250 border-rose-300 shadow-pink-500/25',
        ribbonColors: 'from-rose-600 to-pink-500',
        label: 'Rubi',
      };
    case 'servo_dedicado':
      return {
        icon: Award,
        metalStyle: 'bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-200 border-amber-300 shadow-yellow-500/25',
        ribbonColors: 'from-yellow-500 to-amber-500',
        label: 'Ouro Puro',
      };
    case 'coracao_pastoral':
      return {
        icon: Heart,
        metalStyle: 'bg-gradient-to-tr from-red-650 via-rose-500 to-rose-200 border-red-300 shadow-red-500/25',
        ribbonColors: 'from-red-600 to-rose-500',
        label: 'Coração de Ouro',
      };
    default:
      return {
        icon: Star,
        metalStyle: 'bg-gradient-to-tr from-slate-550 via-slate-400 to-slate-200 border-slate-350 shadow-slate-500/25',
        ribbonColors: 'from-slate-500 to-slate-400',
        label: 'Clássico',
      };
  }
};

export const BadgeMedal: React.FC<BadgeMedalProps> = ({ 
  badge, 
  size = 'md', 
  className = '', 
  animate = true 
}) => {
  const specs = getBadgeSpecs(badge.id);
  const IconComponent = specs.icon;

  if (size === 'sm') {
    // Elegant, super-compact profile/card pin medal style
    return (
      <div 
        className={`relative flex items-center justify-center shrink-0 group ${className}`}
        style={{ width: '28px', height: '28px' }}
      >
        {/* Ribbon back layer for visual texture */}
        <div className={`absolute -bottom-0.5 w-1.5 h-3 bg-gradient-to-b ${specs.ribbonColors} rounded-b-[1px] transform -rotate-12 opacity-80`} />
        <div className={`absolute -bottom-0.5 w-1.5 h-3 bg-gradient-to-b ${specs.ribbonColors} rounded-b-[1px] transform rotate-12 opacity-80`} />

        {/* Outer Ring */}
        <div className={`w-6 h-6 rounded-full ${specs.metalStyle} p-[1px] border shadow-xs flex items-center justify-center z-10 transition-transform duration-300 group-hover:scale-110 active:scale-95 cursor-help`}>
          {/* Inner Core */}
          <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white p-[2px]">
            <IconComponent size={10} strokeWidth={2.5} className="text-white" />
          </div>
        </div>
      </div>
    );
  }

  if (size === 'md') {
    // Standard beautifully detailed medium medal style (e.g. for detail dialog lists)
    return (
      <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
        {/* Satin Ribbons Hanging Down */}
        <div className="absolute -bottom-3 flex justify-center gap-1 z-0">
          <div className={`w-3.5 h-6 bg-gradient-to-b ${specs.ribbonColors} rounded-b-sm transform -rotate-12 origin-top shadow-[0_2px_4px_rgba(0,0,0,0.1)]`} />
          <div className={`w-3.5 h-6 bg-gradient-to-b ${specs.ribbonColors} rounded-b-sm transform rotate-12 origin-top shadow-[0_2px_4px_rgba(0,0,0,0.1)]`} />
        </div>

        {/* Polished Embossed Metal Frame */}
        <div className={`w-12 h-12 rounded-full ${specs.metalStyle} p-[2px] border-2 shadow-[0_4px_10px_rgba(0,0,0,0.1)] flex items-center justify-center z-10 relative overflow-hidden group`}>
          {/* Diagonal sheen shine reflection sweep */}
          <div className="absolute inset-0 w-2/3 h-full bg-white/20 transform -skew-x-[25deg] -translate-x-[110%] group-hover:animate-[shine_0.8s_ease-out_infinite_alternate]" style={{ animationDelay: '0.1s' }} />
          
          {/* Circular inner shadow core */}
          <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-white p-2">
            <IconComponent size={18} strokeWidth={2.5} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]" />
          </div>
        </div>

        {/* Star Spark pins */}
        <div className="absolute -top-1 -right-1 text-yellow-300/40 blur-[0.2px] hover:text-yellow-300 pointer-events-none">
          <span className="text-[10px]">✨</span>
        </div>
      </div>
    );
  }

  // Large medal (perfect for profile showcases and highlighted medals)
  const Container = animate ? motion.div : 'div';
  
  return (
    <Container
      {...(animate ? {
        whileHover: { scale: 1.03, y: -4 },
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      } : {})}
      className={`relative flex flex-col items-center justify-center select-none p-6 bg-slate-50 border border-slate-150 rounded-[2.2rem] hover:bg-white hover:shadow-xl transition-all duration-300 overflow-hidden ${className}`}
    >
      {/* Dynamic colorful neck header bar */}
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${specs.ribbonColors} opacity-90`} />

      {/* Satin Ribbons behind the Medallion */}
      <div className="absolute top-1/2 -translate-y-1 transform flex justify-center gap-2.5 z-0 pb-16">
        <div className={`w-6 h-16 bg-gradient-to-b ${specs.ribbonColors} rounded-b-md transform -rotate-12 origin-top shadow-[0_4px_8px_rgba(0,0,0,0.15)] opacity-90`} />
        <div className={`w-6 h-16 bg-gradient-to-b ${specs.ribbonColors} rounded-b-md transform rotate-12 origin-top shadow-[0_4px_8px_rgba(0,0,0,0.15)] opacity-90`} />
      </div>

      {/* Magnificent Layered Circular Pendant */}
      <div className={`w-20 h-20 rounded-full ${specs.metalStyle} p-[3px] border-2 shadow-[0_8px_20px_rgba(0,0,0,0.15)] flex items-center justify-center z-13 relative group/pendant cursor-help mb-5`}>
        {/* Dynamic diagonal sweeping glassy shimmer */}
        <div className="absolute inset-0 w-1/2 h-full bg-white/25 transform -skew-x-[25deg] -translate-x-[120%] group-hover/pendant:animate-[shine_0.8s_ease-out_1]" />
        
        {/* Embossed internal core rim */}
        <div className="w-full h-full rounded-full border border-white/20 bg-slate-950 flex items-center justify-center text-white p-3.5 shadow-inner">
          <IconComponent size={28} strokeWidth={2.5} className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
        </div>
      </div>

      {/* Metadata Labels */}
      <h4 className="font-black text-sm text-slate-850 tracking-tight leading-none mb-1 text-center select-none">{badge.name}</h4>
      <div className="flex items-center gap-1.5 mb-3.5">
        <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-[0.15em]">{specs.label}</span>
        <span className="text-[7px] text-slate-350">•</span>
        <span className="text-[8.5px] font-black text-amber-500 uppercase tracking-[0.15em] flex items-center gap-0.5">Selo de Honra</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed font-semibold select-none px-2 text-center">{badge.description}</p>
    </Container>
  );
};
