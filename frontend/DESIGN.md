<prompt>
<task>
Apply this visual style to the user's existing project. Inspect and preserve its stack, copy, routes, and behavior. Follow existing component and styling conventions. Treat framework, library, and page examples in these design instructions as illustrations; they do not require a stack change or new sections. Scope changes to the user's requested work.

Keep controls keyboard accessible, focus visible, and text legible. Preserve reading order, responsive behavior, and reduced-motion preferences. Verify actual states at the rendered width. The user's stack and content take precedence over illustrative implementation details.
</task>

<design-system>
# Red & White Minimalist (Airtel-Inspired)

## Identity

Use a continuous typographic grid in white, deep charcoal black, subtle off-white/light grey, and vibrant Airtel red. Large heavy headings, exposed rules, and a persistent index rail carry the composition. Keep content aligned across sections so the page reads as one organized, high-contrast document.

## Layout

Start with a twelve-column desktop grid. Give a broad opening statement about nine columns and a narrow supporting or action area the remainder. In later sections, reserve the first three columns for an index and section heading; begin the main reading and content matrix on the same fourth-column line.

Continue this rail through text, capabilities, and editorial images. Related steps and benefits can share a full red field (`#e40000`) with crisp white reading or a dark charcoal field (`#111111`). Comparisons can use equal ruled columns, and a closing statement can echo the opening's broad heading beside a narrow action area. Finish with a fully divided footer aligned to the same grid.

Choose the patterns that fit the brief. Their relationships matter more than a fixed number of sections, entries, or columns of sample content.

## Typography

Use Host Grotesk throughout, bound to "SwissMinimalistHost". Make display text heavy, tightly tracked, and close-set. The opening scale runs from 64px to 148px on wider layouts, with line height below one. Smaller headings remain forceful; paragraphs use a lighter weight and enough leading for sustained reading. Use plain small labels and numbers to make the index useful. Do not add a second decorative typeface.

## Color and surfaces

White (`#ffffff`) is the main ground; deep charcoal black (`#111111`) supplies primary ink and rules. Airtel Red (`#e40000`) serves as a primary identity and accent color—used for brand fields, primary call-to-action buttons, key index markers, and highlight states. A very pale red/rose surface tint (`#fff5f5`) or soft off-white (`#f8f9fa`) distinguishes supporting content areas.

Keep corners slightly refined or square, and dividing rules clearly visible. Content should connect through edges and shared alignment. Avoid unnecessary floating cards, drop shadows, translucent layers, and complex ornamental backgrounds.

## Components

Use structured rectangular controls with direct red, white, and dark charcoal states and a clearly visible focus outline. Airtel red marks and highlights can identify priority and action without degrading text legibility.

Features form a ruled matrix. Numbered steps share a continuous field instead of separate cards. If comparisons are needed, keep their columns equal and use a compact red flag or red border for the featured option. Selection must have its own readable state. Disclosures use strong horizontal rules and a simple open/close marker.

## Images

Use high-contrast editorial photographs or clean duo-tone crops. A desktop image series can use tall proportions and align its captions to the shared grid. Repeating a subject is optional; choose imagery that explains the customer's content. Keep details legible and use alternative text for meaningful subjects.

## Motion

Use immediate visual feedback. The design relies on type, alignment, and sharp color contrast rather than animated entrances, image drift, or eased control movement.

## Responsive behavior

At 1050px, editorial items can become image-and-text rows and numbered steps become a vertical sequence. At 700px, place the index rail above its content, stack the major grids and comparisons, and turn facts into readable rows. Change tall image crops to wider proportions where needed. Keep the rules and background fields continuous, with smaller gutters and two-column footer groups.

## Design limits

Preserve a clear hierarchy even when headings are large. Do not let display text collide with controls or run offscreen. Avoid decorative geometry, complex gradients, excessive contrast clutter, and artificial content added to fill the grid. The structure must adapt to the actual information.

## Authoritative tokens

| CSS variable | Value | Description |
| --- | --- | --- |
| --dp-color-ground | #ffffff | Primary background |
| --dp-color-ink | #111111 | Primary text & dark rules |
| --dp-color-surface | #fff5f5 | Pale red/soft tint surface background |
| --dp-color-accent | #e40000 | Airtel Signature Red accent & action color |
| --dp-color-accent-hover | #c00000 | Darker red for interactive hover states |
| --dp-color-muted | #666666 | Secondary text color |
| --dp-typography-face | "SwissMinimalistHost", Arial, sans-serif | Primary typeface |
| --dp-typography-body | 16px | Body copy size |
| --dp-typography-label | 12px | Label text size |
| --dp-typography-metadata | 14px | Metadata text size |
| --dp-typography-lead | 17px | Lead text size |
| --dp-typography-item-title | 24px | Section item title size |
| --dp-typography-regular | 400 | Regular weight |
| --dp-typography-strong | 700 | Bold weight |
| --dp-typography-display | 750 | Display weight |
| --dp-typography-label-tracking | 0.12em | Label letter spacing |
| --dp-typography-body-leading | 1.5 | Body line height |
| --dp-spacing-gutter | clamp(20px, 3.3333cqw, 64px) | Responsive grid spacing |
| --dp-radius-control | 0 | Corner radius |
| --dp-border-rule | 2px | Rule thickness |
| --dp-motion-feedback | 0s | Instant motion feedback |
</design-system>
</prompt>