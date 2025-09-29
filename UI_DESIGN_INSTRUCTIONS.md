# UI Design Instructions

This file contains important UI design guidelines that must be followed for all future UI development in this project. **DO NOT DELETE THIS FILE** as it will be updated and referenced for all UI design decisions.

## Core UI Library

**Primary UI Library:** [Motion Primitives](https://motion-primitives.com/)

All UI components must be built using components from the Motion Primitives library whenever possible. This ensures consistency and high-quality animations throughout the application.

## Interaction Guidelines

### Micro-interactions
1. **Always implement micro-interactions** for better user experience
2. Use subtle animations for:
   - Button hover states
   - Form input focus states
   - Card interactions
   - Navigation transitions
   - Loading states
   - Success/error feedback

### Animation Principles
1. **Purposeful Motion** - Every animation should serve a purpose (feedback, guidance, or delight)
2. **Performance** - Keep animations lightweight and smooth (60fps target)
3. **Consistency** - Use consistent timing and easing across similar interactions
4. **Accessibility** - Respect user preferences for reduced motion

## Component Design Standards

### Buttons
- Use `motion.button` for all interactive buttons
- Implement hover, tap, and focus states
- Provide clear visual feedback on interaction
- Maintain consistent sizing and spacing

### Form Elements
- Use motion primitives for input fields
- Implement floating labels where appropriate
- Provide real-time validation feedback
- Use smooth transitions for error/success states

### Cards & Containers
- Apply subtle hover effects using motion primitives
- Use consistent shadow and border treatments
- Implement smooth expand/collapse animations
- Maintain proper spacing and alignment

### Navigation
- Use motion primitives for navigation elements
- Implement smooth page transitions
- Provide clear active/selected states
- Ensure mobile-responsive navigation patterns

## Color & Theme Guidelines

### Theme Preference
- **Default Theme:** Light theme (white background)
- **Theme Toggle:** Available but light theme should be default
- **Dark Mode:** Supported but not default

### Color Usage
- Follow established color palette in globals.css
- Ensure proper contrast ratios for accessibility
- Use consistent color meanings (e.g., red for errors, green for success)

## Typography Standards

### Font Choices
- Use system fonts for better performance
- Maintain consistent font hierarchy
- Implement proper line heights and spacing
- Ensure readability across devices

### Text Interactions
- Use motion primitives for text animations
- Implement smooth transitions for dynamic content
- Provide clear focus states for interactive text elements

## Responsive Design

### Breakpoints
- Mobile: 0px - 768px
- Tablet: 769px - 1024px
- Desktop: 1025px+

### Flexibility
- All components must be responsive
- Use relative units (%, em, rem) where appropriate
- Implement touch-friendly targets for mobile

## Accessibility Requirements

### WCAG Compliance
- Minimum contrast ratio of 4.5:1 for normal text
- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader compatibility

### Focus Management
- Visible focus indicators
- Logical tab order
- Skip navigation options
- Proper form labeling

## Performance Considerations

### Animation Performance
- Use CSS transforms and opacity for animations
- Avoid animating layout properties
- Implement requestAnimationFrame for complex animations
- Provide fallbacks for older browsers

### Loading States
- Implement skeleton screens where appropriate
- Use motion primitives for loading indicators
- Provide immediate feedback on user actions
- Show progress indicators for long operations

## Testing Guidelines

### Cross-browser Testing
- Test in latest Chrome, Firefox, Safari, and Edge
- Verify mobile browser compatibility
- Check performance on lower-end devices

### Interaction Testing
- Test all hover, tap, and focus states
- Verify keyboard navigation
- Test with assistive technologies
- Validate touch interactions on mobile

## Future Updates

This file will be updated as new UI patterns and guidelines are established. Always check this file before implementing any new UI components or making significant design changes.

**Last Updated:** 2025-09-28