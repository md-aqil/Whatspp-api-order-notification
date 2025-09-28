# Motion Primitives Usage Guide

This guide explains how to use Motion Primitives in your WhatsApp Commerce Hub application.

## Available Pages

1. **Main Dashboard** - The main application page now includes a link to the Motion Primitives demo
2. **Motion Demo** - `/motion-demo` - Interactive demo showcasing all text effects
3. **Motion Test** - `/motion-test` - Simple test page to verify installation

## Components

### TextEffectWrapper

A simplified wrapper around the TextEffect component for easier usage:

```jsx
import { TextEffectWrapper } from "@/components/TextEffectWrapper";

<TextEffectWrapper 
  text="Welcome to our store" 
  className="text-2xl font-bold text-blue-600"
  preset="fade"
  per="word"
/>
```

**Props:**
- `text` (string) - The text to animate
- `className` (string) - Additional Tailwind classes
- `preset` ("blur" | "fade-in-blur" | "scale" | "fade" | "slide") - Animation preset
- `per` ("char" | "word" | "line") - How to segment the text
- `delay` (number) - Delay before animation starts

### TextEffect

The full-featured TextEffect component from Motion Primitives:

```jsx
import { TextEffect } from "@/components/motion-primitives/text-effect";

<TextEffect 
  preset="slide" 
  per="word"
  className="text-2xl font-bold text-green-600"
>
  Welcome to our store
</TextEffect>
```

## Animation Presets

1. **fade** - Elements fade in
2. **slide** - Elements slide in from below
3. **scale** - Elements scale up from 0
4. **blur** - Elements blur in while becoming visible
5. **fade-in-blur** - Elements fade and blur in while moving up

## Segmentation Options

1. **char** - Each character is animated individually
2. **word** - Each word is animated individually
3. **line** - Each line is animated individually

## Example Usage in WhatsApp Context

```jsx
// In a product catalog
<TextEffectWrapper 
  text="New Summer Collection" 
  className="text-3xl font-bold text-amber-600"
  preset="scale"
/>

// In an order confirmation
<TextEffectWrapper 
  text="Order Confirmed!" 
  className="text-2xl font-bold text-green-600"
  preset="fade-in-blur"
/>

// In a campaign message
<TextEffectWrapper 
  text="Special Offer - 30% Off" 
  className="text-xl font-bold text-red-600"
  preset="blur"
/>
```

## Customization

You can customize animations by passing custom variants:

```jsx
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

<TextEffect variants={customVariants} per="word">
  Custom animated text
</TextEffect>
```

## Performance Tips

1. Use "word" segmentation instead of "char" for longer texts
2. Limit the number of animated elements on a page
3. Use delay props to stagger animations
4. Consider using conditional rendering to only animate visible elements