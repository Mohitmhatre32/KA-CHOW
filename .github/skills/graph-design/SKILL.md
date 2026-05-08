---
name: graph-design
description: 'Workflow and guidelines for designing and improving the D3/SVG Knowledge Graph UI. Use this skill when modifying graph-view.tsx, adding node types, improving edge rendering, or enhancing the cyber-engineering visual aesthetic of the topology graph.'
---

# KA-CHOW Graph Design Guidelines

## When to Use
- Modifying the `GraphView` component or D3 simulation logic.
- Enhancing the node, edge, or background aesthetics of the SVG graph.
- Implementing glassmorphism, glow effects, or cyber-engineering UI styles for data visualization.

## Procedure & Aesthetic Rules
The graph must look like a modern, developer-friendly "Cyber-IDE" topology map, not a generic D3 circle map.

1. **Canvas & Background**:
   - Maintain a dark, high-contrast canvas (`bg-background` / #030303).
   - Use subtle grid or dot patterns for the background to give a "blueprint" or "radar" feel.

2. **Nodes (The "Entities")**:
   - Avoid plain, boring SVG circles if possible, or heavily style them with strokes, drop-shadows (glows), and varying opacities.
   - Use the semantic `typeColors` to clearly differentiate entity types (Modules, APIs, Components, Hooks).
   - Nodes should have a subtle pulse or glow when active, hovered, or under maintenance.
   - Icons within nodes must be perfectly centered and readable.

3. **Edges (The "Connections")**:
   - Prefer curved lines (e.g., bezier curves or path links) over harsh straight lines if it improves readability.
   - Use dashed or animated lines (`strokeDasharray`) to indicate data flow or relationships.
   - Edges should dim (low opacity) when a node is selected, highlighting only the direct connections to the selected node ("focus mode").

4. **Interactivity & Developer UX**:
   - Provide smooth panning and zooming (already utilizing viewBox standard).
   - Show a detailed, glassmorphism-styled Info Panel when a node is clicked.
   - Ensure labels are readable: Use `JetBrains Mono` or high-contrast sans-serif for node labels.

## Quality Criteria & Review Checklist
- [ ] Nodes are visually distinct and match the semantic color tokens.
- [ ] Active/Selected states create a clear glowing path, dimming unrelated nodes.
- [ ] Edges do not clutter the view (opacity management).
- [ ] Text rendering on the SVG canvas is crisp and uses developer-friendly typography.
- [ ] Graph layout initializes smoothly without "blooming" explosively.