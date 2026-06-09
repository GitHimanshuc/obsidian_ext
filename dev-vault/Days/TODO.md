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
filter: today
display: task,due,est
```

### Today + N

```todo-plugin
folders:
- Days/2026
filter: today+0
display: task,due,prio,est
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

## Sort checks

### Due time

```todo-plugin
folders:
- Days/2026
sort: due
display: task,due,prio,est,source
```

### Due hours only

```todo-plugin
folders:
- Days/2026
sort: due
display: task,due-hours,prio,est,source
```

### Priority

```todo-plugin
folders:
- Days/2026
sort: prio
display: task,due,prio,est,source
```

### Completion time

```todo-plugin
folders:
- Days/2026
sort: est
display: task,est,due,prio,source
```

### Effective priority

```todo-plugin
folders:
- Days/2026
sort: effective-prio
display: task,due,prio,est,source
```

## Completed today

```todo-plugin
folders:
- Days/2026
mode: completed-today
sort: done
display: task,done,due,prio,est,source
```

## Cross-folder checks

### All active tasks by effective priority

```todo-plugin
folders:
- Days/2025
- Days/2026
sort: effective-prio
display: task,due,prio,est,source
```

### All completed today

```todo-plugin
folders:
- Days/2025
- Days/2026
mode: completed-today
sort: done
display: task,done,source
```
