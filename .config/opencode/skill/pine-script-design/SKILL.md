---
name: pine-script-design
version: "1.0.0"
description: Create distinctive, production-grade TradingView indicators and strategies with exceptional visual design quality using Pine Script v6. Use when the user asks to build Pine Script indicators, strategies, charting tools, or visualization systems.
source: adapted-for-pine-script
license: Apache-2.0
---

# Pine Script v6 Design & Implementation Guide

## When to Use This Skill

Use this skill when the user requests:
- Building Pine Script indicators or strategies
- Creating charting tools or visualization systems
- TradingView automation or alerts
- Technical analysis implementations
- Price action visualization

**Always generate Pine Script v6 code** (`// @version=6`).

## Overview

This skill guides the creation of distinctive, production-grade Pine Script v6 visualizations that avoid generic "default indicator" aesthetics.

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Pine Script v6 Syntax Reference](#pine-script-v6-syntax-reference)
3. [Visual Design Guidelines](#visual-design-guidelines)
4. [Advanced Visualization Techniques](#advanced-visualization-techniques)
5. [Code Organization & Best Practices](#code-organization--best-practices)
6. [Example Aesthetic Directions](#example-aesthetic-directions)
7. [Implementation Checklist](#implementation-checklist)

---

## Design Philosophy

### Design Thinking Framework

Before coding, understand the context and commit to a **BOLD** visual direction:

- **Purpose**: What trading insight does this visualization reveal? Who is the trader (scalper, swing trader, investor)?
- **Tone**: Pick an extreme aesthetic:
  - Brutalist/Minimalist
  - Futuristic/Holographic
  - Organic/Flowing
  - Luxury/Refined
  - Retro/8-bit
  - Editorial/Data-journalism
  - Industrial/Utilitarian
  - Artistic/Abstract
- **Constraints**: MUST use Pine Script v6 (all code starts with `// @version=6`), performance limits, TradingView platform limitations
- **Differentiation**: What makes this visualization **UNFORGETTABLE**? What's the one visual element someone will remember?

**CRITICAL**: Choose a clear visual concept and execute it with precision. Bold, information-dense displays and refined, minimal signals both work - the key is intentional visual communication, not default styling.

### Core Principles

Then implement **Pine Script v6** code that is:

- Production-grade and performant
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every visual detail
- **ALWAYS using `// @version=6`** - No exceptions
- Following all v6 syntax rules (no deprecated v5 patterns)

---

## Pine Script v6 Syntax Reference

### Script Structure

```pinescript
// @version=6
// Mandatory version annotation (v1-v6 available, v6 recommended for new scripts)

indicator("My Indicator", overlay=true, max_bars_back=500)
// OR strategy("My Strategy", overlay=true, initial_capital=10000)
// OR library("My Library", true)
```

#### Declaration Functions

| Function | Purpose | Key Parameters |
|----------|---------|----------------|
| `indicator()` | Create technical indicator | `title`, `shorttitle`, `overlay`, `format`, `precision`, `max_bars_back`, `timeframe`, `timeframe_gaps` |
| `strategy()` | Create trading strategy | `title`, `overlay`, `initial_capital`, `default_qty_type`, `default_qty_value`, `commission_type`, `commission_value`, `slippage`, `currency`, `max_lines_count`, `max_labels_count`, `max_boxes_count`, `max_bars_back` |
| `library()` | Create reusable library | `title`, `overlay`, `explicit_plot_zorder` |

### Type System

Pine Script uses a strict type system with **qualifiers** that determine when values are accessible:

#### Qualifier Hierarchy
```
const < input < simple < series
```

| Qualifier | When Available | Mutability | Example |
|-----------|----------------|------------|---------|
| `const` | Compile time | Immutable | `PI = 3.14159`, `"EURUSD"` |
| `input` | Input time (Settings) | Immutable | `input.int(14, "Length")` |
| `simple` | Runtime, first bar only | Immutable after first bar | `syminfo.ticker`, `timeframe.period` |
| `series` | Runtime, every bar | Mutable every bar | `close`, `high`, `ta.sma(close, 14)` |

**Rule**: Stronger qualifiers can be used where weaker ones are expected, but not vice versa.

#### Fundamental Types

| Type | Description | Examples |
|------|-------------|----------|
| `int` | Integer | `42`, `-1`, `0` |
| `float` | Floating-point | `3.14`, `1.0`, `-0.5` |
| `bool` | Boolean | `true`, `false` (Note: v6 bool cannot be `na`) |
| `color` | Color | `color.red`, `#FF5733`, `color.new(#00FF00, 50)` |
| `string` | Text | `"Hello"`, `'World'` |
| `line` | Line drawing object | `line.new()` |
| `label` | Label drawing object | `label.new()` |
| `box` | Box drawing object | `box.new()` |
| `table` | Table object | `table.new()` |
| `array<type>` | Array | `array.new<float>(10)` |
| `matrix<type>` | Matrix | `matrix.new<float>(3, 3)` |
| `map<keyType, valueType>` | Map | `map.new<string, float>()` |

### Variable Declarations

```pinescript
// Basic declaration
myVar = 0.0                      // Standard variable, recalculated every bar
var myVar = 0.0                  // Initialized only on first bar
var float myVar = na             // Explicit type with var
varip float myVar = 0.0          // var intrabar (v6 feature - updates every price tick on realtime bar)

const float PI = 3.14159         // Compile-time constant

// Reassignment (must be pre-declared)
myVar := newValue                // Standard reassignment
myVar += 1                       // Compound: myVar = myVar + 1
myVar -= 5                       // Compound: myVar = myVar - 5
myVar *= 2                       // Compound: myVar = myVar * 2
myVar /= 3                       // Compound: myVar = myVar / 3
```

### Operators

#### Arithmetic Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition / String concat | `a + b`, `"EUR" + "USD"` |
| `-` | Subtraction / Negation | `a - b`, `-5` |
| `*` | Multiplication | `a * b` |
| `/` | Division | `a / b` (Note: v6 const int division returns float) |
| `%` | Modulo | `a % b` |

#### Comparison Operators
| Operator | Description |
|----------|-------------|
| `==` | Equal |
| `!=` | Not equal |
| `<` | Less than |
| `<=` | Less than or equal |
| `>` | Greater than |
| `>=` | Greater than or equal |

#### Logical Operators (v6: Lazy Evaluation)
| Operator | Description |
|----------|-------------|
| `not` | Logical NOT |
| `and` | Logical AND (lazy evaluation in v6) |
| `or` | Logical OR (lazy evaluation in v6) |

**Important v6 Change**: `and` and `or` now use lazy evaluation. In `a and b`, if `a` is false, `b` is not evaluated.

#### Special Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `[]` | History reference | `close[1]`, `high[5]` |
| `?:` | Ternary conditional | `condition ? value_if_true : value_if_false` |
| `=` | Assignment (declaration) | `x = 5` |
| `:=` | Reassignment | `x := 10` |

#### Operator Precedence (High to Low)
```
9: [] (history reference)
8: unary +, unary -, not
7: *, /, %
6: +, -
5: >, <, >=, <=
4: ==, !=
3: and
2: or
1: ?: (ternary)
```

### Control Structures

#### If Statements
```pinescript
// Single-line if
if close > open
    color c = color.green

// If-else
plotColor = if close > open
    color.green
else
    color.red

// Nested ternary
plotColor = close > open ? color.green : close < open ? color.red : color.gray

// If with multiple statements
if ta.crossover(fastMA, slowMA)
    label.new(bar_index, high, "Golden Cross", color=color.green)
    alert("Buy signal triggered!", alert.freq_once_per_bar_close)
```

**v6 Important**: Boolean values cannot be `na`. Use explicit conditions:
```pinescript
// v6: Use bool() for explicit casting
condition = bool(bar_index) ? color.green : color.red

// v6: Remove na() checks on boolean variables
// Instead of: na(isLong)
// Use: not isLong
```

#### Loops
```pinescript
// For loop (v6: end boundary evaluated dynamically before each iteration)
for i = 0 to 9
    sum += close[i]

// For loop with step
for i = 0 to 100 by 10
    doSomething(i)

// While loop
var int count = 0
while count < 10
    count += 1

// For...in with arrays
for element in myArray
    sum += element

// Break and continue
for i = 0 to 100
    if i > 50
        break
    if i % 2 == 0
        continue
    sum += i
```

#### Switch Statements
```pinescript
// Switch expression (v6: must include default block)
result = switch timeframe.period
    "1" => "1 minute"
    "5" => "5 minutes"
    "15" => "15 minutes"
    "60" => "1 hour"
    "240" => "4 hours"
    "D" => "Daily"
    => "Other"  // v6: default block is required

// Switch with if-style
switch
    close > open => color.green
    close < open => color.red
    => color.gray  // v6: default required
```

### Functions

#### User-Defined Functions
```pinescript
// Simple function
squared(x) => x * x

// Multi-line function with explicit type
//@function Calculate weighted moving average
//@param source (series float) Price source
//@param length (simple int) Lookback period
//@returns (series float) Weighted moving average
wma(source, length) =>
    float norm = 0.0
    float sum = 0.0
    for i = 0 to length - 1
        weight = (length - i) * length
        norm += weight
        sum += source[i] * weight
    sum / norm

// Function with default parameters
ma(source = close, length = 14) =>
    ta.sma(source, length)
```

#### Lambda Functions
```pinescript
// Lambda expression
multiply = (a, b) => a * b

// Higher-order function
apply(func, value) => func(value)
double = apply((x) => x * 2, close)
```

### Built-in Technical Analysis Functions

#### Moving Averages
```pinescript
ta.sma(source, length)           // Simple Moving Average
ta.ema(source, length)           // Exponential Moving Average
ta.wma(source, length)           // Weighted Moving Average
ta.vwma(source, volume, length)  // Volume-Weighted Moving Average
ta.hma(source, length)           // Hull Moving Average
ta.rma(source, length)           // Wilder's Moving Average (RMA)
ta.swma(source)                  // Symmetrically Weighted Moving Average
ta.alma(source, length, offset, sigma) // Arnaud Legoux Moving Average
ta.vwap(anchor)                  // Volume-Weighted Average Price
ta.tr(true)                      // True Range
```

#### Oscillators & Momentum
```pinescript
ta.rsi(source, length)           // Relative Strength Index
ta.macd(source, fastlen, slowlen, siglen) // MACD
ta.stoch(source, high, low, length) // Stochastic
ta.cci(source, length)           // Commodity Channel Index
ta.willr(high, low, close, length) // Williams %R
ta.mfi(source, volume, length)   // Money Flow Index
ta.cmo(source, length)           // Chande Momentum Oscillator
ta.roc(source, length)           // Rate of Change
ta.mom(source, length)           // Momentum
ta.adx(length)                   // Average Directional Index
ta.di_plus(length)               // Directional Movement Plus
ta.di_minus(length)              // Directional Movement Minus
```

#### Volatility
```pinescript
ta.atr(length)                   // Average True Range
ta.bb(source, length, mult)      // Bollinger Bands
ta.kc(source, length, mult)      // Keltner Channels
ta.bbpercent(source, length, mult) // %B
ta.tr(true)                      // True Range
```

#### Trend & Support/Resistance
```pinescript
ta.pivothigh(leftbars, rightbars)   // Pivot High
ta.pivotlow(leftbars, rightbars)    // Pivot Low
ta.valuewhen(condition, source, occurrence) // Value when condition met
ta.barssince(condition)          // Bars since condition
ta.cross(source1, source2)       // Crossover/crossunder detection
ta.crossover(source1, source2)   // Crossover detection
ta.crossunder(source1, source2)  // Crossunder detection
ta.highest(source, length)       // Highest value
ta.lowest(source, length)        // Lowest value
ta.highestbars(source, length)   // Bars to highest
ta.lowestbars(source, length)    // Bars to lowest
```

#### Volume
```pinescript
ta.obv(source)                   // On-Balance Volume
ta.vwap(anchor)                  // VWAP
ta.pvi                           // Positive Volume Index
ta.nvi                           // Negative Volume Index
ta.cmf(length)                   // Chaikin Money Flow
ta.ad(length)                    // Accumulation/Distribution Line
ta.aobv(length, normalize)       // Archer On-Balance Volume
```

### Built-in Variables

#### Price Data
```pinescript
open       // Opening price
high       // High price
low        // Low price
close      // Closing price
hl2        // (high + low) / 2
hlc3       // (high + low + close) / 3
ohlc4      // (open + high + low + close) / 4
volume     // Trading volume
time       // Bar timestamp (milliseconds)
time_close // Bar close timestamp
```

#### Bar Information
```pinescript
bar_index           // Current bar index (0-based)
bar_is_first        // True on first bar
bar_is_last         // True on last bar
barstate.isfirst    // True on first bar in history
barstate.islast     // True on last (realtime) bar
barstate.isnew      // True when new bar starts
barstate.ishistory  // True on historical bars
barstate.isconfirmed // True when bar is confirmed (closed)
barstate.isrealtime // True on realtime bar
```

#### Chart Information
```pinescript
syminfo.ticker          // Symbol ticker
syminfo.tickerid        // Full ticker ID
syminfo.description     // Symbol description
syminfo.type            // Symbol type (stock, crypto, etc.)
syminfo.mintick         // Minimum tick size
syminfo.currency        // Base currency
timeframe.period        // Current timeframe string (v6: always includes multiplier, e.g., "1D")
timeframe.multiplier    // Timeframe multiplier
chart.left_visible_bar_time    // Leftmost visible bar timestamp
chart.right_visible_bar_time   // Rightmost visible bar timestamp
chart.bg_color          // Chart background color
chart.fg_color          // Chart foreground color
```

#### Math Constants & Functions
```pinescript
// Constants
math.pi            // π (3.14159...)
math.phi           // Golden ratio
math.e             // Euler's number
math.rphi          // Reciprocal of phi

// Functions
math.abs(x)        // Absolute value
math.round(x)      // Round to nearest integer
math.floor(x)      // Floor function
math.ceil(x)       // Ceiling function
math.min(a, b)     // Minimum
math.max(a, b)     // Maximum
math.sqrt(x)       // Square root
math.pow(base, exp) // Power
math.exp(x)        // e^x
math.log(x)        // Natural logarithm
math.log10(x)      // Base-10 logarithm
math.sin(x)        // Sine (radians)
math.cos(x)        // Cosine (radians)
math.tan(x)        // Tangent (radians)
math.asin(x)       // Arcsine
math.acos(x)       // Arccosine
math.atan(x)       // Arctangent
math.atan2(y, x)   // Arctangent of y/x
math.todegrees(radians) // Convert to degrees
math.toradians(degrees) // Convert to radians
math.random(min, max)   // Random number
```

#### Color Functions
```pinescript
color.new(color, transp)              // Create color with transparency (0-100)
color.rgb(r, g, b)                    // RGB color
color.rgba(r, g, b, a)               // RGB with alpha
color.from_gradient(value, min, max, color1, color2) // Gradient color
color.gray(level)                     // Grayscale (0-255)
color.red                             // Built-in: red
color.green                           // Built-in: green
color.blue                            // Built-in: blue
// ... many more built-in colors
```

### Input Functions

```pinescript
// Integer input
int length = input.int(14, "Length", minval=1, maxval=200, step=1, group="Settings")

// Float input
float threshold = input.float(70.0, "Threshold", minval=0, maxval=100, step=0.5)

// Boolean input
bool showSignals = input.bool(true, "Show Signals", tooltip="Display buy/sell signals")

// String input
string timeframe = input.timeframe("D", "Timeframe", options=["D", "W", "M"])

// Color input
color maColor = input.color(color.blue, "MA Color", group="Colors", inline="ma")

// Source input (price data)
float src = input.source(close, "Source", group="Data")

// Symbol input
string sym = input.symbol("AAPL", "Symbol")

// Time input
int time = input.time(timestamp("2024-01-01"), "Start Time")

// String input with options
string method = input.string("SMA", "Method", options=["SMA", "EMA", "WMA", "HMA"])

// Session input
string session = input.session("0900-1600", "Trading Session")

// Price input
float priceLevel = input.price(100.0, "Price Level", confirm=true)
```

### Drawing Functions

#### Plots
```pinescript
// Basic plot
plot(close, "Close", color.blue, 2)

// Plot with style
plot(ma, "MA", color.red, 2, plot.style_line)
plot(volume, "Volume", color.purple, style=plot.style_histogram)
plot(rsi, "RSI", color.orange, style=plot.style_area)

// v6: No transp parameter - use color.new() instead
plot(rsi, "RSI", color.new(color.orange, 80), style=plot.style_area)

// Plot shapes
plotshape(buyCondition, "Buy", shape.triangleup, location.belowbar, color.green, size=size.small)
plotshape(sellCondition, "Sell", shape.triangledown, location.abovebar, color.red, size=size.small)

// Plot arrows
plotarrow(macd_diff, "MACD Arrow", color.green, color.red)

// Plot characters
plotchar(breakout, "Break", "↑", location.belowbar, color.green)

// Plot bars
plotbar(open, high, low, close, "OHLC")

// Plot candle
plotcandle(open, high, low, close, "Candles", color.green, color.red)

// v6: offset parameter no longer accepts series values
plot(ma, "MA", color.red, 2, offset=5)  // const int only
```

#### Lines and Boxes
```pinescript
// Create line
var line myLine = na
if condition
    myLine := line.new(x1, y1, x2, y2, xloc=xloc.bar_index, extend=extend.none, 
                       color=color.red, style=line.style_solid, width=2)

// Modify line
line.set_xy1(myLine, newX1, newY1)
line.set_xy2(myLine, newX2, newY2)
line.set_color(myLine, color.green)
line.set_style(myLine, line.style_dashed)
line.set_width(myLine, 3)
line.delete(myLine)

// Create box
var box myBox = na
myBox := box.new(left, top, right, bottom, bgcolor=color.new(color.blue, 90), 
                 border_color=color.blue, border_width=2, border_style=line.style_solid)

// Box manipulation
box.set_lefttop(myBox, left, top)
box.set_rightbottom(myBox, right, bottom)
box.set_bgcolor(myBox, color.new(color.green, 80))
box.delete(myBox)
```

#### Labels
```pinescript
// Create label
var label myLabel = na
myLabel := label.new(bar_index, high, "Peak: " + str.tostring(high, "#.##"), 
                     xloc=xloc.bar_index, yloc=yloc.abovebar, 
                     color=color.green, textcolor=color.white,
                     style=label.style_label_down, size=size.normal)

// Modify label
label.set_text(myLabel, "New Text")
label.set_xy(myLabel, bar_index, close)
label.set_color(myLabel, color.red)
label.set_style(myLabel, label.style_label_up)
label.delete(myLabel)
```

#### Tables
```pinescript
// Create table
var table infoTable = table.new(position.top_right, 2, 5, bgcolor=color.new(color.black, 80), 
                                border_width=1, border_color=color.gray)

// Update table cells
table.cell(infoTable, 0, 0, "RSI:", text_color=color.white, text_size=size.small)
table.cell(infoTable, 1, 0, str.tostring(rsi, "#.##"), text_color=color.yellow)
```

#### Background and Bar Coloring
```pinescript
// Background color
bgcolor(color.new(color.blue, 90), title="Background")

// Bar color
barcolor(trendUp ? color.green : trendDown ? color.red : na)

// Fill between plots (plot1 and plot2 are plot IDs from earlier plot() calls)
// Example: fill(upperBandPlot, lowerBandPlot, color=color.new(color.blue, 85), title="Fill")
```

### Multi-Timeframe & Data Request (v6: Dynamic by Default)

```pinescript
// v6: Dynamic requests are now default - no need for dynamic_requests=true parameter
// Request data from another timeframe
higherTF_data = request.security(syminfo.tickerid, "D", close, lookahead=barmerge.lookahead_off)

// Request data from another symbol
spyData = request.security("SPY", timeframe.period, close)

// Request with gaps
htfClose = request.security(syminfo.tickerid, "W", close, gaps=barmerge.gaps_on)

// Request with calc_bars_count
limitedData = request.security(syminfo.tickerid, "D", close, calc_bars_count=100)

// v6: Can use request in loops and conditionals
symbols = array.from("AAPL", "MSFT", "GOOGL", "NVDA")
closes = array.new<float>()
for sym in symbols
    c = request.security(sym, "1D", close)
    array.push(closes, c)

// Financial data
financial = request.financial(syminfo.tickerid, "ACCOUNTS_PAYABLE", "FQ")

// Earnings data
earnings = request.earnings(syminfo.tickerid, earnings.actual_eps)

// Dividends data
dividends = request.dividends(syminfo.tickerid, dividends.cash_amount)

// Splits data
splits = request.splits(syminfo.tickerid, splits.denominator)
```

### Arrays (v6: Enhanced with Negative Indexing)

```pinescript
// Array declaration
var float[] prices = array.new<float>(0)

// Array operations
array.push(prices, close)                    // Add element
array.unshift(prices, open)                  // Add to front
float val = array.get(prices, 0)            // Get element (v6: can use negative indices)
float lastVal = array.get(prices, -1)       // v6: Get last element
array.set(prices, 0, high)                   // Set element (v6: can use negative indices)
array.remove(prices, 0)                      // Remove element
array.pop(prices)                            // Remove last
array.shift(prices)                          // Remove first
array.clear(prices)                          // Clear array

// Array properties
int size = array.size(prices)
bool empty = array.size(prices) == 0

// Array functions
float avg = array.avg(prices)
float sum = array.sum(prices)
float minVal = array.min(prices)
float maxVal = array.max(prices)
int minIdx = array.indexof(prices, minVal)
int maxIdx = array.lastindexof(prices, maxVal)
bool contains = array.includes(prices, 100.0)
array.sort(prices, order.ascending)
array.reverse(prices)
array.copy(prices)
array.concat(array1, array2)
array.join(prices, ", ")

// Array slicing
float[] slice = array.slice(prices, 0, 10)

// Matrix operations
var matrix<float> myMatrix = matrix.new<float>(3, 3)
matrix.set(myMatrix, 0, 0, 1.0)
matrix.add_row(myMatrix, 0, array.from(1, 2, 3))
```

### Maps (v6)

```pinescript
// Map declaration
var map<string, float> priceMap = map.new<string, float>()

// Map operations
map.put(priceMap, "AAPL", 150.0)
float aaplPrice = map.get(priceMap, "AAPL")
bool hasKey = map.containsKey(priceMap, "AAPL")
map.remove(priceMap, "AAPL")
int mapSize = map.size(priceMap)
map.clear(priceMap)

// Get all keys/values
string[] keys = map.keys(priceMap)
float[] values = map.values(priceMap)
```

### Strategies

```pinescript
// Strategy declaration
strategy("My Strategy", overlay=true, initial_capital=10000, 
         default_qty_type=strategy.percent_of_equity, default_qty_value=10,
         commission_type=strategy.commission.percent, commission_value=0.1,
         slippage=1, currency=currency.USD)

// Entry orders
strategy.entry("Long", strategy.long, qty=1, limit=entryPrice, stop=stopPrice, 
               comment="Enter Long")
strategy.entry("Short", strategy.short, qty=1, comment="Enter Short")

// Exit orders
strategy.close("Long", comment="Close Long", when=exitCondition)
strategy.close_all(comment="Close All", when=emergencyExit)

// v6: Exit with specific parameters (relative params not ignored when absolute params present)
strategy.exit("Long Exit", "Long", limit=takeProfit, stop=stopLoss, 
              trail_points=10, trail_offset=5)

// v6: Default margin is now 100%
// v6: When exceeding 9000 trade limit, oldest orders are trimmed instead of error

// Order sizing
strategy.position_size           // Current position size
strategy.equity                  // Current equity
strategy.openprofit              // Open P&L
strategy.closedtrades            // Number of closed trades
strategy.wintrades               // Number of winning trades
strategy.losstrades              // Number of losing trades
strategy.avgwin                  // Average win
strategy.avgloss                 // Average loss
strategy.maxdrawdown             // Maximum drawdown

// Position information
strategy.position_avg_price      // Average entry price
strategy.position_size > 0       // Check if long
strategy.position_size < 0       // Check if short
```

### Alerts

```pinescript
// Alert function
if buyCondition
    alert("Buy Signal", alert.freq_once_per_bar_close)

// Alert with message
alert("Price crossed above " + str.tostring(ma), alert.freq_once_per_bar)

// Alertfrequency options:
// alert.freq_all - Alert on every update
// alert.freq_once_per_bar - Alert once per bar
// alert.freq_once_per_bar_close - Alert once when bar closes (recommended)
```

### Debugging

```pinescript
// Plot as lines for debugging
plot(debugValue, "Debug", color.gray)

// Log to Pine Logs
log.info("Debug value: {0}", debugValue)
log.error("Error occurred!")
log.warning("Warning message")

// Label for debugging
if barstate.islast
    label.new(bar_index, high, "Debug:\n" + str.tostring(debugValue), 
              color=color.gray, textcolor=color.white)

// Table for debugging
var table debugTable = table.new(position.top_left, 2, 10)
if barstate.islast
    table.cell(debugTable, 0, 0, "Variable")
    table.cell(debugTable, 1, 0, "Value")
    table.cell(debugTable, 0, 1, "RSI")
    table.cell(debugTable, 1, 1, str.tostring(rsi))
```

---

## Visual Design Guidelines

### Color Theory

Create intentional color palettes that convey meaning:

- **Color gradients for intensity**: Use `color.from_gradient()` to show strength/weakness
- **Complementary colors for opposing signals**: Bullish/bearish pairs
- **Harmonious schemes for related data**: Analogous colors for related indicators
- **Colorblind-friendly alternatives**: 
  - Instead of red/green: blue/orange, purple/yellow, cyan/magenta
  - Consider pattern fills in addition to colors

```pinescript
// Good: Colorblind-friendly palette
BULL_COLOR = #0072B2  // Blue
BEAR_COLOR = #D55E00  // Orange
NEUTRAL_COLOR = #999999  // Gray

// Good: Gradient for intensity
rsiColor = color.from_gradient(rsi, 30, 70, color.blue, color.red)

// Good: Transparent colors for overlays
plot(ma, "MA", color.new(BULL_COLOR, 30), 2)
bgcolor(color.new(BEAR_COLOR, 90))
```

### Visual Hierarchy

Design information layers deliberately:

- **Primary signals**: Bold, saturated, thick lines (width=3+)
- **Secondary context**: Subdued, transparent, thin lines (width=1)
- **Background elements**: Very transparent (transparency=90-95)
- **Z-index ordering**: Use `display` parameter strategically

```pinescript
// Primary signal
plot(emaFast, "Fast EMA", color.new(#00FFFF, 0), 3)

// Secondary context
plot(emaSlow, "Slow EMA", color.new(#00FFFF, 50), 1)

// Background
bgcolor(color.new(#000000, 95))
```

### Typography & Labels

- Use appropriate font sizes: `size.tiny`, `size.small`, `size.normal`, `size.large`, `size.huge`
- Match font families to aesthetic: `font.family_monospace` for data
- Consider text alignment: `text.align_left`, `text.align_center`, `text.align_right`

```pinescript
label.new(bar_index, high, str.tostring(close, "#.##"), 
          style=label.style_label_down, 
          text_font_family=font.family_monospace,
          text_size=size.small,
          text_halign=text.align_center)
```

### Chart Integration

Design indicators that complement price action:

```pinescript
// Plot behind price
plot(ma, "MA", color.red, display=display.pane)

// Use overlay=false for separate pane
indicator("RSI", overlay=false)

// Subtle background that doesn't obscure price
bgcolor(trendUp ? color.new(color.green, 95) : color.new(color.red, 95))

// Only show on specific conditions
plotshape(signal, "Breakout", shape.triangleup, location.belowbar, 
          color.green, size=size.small)
```

### Motion & Animation

Create elegant real-time updates:

```pinescript
// Smooth updates on realtime bar
if barstate.isrealtime
    line.set_x2(trendLine, bar_index)
    line.set_y2(trendLine, close)

// Use var for persistent objects that update smoothly
var label currentPrice = na
currentPrice := label.new(bar_index, close, str.tostring(close, "#.##"), 
                          xloc=xloc.bar_index, yloc=yloc.price,
                          style=label.style_none, textcolor=color.white)
label.delete(currentPrice[1])
```

### varip - Intrabar Updates (v6)

```pinescript
// varip variables update on every tick during the realtime bar
varip float lastPrice = close
varip int tickCount = 0
tickCount += 1

// Useful for tracking real-time changes within a bar
priceChange = close - lastPrice
```

---

## Advanced Visualization Techniques

### 3D Effects & Depth

```pinescript
// Gradient fill for depth
plot(close, "Close", color.new(baseColor, 70), style=plot.style_area, offset=-1)
plot(close, "Close Shadow", color.new(color.black, 85), style=plot.style_area, offset=-2)

// Layered transparency for volume profile
for i = 0 to 9
    level = base + i * step
    opacity = 90 - (i * 8)
    bgcolor(close > level ? color.new(bullColor, opacity) : na)
```

### Organic Shapes & Flowing Lines

```pinescript
// Flowing curves with connected line segments
var line[] flowLines = array.new_line(0)
if bar_index % 5 == 0
    line.new(bar_index - 5, ema[5], bar_index, ema, 
             color=color.from_gradient(ema - ema[5], -1, 1, color.red, color.green),
             width=2, style=line.style_solid)

// Custom shapes with plotshape
plotshape(signal, "Custom", "★", location.belowbar, color.gold, size=size.small)
```

### Information Density

```pinescript
// Multi-dimensional heatmap
for i = 0 to 9
    for j = 0 to 9
        value = calcValue(i, j)
        color heatColor = color.from_gradient(value, minVal, maxVal, color.blue, color.red)
        // Draw boxes or use barcolor with offset logic
```

### Interactive Elements

```pinescript
// Adjustable levels via inputs
float level1 = input.price(100.0, "Support Level", confirm=true)
float level2 = input.price(200.0, "Resistance Level", confirm=true)

hline(level1, "Support", color.green, hline.style_dashed)
hline(level2, "Resistance", color.red, hline.style_dashed)

// Dynamic zones
zoneColor = close > level1 and close < level2 ? color.new(color.yellow, 90) : na
bgcolor(zoneColor)
```

### Thematic Consistency

When creating indicator suites, maintain visual language:

```pinescript
// Common color definitions
BULL_PRIMARY = #00D9FF
BULL_SECONDARY = #0066CC
BEAR_PRIMARY = #FF3366
BEAR_SECONDARY = #CC0033
NEUTRAL = #888888

// Common line weights
LINE_WEIGHT_THICK = 3
LINE_WEIGHT_MEDIUM = 2
LINE_WEIGHT_THIN = 1

// Common transparency levels
OPAQUE = 0
SEMI_TRANSPARENT = 50
TRANSPARENT = 90
```

---

## Code Organization & Best Practices

### Script Structure Template

```pinescript
// @version=6
// This Pine Script is subject to the Mozilla Public License 2.0
// © YourName

// ============================================
// CONSTANTS
// ============================================
string INDICATOR_NAME = "My Indicator"
int DEFAULT_LENGTH = 14
color BULL_COLOR = #0072B2
color BEAR_COLOR = #D55E00

// ============================================
// INPUTS
// ============================================
indicator(INDICATOR_NAME, overlay=true, max_bars_back=500)

int lengthInput = input.int(DEFAULT_LENGTH, "Length", minval=1, group="Settings")
float multiplierInput = input.float(2.0, "Multiplier", step=0.1, group="Settings")
color bullColorInput = input.color(BULL_COLOR, "Bull Color", group="Colors")
color bearColorInput = input.color(BEAR_COLOR, "Bear Color", group="Colors")
bool showSignalsInput = input.bool(true, "Show Signals", group="Display")

// ============================================
// FUNCTION DECLARATIONS
// ============================================

//@function Calculate custom moving average
//@param source (series float) Source series
//@param length (simple int) Length
//@returns (series float) Custom MA
customMA(source, length) =>
    sum = 0.0
    for i = 0 to length - 1
        sum += source[i] * (length - i)
    sum / (length * (length + 1) / 2)

// ============================================
// CALCULATIONS
// ============================================
float maValue = customMA(close, lengthInput)
float upperBand = maValue + ta.stdev(close, lengthInput) * multiplierInput
float lowerBand = maValue - ta.stdev(close, lengthInput) * multiplierInput
bool isBull = close > maValue

// ============================================
// VISUALS
// ============================================
// Main bands
upperPlot = plot(upperBand, "Upper", color.new(bearColorInput, 50), 1)
lowerPlot = plot(lowerBand, "Lower", color.new(bullColorInput, 50), 1)
plot(maValue, "MA", color.new(isBull ? bullColorInput : bearColorInput, 20), 2)

// Fill between bands (using plot IDs, not plot function calls)
fill(upperPlot, lowerPlot, color.new(isBull ? bullColorInput : bearColorInput, 90))

// Signals
if showSignalsInput and ta.crossover(close, upperBand)
    label.new(bar_index, high, "Breakout!", color=color.green, 
              style=label.style_label_down, yloc=yloc.abovebar)

// Background
bgcolor(color.new(isBull ? bullColorInput : bearColorInput, 95))

// ============================================
// ALERTS
// ============================================
alertcondition(ta.crossover(close, upperBand), "Upper Band Cross", "Price crossed above upper band!")
alertcondition(ta.crossunder(close, lowerBand), "Lower Band Cross", "Price crossed below lower band!")
```

### Naming Conventions

Follow TradingView style guide:

- **camelCase** for variables and functions: `maFast`, `calculateValue()`, `showInput`
- **UPPER_SNAKE_CASE** for constants: `MAX_LOOKBACK`, `DEFAULT_COLOR`
- **Suffix conventions**:
  - `*Input` for input variables: `lengthInput`
  - `*Color` for colors: `bullColor`
  - `*Array` for arrays: `pricesArray`
  - `*MA` for moving averages: `emaFast`

### Performance Optimization

```pinescript
// BAD: Recalculating on every bar
for i = 0 to 100
    doHeavyCalculation(i)

// GOOD: Calculate only when necessary
var float cachedValue = na
if barstate.isnew or conditionChanged
    cachedValue := doHeavyCalculation()

// BAD: Using history operator excessively
x = close[1] + close[2] + close[3] + ...

// GOOD: Use built-in functions
x = ta.sma(close, 10) * 10

// BAD: Creating objects on every bar
line.new(...)  // Every bar!

// GOOD: Reuse objects
var line myLine = na
if condition
    myLine := line.new(...)
else
    line.set_xy2(myLine, bar_index, close)

// BAD: Requesting security too many times
a = request.security(...)
b = request.security(...)
c = request.security(...)

// GOOD: Request once with tuple
[a, b, c] = request.security(..., close, [value1, value2, value3])

// v6: Dynamic requests are now default, use freely in loops
symbols = array.from("AAPL", "MSFT", "GOOGL")
for sym in symbols
    price = request.security(sym, "D", close)
    // Process price
```

### Error Prevention

```pinescript
// v6: Handle bool differently - cannot be na
// Instead of: bool isLong = na
// Use: int tradeDirection = 0  // 0 = none, 1 = long, -1 = short

// Handle na values for non-bool
safeValue = nz(value, default)

// Check for valid calculations
validMA = ta.sma(close, length)
result = na(validMA) ? close : validMA

// Prevent division by zero
ratio = denominator != 0 ? numerator / denominator : 0

// Bounds checking
boundedValue = math.min(math.max(value, minLimit), maxLimit)

// v6: Explicit bool casting
condition = bool(numericValue) ? trueValue : falseValue
```

---

## Example Aesthetic Directions

### Brutalist/Minimalist

```pinescript
// @version=6
indicator("Brutalist EMA", overlay=true)

// Monochromatic, geometric precision
color PRIMARY = #000000
color SECONDARY = #FFFFFF

emaLength = input.int(20, "Length")
ema = ta.ema(close, emaLength)

// Bold, stark contrast
plot(ema, "EMA", color.new(PRIMARY, 30), width=3, style=plot.style_linebr)

// Binary background
bgcolor(ema > ema[1] ? color.new(PRIMARY, 90) : color.new(SECONDARY, 95))

// Minimal signals
plotshape(ta.cross(close, ema), "Cross", shape.xcross, location.belowbar, 
          color.new(PRIMARY, 0), size=size.small)
```

### Futuristic/Holographic

```pinescript
// @version=6
indicator("Holographic Bands", overlay=true)

// Cyan/magenta gradients, transparency layers
CYAN = #00FFFF
MAGENTA = #FF00FF
length = input.int(20, "Length")

ema = ta.ema(close, length)
dist = math.abs(close - ema)
volatility = ta.atr(length)

// Gradient colors based on distance from EMA
gradientValue = math.min(dist / volatility, 1)
upColor = color.from_gradient(gradientValue, 0, 1, 
                               color.new(CYAN, 40), color.new(CYAN, 80))
downColor = color.from_gradient(gradientValue, 0, 1, 
                                 color.new(MAGENTA, 40), color.new(MAGENTA, 80))

// Layered plots for depth
plot(ema + volatility, "Upper", color.new(CYAN, 85), 1, style=plot.style_area)
plot(ema - volatility, "Lower", color.new(MAGENTA, 85), 1, style=plot.style_area)
plot(ema, "EMA", close > ema ? upColor : downColor, 2)

// Holographic glow effect
for i = 1 to 3
    alpha = 60 + i * 10
    plot(ema, "Glow " + str.tostring(i), color.new(CYAN, alpha), 4 + i)
```

### Organic/Flow

```pinescript
// @version=6
indicator("Organic Flow", overlay=true)

// Curved interpretations, natural color palette
FOREST = #2E8B57
EARTH = #8B4513
SAND = #F4A460

// Smooth with higher-order calculations
smoothHigh = ta.ema(ta.ema(high, 5), 5)
smoothLow = ta.ema(ta.ema(low, 5), 5)
smoothClose = ta.ema(ta.ema(close, 5), 5)

// Flowing channels
highPlot = plot(smoothHigh, "High Channel", color.new(FOREST, 60), 2)
lowPlot = plot(smoothLow, "Low Channel", color.new(EARTH, 60), 2)
plot(smoothClose, "Flow", color.new(SAND, 30), 3)

// Organic fill
fill(highPlot, lowPlot, color.new(FOREST, 90))

// Nature-inspired signals
plotshape(ta.crossover(smoothClose, smoothHigh), "Bloom", 
          "🌿", location.belowbar, color.new(FOREST, 0), size=size.small)
```

### Data Journalism

```pinescript
// @version=6
indicator("Data Journal RSI", overlay=false)

// Clean, labeled, annotation-focused
RSI_LENGTH = 14
rsi = ta.rsi(close, RSI_LENGTH)

// Minimal grid
hline(70, "Overbought", color.gray, hline.style_dotted)
hline(30, "Oversold", color.gray, hline.style_dotted)
hline(50, "Neutral", color.new(color.gray, 50), hline.style_dashed)

// Clean line
plot(rsi, "RSI", color.new(#333333, 0), 1)

// Informative labels
if ta.crossover(rsi, 70)
    label.new(bar_index, rsi, "Overbought\n" + str.tostring(rsi, "#.##"), 
              color=color.new(#FFFFFF, 90), textcolor=color.black,
              style=label.style_label_down, text_font_family=font.family_monospace)

// Data table
var table infoTable = table.new(position.top_right, 2, 3, 
                                bgcolor=color.white, border_width=1)
if barstate.islast
    table.cell(infoTable, 0, 0, "Current RSI:", text_color=color.black, 
               text_font_family=font.family_monospace)
    table.cell(infoTable, 1, 0, str.tostring(rsi, "#.##"), text_color=color.black,
               text_font_family=font.family_monospace)
    table.cell(infoTable, 0, 1, "Trend:", text_color=color.black,
               text_font_family=font.family_monospace)
    table.cell(infoTable, 1, 1, rsi > 50 ? "Bullish" : "Bearish",
               text_color=rsi > 50 ? color.green : color.red,
               text_font_family=font.family_monospace)
```

### Industrial/Utilitarian

```pinescript
// @version=6
indicator("Industrial Levels", overlay=true)

// High-contrast, functional, information-dense
YELLOW = #FFD700
RED = #FF4500
GRAY = #696969

pivotHighs = ta.pivothigh(5, 5)
pivotLows = ta.pivotlow(5, 5)

// Persistent levels with var
var line[] resistanceLines = array.new_line(0)
var line[] supportLines = array.new_line(0)

if not na(pivotHighs)
    array.push(resistanceLines, line.new(bar_index - 5, pivotHighs, bar_index, pivotHighs,
                                          color=color.new(RED, 30), width=2, 
                                          style=line.style_solid, extend=extend.right))
    if array.size(resistanceLines) > 5
        line.delete(array.shift(resistanceLines))

if not na(pivotLows)
    array.push(supportLines, line.new(bar_index - 5, pivotLows, bar_index, pivotLows,
                                       color=color.new(YELLOW, 30), width=2,
                                       style=line.style_solid, extend=extend.right))
    if array.size(supportLines) > 5
        line.delete(array.shift(supportLines))

// Current price emphasis
var label currentLabel = na
currentLabel := label.new(bar_index, close, str.tostring(close, "#.##"),
                          xloc=xloc.bar_index, yloc=yloc.price,
                          style=label.style_none, textcolor=GRAY,
                          text_font_family=font.family_monospace, size=size.normal)
label.delete(currentLabel[1])
```

---

## Anti-Patterns (NEVER Use)

```pinescript
// NEVER: Default red/green without consideration
plot(ema, color=ema > ema[1] ? color.red : color.green)  // Generic!

// NEVER: Default styles without intention
plot(ma)  // No color, no width, no style specified!

// NEVER: Cluttered plots without hierarchy
plot(a)
plot(b)
plot(c)
plot(d)
plot(e)  // All competing for attention!

// NEVER: Opaque backgrounds
bgcolor(color.red)  // Blocks price action!

// NEVER: Generic shapes
plotshape(signal, "Signal", shape.circle)  // No color, no location!

// NEVER: Monotonous color schemes
plot(a, color=color.blue)
plot(b, color=color.blue)
plot(c, color=color.blue)  // Everything same color!

// v6 NEVER: Using na with bool
bool isLong = na  // v6: Bool cannot be na!

// v6 NEVER: Implicit int to bool casting
if bar_index  // v6: Must use bool(bar_index)
    ...

// v6 NEVER: Using transp parameter
plot(rsi, transp=80)  // v6: Removed, use color.new() instead

// v6 NEVER: Switch without default
switch condition  // v6: Must have default => case
    true => color.green
    false => color.red
    => color.gray  // Default required!
```

---

## Implementation Checklist

Before publishing your indicator:

- [ ] **CRITICAL**: Start with `// @version=6` - NO EXCEPTIONS
- [ ] Define color palette using `color.new()` with intentional opacity (v6: no transp parameter)
- [ ] Establish visual hierarchy through line widths and plot order
- [ ] Consider accessibility (colorblind-friendly alternatives)
- [ ] Optimize performance for real-time use
- [ ] Add aesthetic customization options via `input()`
- [ ] Test across different chart types (candles, Heikin Ashi, etc.)
- [ ] Test across different timeframes
- [ ] Ensure mobile/TradingView app compatibility
- [ ] Document visual design decisions in code comments
- [ ] Add tooltips to inputs explaining functionality
- [ ] Set appropriate `max_bars_back` to prevent loading issues
- [ ] Include alerts for key signals
- [ ] Handle edge cases (division by zero, na values)
- [ ] Follow naming conventions consistently
- [ ] Organize code into logical sections
- [ ] Test with different symbols (crypto, forex, stocks)
- [ ] **v6**: Ensure no bool variables use `na`
- [ ] **v6**: Use explicit `bool()` casting for numeric to boolean conversion
- [ ] **v6**: Include default case (`=>`) in all switch statements
- [ ] **v6**: Use `varip` for real-time tick updates when needed
- [ ] **v6**: Remember `timeframe.period` strings always include multiplier (e.g., "1D")

---

## Resources

- **Official Documentation**: https://www.tradingview.com/pine-script-docs/
- **Language Reference**: https://www.tradingview.com/pine-script-reference/v6/
- **v6 Migration Guide**: https://www.tradingview.com/pine-script-docs/migration-guides/to-pine-version-6/
- **PineCoders**: https://www.pinecoders.com/
- **Color Palettes**: https://colorbrewer2.org/ (colorblind-friendly options)

---

**IMPORTANT: ALWAYS USE PINE SCRIPT v6**

All code examples in this skill **MUST** use Pine Script v6 syntax:
- Start with `// @version=6`
- Use `varip` for intrabar updates when needed
- Include default cases in all `switch` statements
- Use `color.new()` instead of deprecated `transp` parameter
- Apply explicit `bool()` casting for numeric to boolean conversion
- Remember that `bool` values cannot be `na` in v6

Remember: The best trading indicators aren't just mathematically sound - they're visually eloquent. Your code should make market patterns not just visible, but beautifully comprehensible.

**Pine Script v6**: More powerful, more structured, more reliable. Write future-proof code.
