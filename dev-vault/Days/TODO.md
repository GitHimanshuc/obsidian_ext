```todo-plugin
folders:
- Days
```

```todo-plugin
folders:
- Days/2025
```

```todo-plugin
folders:
- Days/2026
display: task,due,prio,est
```

## Due filter checks

### Today

```todo-plugin
folders:
- Days/2026
filter: today+0
display: task,due,est
```

### Today + 3

```todo-plugin
folders:
- Days/2026
filter: today+3
display: due,task,prio,est
```

### This week

```todo-plugin
folders:
- Days/2026
filter: this-week
display: task,due,est,prio
```

### This month

```todo-plugin
folders:
- Days/2026
filter: this-month
display: due,made,task,prio,est
```
