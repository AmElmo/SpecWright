# Design Brief: Model Performance Dashboard

## Design Goals

1. **Glanceable** - Key health indicators visible without scrolling
2. **Data-dense** - Pack information without feeling cluttered
3. **Alert-oriented** - Problems surface immediately through color and position

## User Flows

### Flow 1: Morning Health Check

```
Open dashboard → Overview tab
    |
Scan status cards: green = healthy, yellow = warning, red = alert
    |
Click a yellow card to drill into that model's metrics
    |
View latency chart, identify spike at 3 AM
    |
Check alert history — was notified via Slack
```

### Flow 2: Set Up Alert

```
Click "Alerts" tab → "New Alert"
    |
Select: p95 latency > 2000ms for "claude-3-opus"
    |
Preview shows threshold line on live chart
    |
Select channel: #ml-alerts Slack channel
    |
Save → alert is active immediately
```

## Key Screens

1. **Overview** - Grid of model health cards with sparklines
2. **Model Detail** - Full charts for latency, errors, cost
3. **Alert Config** - Form with live chart preview
4. **Cost Analysis** - Spend breakdown with budget tracking

## Visual Guidelines

- Chart colors: consistent per model across all views
- Status: Green (healthy), Yellow (warning), Red (critical)
- Data labels: show exact values on hover
- Responsive: charts stack vertically on mobile
- Dark mode optimized (engineers often use dark mode)

## Accessibility

- Color-blind safe palette for status indicators (use shapes + color)
- Chart data available as tables for screen readers
- Keyboard navigation between models and time ranges

---
*Document generated as part of SpecWright specification*
