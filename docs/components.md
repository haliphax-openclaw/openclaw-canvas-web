# A2UI Components — `optionsFrom` for Select / MultiSelect

## Overview

Select and MultiSelect components support dynamic options via `optionsFrom`. When present, it takes precedence over the static `options` array.

## API

### Option 1: Derive from data source field

Extracts unique values from a named data source column. Options reactively update when the source changes.

```json
{
  "Select": {
    "optionsFrom": {
      "source": "team_members",
      "field": "department",
      "includeAll": true,
      "allLabel": "All Divisions"
    },
    "selected": "",
    "bind": { "source": "team_members", "field": "department", "op": "eq", "nullValue": "" }
  }
}
```

| Property     | Type    | Required | Description                                      |
|-------------|---------|----------|--------------------------------------------------|
| `source`    | string  | yes      | Name of the data source                          |
| `field`     | string  | yes      | Column to extract unique values from             |
| `includeAll`| boolean | no       | Prepend an "All" option with empty string value  |
| `allLabel`  | string  | no       | Label for the "All" option (default: `"All"`)    |

- Null/undefined values are excluded
- Values are sorted alphabetically

### Option 2: Static list

```json
{
  "MultiSelect": {
    "optionsFrom": {
      "list": ["Active", "On Leave", "Trainee"]
    },
    "selected": ["Active", "On Leave", "Trainee"],
    "bind": { "source": "team_members", "field": "status", "op": "in", "nullValue": ["Active", "On Leave", "Trainee"] }
  }
}
```

| Property | Type     | Required | Description              |
|----------|----------|----------|--------------------------|
| `list`   | string[] | yes      | Static array of values   |

Each list entry becomes `{ label: value, value: value }`.

## Precedence

- `optionsFrom` > `options` (when both are present, `optionsFrom` wins)
- Existing `options` prop continues to work unchanged for backward compatibility
