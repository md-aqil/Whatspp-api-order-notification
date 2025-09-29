---
trigger: auto
---

# Project Rules

## Rule 1: Always Use Port 3000
**Default Port:** Always use port 3000 for development servers

**Port Conflict Resolution:** Before starting development, check if port 3000 is occupied using `lsof -i tcp:3000`

**Kill Process Command:** Use `npx kill-port 3000` to terminate any existing processes on port 3000

**Alternative Method:** For stubborn processes, use `killall -9 node` to terminate all Node.js processes

**Verification:** After killing processes, verify port availability before running `npm run dev`

## Rule 2: Component Library First Approach
**Check Before Creating:** Always visit motion-primitives.com/docs before creating any new component

**Available Components:** Prioritize using existing Motion-Primitives components like Magnetic, Text Effect, and Cursor

**Installation Command:** Use `npx motion-primitives@latest add [component-name]` for component installation

**Component API:** Follow the documented prop structure and API guidelines for each component

**Customization:** Modify existing components using Tailwind CSS classes and Motion spring configurations

## Rule 3: Micro-Interactions Implementation
**Purpose-Driven Design:** Every micro-interaction must serve a specific user need (feedback, progress, confirmation)

**Immediate Feedback:** Provide instant visual feedback for all user actions within 100ms

**Simplicity Principle:** Keep micro-interactions subtle and non-distracting

**Consistency:** Maintain uniform animation timing and easing across all components

**Performance:** Use Motion's declarative animation props (initial, animate, exit) for optimal performance

## Component Creation Workflow
**Research Phase:** Check Motion-Primitives documentation for existing solutions

**Selection Phase:** Choose appropriate components from the library

**Integration Phase:** Install using the provided CLI command

**Customization Phase:** Adapt components to match WhatsApp Commerce Hub design system

**Testing Phase:** Verify micro-interactions work smoothly across devices

## Micro-Interaction Categories for Your Project
**Chat Interface:** Message send animations, typing indicators, message status updates

**Product Catalog:** Hover effects on product cards, loading animations for catalog sharing

**Order Management:** Progress indicators, confirmation animations, status transitions

**Dashboard Navigation:** Button hover states, sidebar collapse animations, theme toggle effects

## Performance Considerations
**Spring Configuration:** Use Motion-Primitives' default SPRING_CONFIG for consistency

**Animation Intensity:** Keep magnetic effects at default intensity (0.6) for natural feel

**Range Settings:** Use appropriate range values for interactive components (default: 100px)

**Server-Side Rendering:** Ensure Motion components are SSR-compatible for Next.js

## Quality Assurance Rules
**User Testing:** Test all micro-interactions with real users before deployment

**Browser Compatibility:** Verify animations work across different browsers and devices

**Accessibility:** Ensure animations respect user preferences for reduced motion

**Brand Alignment:** Match micro-interactions with your WhatsApp Commerce Hub brand guidelines