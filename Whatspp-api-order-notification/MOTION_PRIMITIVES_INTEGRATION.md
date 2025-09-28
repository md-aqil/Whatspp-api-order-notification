# Motion Primitives Integration Guide

This guide explains how to integrate Motion Primitives into your existing UI with Tailwind CSS and Lucide React.

## Overview

Motion Primitives provides animated UI components that work seamlessly with Tailwind CSS. This integration includes:

- Text effect animations
- Reusable animated components
- Tailwind class merging utility
- Lucide React icons

## Installation

The required dependencies are already installed in your project:

- `motion` - Animation library
- `clsx` - Utility for constructing className strings
- `tailwind-merge` - Utility for merging Tailwind CSS classes
- `lucide-react` - Icon library

If you need to reinstall them:

```bash
npm install motion clsx tailwind-merge lucide-react
```

## Adding Motion Primitives Components

To add Motion Primitives components:

```bash
npx motion-primitives@latest add [component-name]
```

For example:
```bash
npx motion-primitives@latest add text-effect
```

## Components

### TextEffectWrapper

A reusable wrapper component for the TextEffect primitive that simplifies usage with Tailwind CSS.

**Props:**
- `text` (string) - The text to animate
- `className` (string) - Additional Tailwind classes
- `per` ("char" | "word" | "line") - How to segment the text (default: "word")
- `preset` ("blur" | "fade-in-blur" | "scale" | "fade" | "slide") - Animation preset (default: "fade")
- `delay` (number) - Delay before animation starts (default: 0)

**Usage:**
```jsx
import { TextEffectWrapper } from "@/components/TextEffectWrapper";

<TextEffectWrapper 
  text="Welcome to our store" 
  className="text-2xl font-bold text-blue-600"
  preset="fade"
  per="word"
/>
```

### TextEffect

The core TextEffect component from Motion Primitives with full customization options.

**Props:**
- `children` (string) - The text to animate
- `per` ("char" | "word" | "line") - How to segment the text
- `preset` ("blur" | "fade-in-blur" | "scale" | "fade" | "slide") - Animation preset
- Additional props for advanced customization

**Usage:**
```jsx
import { TextEffect } from "@/components/motion-primitives/text-effect";

<TextEffect per="word" preset="fade">
  Welcome to our store
</TextEffect>
```

## Available Presets

1. **blur** - Elements blur in while becoming visible
2. **fade-in-blur** - Elements fade in and blur in while moving up
3. **scale** - Elements scale up from 0 to full size
4. **fade** - Elements fade in
5. **slide** - Elements slide in from below

## Available Segmentation Options

1. **char** - Each character is animated individually
2. **word** - Each word is animated individually
3. **line** - Each line is animated individually

## Utility Functions

### cn()

A utility function for merging Tailwind CSS classes with clsx.

**Usage:**
```jsx
import { cn } from "@/lib/utils";

const className = cn("text-blue-500", "font-bold", conditionalClass && "underline");
```

## Example Implementation

```jsx
import { TextEffectWrapper } from "@/components/TextEffectWrapper";
import { ArrowRight } from "lucide-react";

export const HeroSection = () => {
  return (
    <section className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <TextEffectWrapper 
        text="Welcome to Vaclav Fashion" 
        className="text-4xl font-bold text-blue-600" 
      />
      <button className="mt-6 flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
        Explore <ArrowRight className="w-5 h-5" />
      </button>
    </section>
  );
};
```

## Best Practices

1. **Performance**: Use appropriate segmentation - "word" is often better than "char" for longer texts
2. **Accessibility**: Animated text includes screen reader support
3. **Responsive Design**: Use responsive Tailwind classes for different screen sizes
4. **Consistency**: Stick to a consistent set of presets throughout your application

## Troubleshooting

### Animation Not Working
- Ensure you're using the "use client" directive in client components
- Check that the text is passed as children, not as a prop
- Verify Tailwind classes are correctly applied

### Performance Issues
- Reduce the number of animated elements on a page
- Use "word" segmentation instead of "char" for long texts
- Consider using delay props to stagger animations

## Customization

You can customize animations by passing custom variants to the TextEffect component:

```jsx
import { TextEffect } from "@/components/motion-primitives/text-effect";

const customVariants = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
};

<TextEffect 
  per="word" 
  variants={customVariants}
>
  Custom animated text
</TextEffect>
```