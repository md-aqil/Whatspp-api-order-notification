'use client';

import { TextEffect } from "@/components/motion-primitives/text-effect";
import { cn } from "@/lib/utils";

const TextEffectWrapper = ({ text, className, per = "word", preset = "fade", delay = 0 }) => {
  return (
    <div className={cn("inline-block", className)}>
      <TextEffect 
        per={per} 
        preset={preset} 
        delay={delay}
      >
        {text}
      </TextEffect>
    </div>
  );
};

export { TextEffectWrapper };