---
name: pine-script-design
description: Create distinctive, production-grade TradingView indicators and strategies with exceptional visual design quality. Use this skill when the user asks to build Pine Script indicators, strategies, charting tools, or visualization systems. Generates creative, polished code that avoids generic indicator aesthetics and elevates chart visualization to an art form.
source: adapted-for-pine-script
license: Apache-2.0
---

This skill guides creation of distinctive, production-grade Pine Script visualizations that avoid generic "default indicator" aesthetics. Implement real working code with exceptional attention to visual hierarchy, color theory, and creative chart presentation.

The user provides trading indicator requirements: an indicator, strategy, or visualization system to build. They may include context about the trading style, market conditions, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD visual direction:

- **Purpose**: What trading insight does this visualization reveal? Who is the trader (scalper, swing trader, investor)?
- **Tone**: Pick an extreme: brutalist/minimalist, futuristic/holographic, organic/flowing, luxury/refined, retro/8-bit, editorial/data-journalism, industrial/utilitarian, artistic/abstract, etc.
- **Constraints**: Pine Script version (v4/v5), performance limits, TradingView platform limitations.
- **Differentiation**: What makes this visualization UNFORGETTABLE? What's the one visual element someone will remember?

**CRITICAL**: Choose a clear visual concept and execute it with precision. Bold, information-dense displays and refined, minimal signals both work - the key is intentional visual communication, not default styling.

Then implement working Pine Script code that is:

- Production-grade and performant
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every visual detail

## Pine Script Aesthetics Guidelines

Focus on:

- **Color Theory**: Create intentional color palettes that convey meaning. Use color gradients for intensity, complementary colors for opposing signals, and harmonious schemes for related data. Avoid default red/green - consider colorblind-friendly alternatives like blue/orange or purple/yellow.
- **Visual Hierarchy**: Design information layers. Primary signals should dominate visually, secondary context should recede. Use opacity, line weight, and z-index strategically.
- **Typography & Labels**: When using `plotshape` or `label.new`, choose fonts and styles that match your aesthetic. Avoid default sans-serif for everything - consider monospace for data, serif for commentary.
- **Chart Integration**: Design indicators that complement price action rather than obscure it. Use background colors (`bgcolor`) with low opacity, plot behind price (`display=display.none`), or create dedicated indicator windows with intentional scale.
- **Motion & Animation**: Use `barstate.isrealtime` and `line.set_x` for smooth real-time updates. Create elegant transitions rather than jarring jumps.
- **Negative Space**: Respect chart readability. Use transparent backgrounds strategically, allow price action to breathe between indicator plots.

## Advanced Visualization Techniques

Implement creatively:

- **3D Effects**: Use gradient fills and shadows to create depth: `plot(series, color=color.new(base, 85), style=plot.style_area, offset=-1)`
- **Organic Shapes**: Use `plotshape` with custom UTF-8 symbols or create flowing lines with connected `line.new` segments
- **Information Density**: Design multi-axis indicators that reveal complex relationships without clutter
- **Interactive Elements**: Use `hline` and `input` options to create adjustable visual reference systems
- **Thematic Consistency**: If creating a suite of indicators, maintain visual language across all components

## Example Aesthetic Directions

**Brutalist/Minimalist**:

```pine
// Monochromatic, geometric precision
indicator_color = color.new(#000000, 70)
plot(ema, color=indicator_color, linewidth=3, style=plot.style_linebr)
bgcolor(ema > ema[1] ? color.new(#000000, 90) : color.new(#FFFFFF, 90))
```

**Futuristic/Holographic**:

```pine
// Cyan/magenta gradients, transparency layers
up_color = color.gradient(ema - low, 0, high-low, color.new(#00FFFF, 40), color.new(#00FFFF, 90))
down_color = color.gradient(high - ema, 0, high-low, color.new(#FF00FF, 40), color.new(#FF00FF, 90))
plot(ema, color=ema > ema[1] ? up_color : down_color, style=plot.style_area)
```

**Organic/Flow**:

```pine
// Curved interpretations, natural color palette
plot(smooth(high, 5), color=color.new(#2E8B57, 60), linewidth=2)
plot(smooth(low, 5), color=color.new(#8B4513, 60), linewidth=2)
fill(plot1, plot2, color=color.new(#90EE90, 85))
```

**Data Journalism**:

```pine
// Clean, labeled, annotation-focused
plot(series, color=color.new(#333333, 0), linewidth=1)
label.new(bar_index, valuewhen(cross, close, 0),
          text="Breakout\n" + str.tostring(close, "#.##"),
          color=color.new(#FFFFFF, 90), textcolor=color.black,
          style=label.style_label_down, font_font.family="Monospace")
```

NEVER use default Pine Script aesthetics like:

- Solid red/green for bullish/bearish
- Default line styles without intentional weight
- Cluttered plots without visual hierarchy
- Opaque backgrounds that obscure price action
- Generic plotshape styles (circles, triangles) without customization
- Monotonous color schemes throughout

Interpret trading concepts creatively and make unexpected visual choices that enhance analytical clarity while creating memorable chart experiences.

## Implementation Checklist

- Define color palette using color.new() with intentional opacity
- Establish visual hierarchy through line weights and plot order
- Consider accessibility (colorblind-friendly alternatives)
- Optimize performance for real-time use
- Add aesthetic customization options via input()
- Test across different chart types and timeframes
- Ensure mobile/TradingView app compatibility
- Document visual design decisions in code comments

Remember: The best trading indicators aren't just mathematically sound - they're visually eloquent. Your code should make market patterns not just visible, but beautifully comprehensible.
