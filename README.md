# HTML ID IntelliSense

IntelliSense for HTML element IDs inside `<script>` tags.

## Features

- **Autocomplete IDs** — Type an ID name and get suggestions for all IDs in the document
- **Property/Method completions** — Type `myElement.` to see all available properties and methods for that element type
- **Hover information** — Hover over an ID to see its DOM type (`HTMLDivElement`, `HTMLInputElement`, etc.)
- **Go to Definition** — Ctrl/Cmd+click on an ID to jump to its HTML element
- **Duplicate ID warnings** — Red squiggles when the same ID is used multiple times

## Usage

1. Create an HTML file with elements that have `id` attributes
2. Inside a `<script>` tag, start typing an ID name to see completions
3. Type `.` after an ID to see its properties and methods

```html
<div id="myDiv"></div>
<button id="submitBtn">Submit</button>

<script>
  myDiv.style.color = "red";
  submitBtn.addEventListener("click", () => {});
</script>
```

## How It Works

This extension parses HTML documents to find all `id` attributes and maps them to their corresponding DOM types. When you type inside a `<script>` tag, it provides IntelliSense based on the element's type.

## License

[Unlicense](UNLICENSE) — Public Domain
